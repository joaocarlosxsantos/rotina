import { authenticatedId, type CurrentUser } from "../../auth/contracts";
import { and, asc, eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { Database } from "../../db/client";
import { calendarAccounts } from "../../db/schema";
import { TIME_ZONE } from "../rules";
import { getCalendarConfig } from "./config";
import { decryptToken } from "./crypto";
import {
  GoogleOAuthError,
  refreshGoogleAccessToken,
  revokeGoogleToken,
} from "./oauth";

export class CalendarAccountLimitError extends Error {
  constructor(message = "Limite máximo de 5 contas Google atingido. Remova uma conta antes de conectar outra.") {
    super(message);
    this.name = "CalendarAccountLimitError";
  }
}

export interface CalendarAccountView {
  id: string;
  email: string;
  googleSub: string;
  createdAt: Date;
}

export interface CalendarEventItem {
  id: string;
  title: string;
  startTime: string;
  endTime?: string;
  isAllDay: boolean;
  htmlLink?: string;
  accountEmail: string;
  accountId: string;
  calendarId: string;
  calendarName: string;
  calendarColor?: string;
  isSpecialCalendar?: boolean;
  startDateSP: string;
}

export interface CalendarWindowSP {
  timeMin: string;
  timeMax: string;
  startDateStr: string;
  endDateStr: string;
  dayKeys: string[];
}

export interface CalendarFeedResult {
  isConfigured: boolean;
  accounts: CalendarAccountView[];
  events: CalendarEventItem[];
  accountErrors: Record<string, string>;
  window: CalendarWindowSP;
}

export const MAX_CALENDARS_PER_ACCOUNT = 8;
export const MAX_FEED_EVENTS_TOTAL = 60;

export function isValidCalendarHtmlLink(link?: string): boolean {
  if (!link || typeof link !== "string") return false;
  return link.startsWith("https://www.google.com/") || link.startsWith("https://calendar.google.com/");
}

export async function listCalendarAccounts(
  db: Database,
  user: CurrentUser,
): Promise<CalendarAccountView[]> {
  const userId = authenticatedId(user);
  const rows = await db
    .select({
      id: calendarAccounts.id,
      email: calendarAccounts.email,
      googleSub: calendarAccounts.googleSub,
      createdAt: calendarAccounts.createdAt,
    })
    .from(calendarAccounts)
    .where(eq(calendarAccounts.userId, userId))
    .orderBy(asc(calendarAccounts.createdAt));

  return rows;
}

export async function saveCalendarAccount(
  db: Database,
  user: CurrentUser,
  {
    googleSub,
    email,
    refreshTokenEnc,
  }: {
    googleSub: string;
    email: string;
    refreshTokenEnc: string;
  },
): Promise<void> {
  const userId = authenticatedId(user);

  await db.transaction(async (tx) => {
    // Advisory lock transacional por usuário para serialização atômica do limite de contas
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 724681))`);

    const existingAccounts = await tx
      .select({
        id: calendarAccounts.id,
        googleSub: calendarAccounts.googleSub,
      })
      .from(calendarAccounts)
      .where(eq(calendarAccounts.userId, userId));

    const isReconnecting = existingAccounts.some((acc) => acc.googleSub === googleSub);
    if (!isReconnecting && existingAccounts.length >= 5) {
      throw new CalendarAccountLimitError();
    }

    const id = randomUUID();

    await tx
      .insert(calendarAccounts)
      .values({
        id,
        userId,
        googleSub,
        email,
        refreshTokenEnc,
        createdAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [calendarAccounts.userId, calendarAccounts.googleSub],
        set: {
          email,
          refreshTokenEnc,
          createdAt: new Date(),
        },
      });
  });
}

export async function deleteCalendarAccount(
  db: Database,
  user: CurrentUser,
  accountId: string,
  fetchFn = fetch,
): Promise<boolean> {
  const userId = authenticatedId(user);

  const rows = await db
    .select({
      id: calendarAccounts.id,
      googleSub: calendarAccounts.googleSub,
      refreshTokenEnc: calendarAccounts.refreshTokenEnc,
    })
    .from(calendarAccounts)
    .where(and(eq(calendarAccounts.id, accountId), eq(calendarAccounts.userId, userId)))
    .limit(1);

  if (!rows.length) {
    return false;
  }

  const row = rows[0];

  // Tenta revogar o token no Google em segundo plano com autenticação AAD (I1, I2)
  try {
    const aad = `${userId}:${row.googleSub}`;
    const refreshToken = decryptToken(row.refreshTokenEnc, undefined, aad);
    await revokeGoogleToken({ token: refreshToken, fetchFn });
  } catch {
    // Falha de decriptação ou revogação remota não impede exclusão local
  }

  await db
    .delete(calendarAccounts)
    .where(and(eq(calendarAccounts.id, accountId), eq(calendarAccounts.userId, userId)));

  return true;
}

/**
 * Extrai a representação da data civil em São Paulo (formato YYYY-MM-DD).
 */
export function getSPDateString(dateOrIso: string | Date): string {
  const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/**
 * Retorna as strings ISO de início (00:00:00 SP) e fim (+7 dias 00:00:00 SP) no fuso horário de São Paulo,
 * juntamente com as chaves de dia (YYYY-MM-DD) para agrupamento cronológico.
 */
export function getCalendarWindowSP(now = new Date(), daysAhead = 7): CalendarWindowSP {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  const todayStr = formatter.format(now);
  const [y, m, d] = todayStr.split("-").map(Number);

  const dayKeys: string[] = [];
  for (let i = 0; i < daysAhead; i++) {
    // 12:00:00 UTC (09:00:00 em SP) garante cálculo de data civil imune a transições horárias
    const curDate = new Date(Date.UTC(y, m - 1, d + i, 12, 0, 0));
    dayKeys.push(formatter.format(curDate));
  }

  const endDayDate = new Date(Date.UTC(y, m - 1, d + daysAhead, 12, 0, 0));
  const endDateStr = formatter.format(endDayDate);

  const timeMin = `${todayStr}T00:00:00-03:00`;
  const timeMax = `${endDateStr}T00:00:00-03:00`;

  return {
    timeMin,
    timeMax,
    startDateStr: todayStr,
    endDateStr,
    dayKeys,
  };
}

/**
 * Retorna as strings ISO de início e fim da janela de consulta no fuso horário de São Paulo (compatibilidade).
 */
export function getTodayBoundsSP(now = new Date()): { timeMin: string; timeMax: string; dateStr: string } {
  const window = getCalendarWindowSP(now, 7);
  return {
    timeMin: window.timeMin,
    timeMax: window.timeMax,
    dateStr: window.startDateStr,
  };
}

/**
 * Carrega todas as contas do usuário e busca os eventos dos próximos 7 dias do Google Calendar,
 * incluindo outros calendários selecionados da conta (além do primário), com deduplicação e resiliência.
 */
export async function getCalendarFeed(
  db: Database,
  user: CurrentUser,
  now = new Date(),
  fetchFn = fetch,
): Promise<CalendarFeedResult> {
  const config = getCalendarConfig();
  const window = getCalendarWindowSP(now, 7);

  if (!config.isAvailable) {
    return {
      isConfigured: false,
      accounts: [],
      events: [],
      accountErrors: {},
      window,
    };
  }

  const userId = authenticatedId(user);
  const rows = await db
    .select()
    .from(calendarAccounts)
    .where(eq(calendarAccounts.userId, userId))
    .orderBy(asc(calendarAccounts.createdAt));

  const accounts: CalendarAccountView[] = rows.map((r) => ({
    id: r.id,
    email: r.email,
    googleSub: r.googleSub,
    createdAt: r.createdAt,
  }));

  if (rows.length === 0) {
    return {
      isConfigured: true,
      accounts: [],
      events: [],
      accountErrors: {},
      window,
    };
  }

  const events: CalendarEventItem[] = [];
  const accountErrors: Record<string, string> = {};
  const seenEventKeys = new Set<string>();

  // Para cada conta conectada, renova token e busca eventos de seus calendários
  await Promise.all(
    rows.map(async (account) => {
      let accessToken: string;
      try {
        const aad = `${userId}:${account.googleSub}`;
        const refreshToken = decryptToken(account.refreshTokenEnc, undefined, aad);
        accessToken = await refreshGoogleAccessToken({
          refreshToken,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          fetchFn,
        });
      } catch (err) {
        if (err instanceof GoogleOAuthError && err.isInvalidGrant) {
          accountErrors[account.id] = "Autorização expirada ou revogada. Reconecte a conta.";
        } else {
          accountErrors[account.id] = "Não foi possível acessar esta conta no momento.";
        }
        return;
      }

      // 1. Consulta calendarList para identificar outros calendários da conta
      let calendarsToFetch: Array<{
        id: string;
        name: string;
        color?: string;
        isSpecial: boolean;
      }> = [];

      try {
        const calListUrl =
          "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=50";
        const calListRes = await fetchFn(calListUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
          signal: AbortSignal.timeout(5000),
        });

        if (calListRes.ok) {
          const calListData = (await calListRes.json()) as {
            items?: Array<{
              id?: string;
              summary?: string;
              summaryOverride?: string;
              backgroundColor?: string;
              selected?: boolean;
              hidden?: boolean;
            }>;
          };

          const items = calListData.items ?? [];
          for (const cal of items) {
            if (!cal.id) continue;
            if (cal.hidden === true) continue;
            if (cal.selected === false) continue;

            const name = (cal.summaryOverride || cal.summary || "Principal").trim() || "Principal";
            const isSpecial = Boolean(
              cal.id.includes("group.v.calendar.google.com") ||
                cal.id.includes("#holiday@") ||
                cal.id.includes("#contacts@"),
            );

            calendarsToFetch.push({
              id: cal.id,
              name,
              color: cal.backgroundColor,
              isSpecial,
            });

            if (calendarsToFetch.length >= MAX_CALENDARS_PER_ACCOUNT) {
              break;
            }
          }
        }
      } catch {
        // Falha na listagem de calendários não derruba a conta: fallback para calendário primário
      }

      // Fallback seguro se calendarList não retornou calendários selecionados
      if (calendarsToFetch.length === 0) {
        calendarsToFetch.push({
          id: "primary",
          name: "Principal",
          isSpecial: false,
        });
      }

      // 2. Busca eventos para cada calendário selecionado (limite de 8 por conta)
      await Promise.all(
        calendarsToFetch.map(async (cal) => {
          const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            cal.id,
          )}/events?timeMin=${encodeURIComponent(window.timeMin)}&timeMax=${encodeURIComponent(
            window.timeMax,
          )}&singleEvents=true&orderBy=startTime&maxResults=50`;

          try {
            const res = await fetchFn(url, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
              },
              signal: AbortSignal.timeout(5000),
            });

            if (!res.ok) {
              console.error(`Falha ao buscar eventos do calendário ${cal.name}: status ${res.status}`);
              return;
            }

            const data = (await res.json()) as {
              items?: Array<{
                id?: string;
                summary?: string;
                start?: { dateTime?: string; date?: string };
                end?: { dateTime?: string; date?: string };
                htmlLink?: string;
              }>;
            };

            const items = data.items ?? [];
            for (const item of items) {
              const rawStart = item.start?.dateTime ?? item.start?.date ?? "";
              if (!rawStart) continue;

              const dedupeKey = `${item.id ?? ""}:${cal.id}`;
              if (seenEventKeys.has(dedupeKey)) continue;
              seenEventKeys.add(dedupeKey);

              const isAllDay = cal.isSpecial || Boolean(item.start?.date && !item.start?.dateTime);
              const rawEnd = item.end?.dateTime ?? item.end?.date;
              const safeHtmlLink = isValidCalendarHtmlLink(item.htmlLink) ? item.htmlLink : undefined;

              // Data civil de início em São Paulo (YYYY-MM-DD)
              const startDateSP = item.start?.date
                ? item.start.date
                : getSPDateString(item.start!.dateTime!);

              events.push({
                id: item.id ?? randomUUID(),
                title: (item.summary ?? "(Sem título)").trim() || "(Sem título)",
                startTime: rawStart,
                endTime: rawEnd,
                isAllDay,
                htmlLink: safeHtmlLink,
                accountEmail: account.email,
                accountId: account.id,
                calendarId: cal.id,
                calendarName: cal.name,
                calendarColor: cal.color,
                isSpecialCalendar: cal.isSpecial,
                startDateSP,
              });
            }
          } catch {
            // Falha de um calendário específico não derruba os demais calendários
            console.error(`Erro ao carregar eventos do calendário ${cal.name}`);
          }
        }),
      );
    }),
  );

  // Ordenação dos eventos:
  // 1. Data civil em SP crescente
  // 2. Dia inteiro primeiro
  // 3. Horário de início
  // 4. Título do evento
  events.sort((a, b) => {
    const dateCmp = a.startDateSP.localeCompare(b.startDateSP);
    if (dateCmp !== 0) return dateCmp;

    if (a.isAllDay && !b.isAllDay) return -1;
    if (!a.isAllDay && b.isAllDay) return 1;

    const timeCmp = a.startTime.localeCompare(b.startTime);
    if (timeCmp !== 0) return timeCmp;

    return a.title.localeCompare(b.title);
  });

  const trimmedEvents = events.slice(0, MAX_FEED_EVENTS_TOTAL);

  return {
    isConfigured: true,
    accounts,
    events: trimmedEvents,
    accountErrors,
    window,
  };
}
