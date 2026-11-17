import { authenticatedId, type CurrentUser } from "../../auth/contracts";
import { and, asc, eq } from "drizzle-orm";
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
}

export interface CalendarFeedResult {
  isConfigured: boolean;
  accounts: CalendarAccountView[];
  events: CalendarEventItem[];
  accountErrors: Record<string, string>;
}

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

  // Validação do limite de até 5 contas vinculadas por usuário (B5)
  const existingAccounts = await db
    .select({
      id: calendarAccounts.id,
      googleSub: calendarAccounts.googleSub,
    })
    .from(calendarAccounts)
    .where(eq(calendarAccounts.userId, userId));

  const isReconnecting = existingAccounts.some((acc) => acc.googleSub === googleSub);
  if (!isReconnecting && existingAccounts.length >= 5) {
    throw new Error("Limite máximo de 5 contas Google atingido. Remova uma conta antes de conectar outra.");
  }

  const id = randomUUID();

  await db
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
 * Retorna as strings ISO de início e fim do dia atual no fuso horário de São Paulo.
 */
export function getTodayBoundsSP(now = new Date()): { timeMin: string; timeMax: string; dateStr: string } {
  const dateStr = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);

  const timeMin = `${dateStr}T00:00:00-03:00`;
  const timeMax = `${dateStr}T23:59:59.999-03:00`;

  return { timeMin, timeMax, dateStr };
}

/**
 * Carrega todas as contas do usuário e busca os eventos de hoje do Google Calendar.
 * Resiliente: se uma conta falhar com invalid_grant ou erro de rede, as outras continuam.
 */
export async function getCalendarFeed(
  db: Database,
  user: CurrentUser,
  now = new Date(),
  fetchFn = fetch,
): Promise<CalendarFeedResult> {
  const config = getCalendarConfig();
  if (!config.isAvailable) {
    return {
      isConfigured: false,
      accounts: [],
      events: [],
      accountErrors: {},
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
    };
  }

  const { timeMin, timeMax } = getTodayBoundsSP(now);
  const events: CalendarEventItem[] = [];
  const accountErrors: Record<string, string> = {};

  // Para cada conta, renova token e busca eventos
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

      // Consulta eventos do calendário primário
      const url = `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}&singleEvents=true&orderBy=startTime&maxResults=20`;

      try {
        const res = await fetchFn(url, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
        });

        if (!res.ok) {
          console.error("Falha ao buscar eventos do Google Calendar: status", res.status);
          accountErrors[account.id] = "Não foi possível carregar os eventos desta conta.";
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
          const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
          const rawStart = item.start?.dateTime ?? item.start?.date ?? "";
          const rawEnd = item.end?.dateTime ?? item.end?.date;

          if (!rawStart) continue;

          const safeHtmlLink = isValidCalendarHtmlLink(item.htmlLink) ? item.htmlLink : undefined;

          events.push({
            id: item.id ?? randomUUID(),
            title: (item.summary ?? "(Sem título)").trim() || "(Sem título)",
            startTime: rawStart,
            endTime: rawEnd,
            isAllDay,
            htmlLink: safeHtmlLink,
            accountEmail: account.email,
            accountId: account.id,
          });
        }
      } catch {
        console.error("Erro ao buscar eventos do Google Calendar");
        accountErrors[account.id] = "Erro de conexão ao carregar eventos.";
      }
    }),
  );

  // Ordena eventos por horário
  events.sort((a, b) => a.startTime.localeCompare(b.startTime));

  return {
    isConfigured: true,
    accounts,
    events,
    accountErrors,
  };
}
