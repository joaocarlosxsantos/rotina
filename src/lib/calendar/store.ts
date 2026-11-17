import { authenticatedId, type CurrentUser } from "../../auth/contracts";
import { and, asc, eq, sql } from "drizzle-orm";
import { createHash, randomUUID } from "node:crypto";
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
  calendarNames?: string[];
  calendarColor?: string;
  isSpecialCalendar?: boolean;
  startDateSP: string;
  isMultiDay?: boolean;
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
  isPartial?: boolean;
}

export const MAX_CALENDARS_PER_ACCOUNT = 8;
export const MAX_FEED_EVENTS_TOTAL = 60;
export const CALENDAR_FEED_TIMEOUT_MS = 8000;
export const CALENDAR_CONCURRENCY_LIMIT = 6;
export const CALENDAR_CACHE_TTL_MS = 60_000;
export const MAX_FEED_CACHE_ENTRIES = 200;

interface CacheEntry {
  timestamp: number;
  result: CalendarFeedResult;
}

/**
 * Nota de arquitetura (R4): feedCache armazena feeds em memória na instância do processo.
 * Em deployment com múltiplas instâncias serverless, a invalidação opera na instância local,
 * mantendo o isolamento por user_id e TTL curto de 60s como limite de defasagem.
 */
const feedCache = new Map<string, CacheEntry>();

/**
 * Invalida o cache de feed de calendário para um usuário específico ou para todos.
 */
export function invalidateCalendarCache(userId?: string): void {
  if (userId) {
    feedCache.delete(userId);
  } else {
    feedCache.clear();
  }
}

/**
 * Registra o feed completo no cache do usuário, executando sweep de expirados e controle de teto (R2).
 */
export function setFeedCache(userId: string, result: CalendarFeedResult): void {
  const now = Date.now();
  // Sweep de entradas expiradas
  for (const [key, entry] of feedCache.entries()) {
    if (now - entry.timestamp > CALENDAR_CACHE_TTL_MS) {
      feedCache.delete(key);
    }
  }
  // Teto máximo de entradas: remove a mais antiga se atingir o limite
  while (feedCache.size >= MAX_FEED_CACHE_ENTRIES) {
    const oldestKey = feedCache.keys().next().value;
    if (!oldestKey) break;
    feedCache.delete(oldestKey);
  }
  feedCache.set(userId, { timestamp: now, result });
}

export function getFeedCacheSize(): number {
  return feedCache.size;
}

/**
 * Executa tarefas assíncronas com concorrência máxima limitada (p-limit leve nativo).
 */
export async function pLimitAll<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency = CALENDAR_CONCURRENCY_LIMIT,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let current = 0;
  const workers = Array.from(
    { length: Math.min(items.length, Math.max(1, concurrency)) },
    async () => {
      while (current < items.length) {
        const idx = current++;
        results[idx] = await fn(items[idx]);
      }
    },
  );
  await Promise.all(workers);
  return results;
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

  invalidateCalendarCache(userId);
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

  invalidateCalendarCache(userId);

  return true;
}

/**
 * Subtrai dias de uma data YYYY-MM-DD no fuso de São Paulo.
 */
export function subtractDays(dateStr: string, days = 1): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d - days, 12, 0, 0));
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(dt);
}

/**
 * Calcula a data civil de término em SP para um evento com horário.
 * Se terminar exatamente às 00:00:00 (meia-noite exclusiva), considera o dia anterior.
 * B7: Se a data for inválida, retorna string vazia.
 */
export function getSPEndDayForTimedEvent(endIso: string): string {
  const spDateStr = getSPDateString(endIso);
  if (!spDateStr) return "";

  try {
    const d = new Date(endIso);
    const timeStr = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(d);

    if (timeStr === "00:00:00" || timeStr === "24:00:00") {
      return subtractDays(spDateStr, 1);
    }
    return spDateStr;
  } catch {
    return spDateStr;
  }
}

/**
 * Extrai a representação da data civil em São Paulo (formato YYYY-MM-DD).
 * B7: Se a data for inválida ou não puder ser processada, retorna string vazia.
 */
export function getSPDateString(dateOrIso: string | Date): string {
  try {
    const d = typeof dateOrIso === "string" ? new Date(dateOrIso) : dateOrIso;
    if (Number.isNaN(d.getTime())) {
      return "";
    }
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
  } catch {
    return "";
  }
}

/**
 * Deriva dinamicamente o offset do fuso horário de São Paulo (B6).
 * No Brasil (America/Sao_Paulo), o horário de verão foi revogado pelo Decreto 9.772/2019,
 * mantendo UTC-3 constante. A derivação via Intl garante conformidade caso regras futuras mudem.
 */
export function getTimeZoneOffsetSP(date = new Date()): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: TIME_ZONE,
      timeZoneName: "longOffset",
    }).formatToParts(date);
    const tzPart = parts.find((p) => p.type === "timeZoneName");
    if (tzPart && tzPart.value.startsWith("GMT")) {
      const raw = tzPart.value.slice(3); // "+00:00", "-03:00", etc.
      return raw || "-03:00";
    }
  } catch {
    // Fallback padrão de São Paulo
  }
  return "-03:00";
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

  // B6: Derivação de offset via Intl para início e término
  const startOffset = getTimeZoneOffsetSP(new Date(`${todayStr}T12:00:00Z`));
  const endOffset = getTimeZoneOffsetSP(new Date(`${endDateStr}T12:00:00Z`));

  const timeMin = `${todayStr}T00:00:00${startOffset}`;
  const timeMax = `${endDateStr}T00:00:00${endOffset}`;

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

interface FetchCalendarTask {
  account: CalendarAccountView;
  accessToken: string;
  cal: {
    id: string;
    name: string;
    color?: string;
    isSpecial: boolean;
  };
}

/**
 * Carrega todas as contas do usuário e busca os eventos dos próximos 7 dias do Google Calendar,
 * com suporte a múltiplos calendários, paginação (B2), prioridade de primário (B1),
 * deduplicação iCalUID (B3), expansão multi-dia com clamp (M1, M2), logs seguros (M3),
 * e deadline global com concorrência limitada e cache de 60s (M4).
 */
export async function getCalendarFeed(
  db: Database,
  user: CurrentUser,
  now = new Date(),
  fetchFn = fetch,
  bypassCache = false,
): Promise<CalendarFeedResult> {
  const config = getCalendarConfig();
  const window = getCalendarWindowSP(now, 7);
  const userId = authenticatedId(user);

  if (!config.isAvailable) {
    return {
      isConfigured: false,
      accounts: [],
      events: [],
      accountErrors: {},
      window,
    };
  }

  // Cache curto de 60s por usuário (M4)
  if (!bypassCache) {
    const cached = feedCache.get(userId);
    if (cached && Date.now() - cached.timestamp < CALENDAR_CACHE_TTL_MS) {
      return cached.result;
    }
  }

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
    const emptyResult: CalendarFeedResult = {
      isConfigured: true,
      accounts: [],
      events: [],
      accountErrors: {},
      window,
    };
    setFeedCache(userId, emptyResult);
    return emptyResult;
  }

  const events: CalendarEventItem[] = [];
  const accountErrors: Record<string, string> = {};
  const seenEventsByDay = new Map<string, CalendarEventItem>();
  let isPartial = false;

  // Deadline global de ~8s para toda a coleta do feed (M4)
  const globalAbortController = new AbortController();
  const globalTimer = setTimeout(() => {
    isPartial = true;
    globalAbortController.abort();
  }, CALENDAR_FEED_TIMEOUT_MS);

  try {
    const tasks: FetchCalendarTask[] = [];

    // 1. Para cada conta: renova token e lista calendários com paginação (B2)
    for (const account of rows) {
      if (globalAbortController.signal.aborted) {
        isPartial = true;
        break;
      }

      let accessToken: string;
      try {
        const aad = `${userId}:${account.googleSub}`;
        const refreshToken = decryptToken(account.refreshTokenEnc, undefined, aad);
        accessToken = await refreshGoogleAccessToken({
          refreshToken,
          clientId: config.clientId,
          clientSecret: config.clientSecret,
          fetchFn,
          signal: globalAbortController.signal,
        });
      } catch (err) {
        if (globalAbortController.signal.aborted) {
          isPartial = true;
          break;
        }
        if (err instanceof GoogleOAuthError && err.isInvalidGrant) {
          accountErrors[account.id] = "Autorização expirada ou revogada. Reconecte a conta.";
        } else {
          accountErrors[account.id] = "Não foi possível acessar esta conta no momento.";
        }
        continue;
      }

      // Consulta calendarList com paginação (B2: limite de até 3 páginas)
      const rawCalendars: Array<{
        id: string;
        name: string;
        color?: string;
        isSpecial: boolean;
        primary?: boolean;
      }> = [];

      let calPage = 0;
      let calPageToken: string | undefined;

      while (calPage < 3 && !globalAbortController.signal.aborted) {
        let calListUrl =
          "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=reader&maxResults=50";
        if (calPageToken) {
          calListUrl += `&pageToken=${encodeURIComponent(calPageToken)}`;
        }

        try {
          const calListRes = await fetchFn(calListUrl, {
            headers: {
              Authorization: `Bearer ${accessToken}`,
              Accept: "application/json",
            },
            signal: AbortSignal.any([AbortSignal.timeout(5000), globalAbortController.signal]),
          });

          if (!calListRes.ok) {
            isPartial = true;
            // M3: NUNCA loga nomes nem resumos
            console.error(`Falha ao listar calendários: status=${calListRes.status}`);
            break;
          }

          const calListData = (await calListRes.json()) as {
            items?: Array<{
              id?: string;
              summary?: string;
              summaryOverride?: string;
              backgroundColor?: string;
              selected?: boolean;
              hidden?: boolean;
              primary?: boolean;
            }>;
            nextPageToken?: string;
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

            rawCalendars.push({
              id: cal.id,
              name,
              color: cal.backgroundColor,
              isSpecial,
              primary: cal.primary,
            });
          }

          calPageToken = calListData.nextPageToken;
          calPage++;
          if (!calPageToken) break;
        } catch {
          isPartial = true;
          break;
        }
      }

      // B1: ordene calendarios com primary:true primeiro antes do corte de 8
      rawCalendars.sort((a, b) => {
        const aPrim = a.primary || a.id === "primary" ? 1 : 0;
        const bPrim = b.primary || b.id === "primary" ? 1 : 0;
        return bPrim - aPrim;
      });

      let calendarsToFetch = rawCalendars.slice(0, MAX_CALENDARS_PER_ACCOUNT);

      // Fallback para primary se calendarList veio vazio
      if (calendarsToFetch.length === 0) {
        calendarsToFetch = [
          {
            id: "primary",
            name: "Principal",
            isSpecial: false,
            primary: true,
          },
        ];
      }

      for (const cal of calendarsToFetch) {
        tasks.push({
          account,
          accessToken,
          cal,
        });
      }
    }

    // 2. Executa tarefas de busca de eventos com concorrência limitada a 6 requests simultâneos (M4)
    await pLimitAll(
      tasks,
      async ({ account, accessToken, cal }) => {
        if (globalAbortController.signal.aborted) {
          isPartial = true;
          return;
        }

        let evPage = 0;
        let evPageToken: string | undefined;

        while (evPage < 3 && !globalAbortController.signal.aborted) {
          let url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
            cal.id,
          )}/events?timeMin=${encodeURIComponent(window.timeMin)}&timeMax=${encodeURIComponent(
            window.timeMax,
          )}&singleEvents=true&orderBy=startTime&maxResults=50`;

          if (evPageToken) {
            url += `&pageToken=${encodeURIComponent(evPageToken)}`;
          }

          try {
            const res = await fetchFn(url, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/json",
              },
              signal: AbortSignal.any([AbortSignal.timeout(5000), globalAbortController.signal]),
            });

            if (!res.ok) {
              isPartial = true;
              // M3: NUNCA loga nome de calendário nem evento; loga só status e hash curto
              const calHash = createHash("sha256").update(cal.id).digest("hex").slice(0, 8);
              console.error(`Falha ao buscar eventos: status=${res.status} cal_hash=${calHash}`);
              break;
            }

            const data = (await res.json()) as {
              items?: Array<{
                id?: string;
                iCalUID?: string;
                summary?: string;
                start?: { dateTime?: string; date?: string };
                end?: { dateTime?: string; date?: string };
                htmlLink?: string;
              }>;
              nextPageToken?: string;
            };

            const items = data.items ?? [];
            for (const item of items) {
              const rawStart = item.start?.dateTime ?? item.start?.date ?? "";
              if (!rawStart) continue;

              // B5: isAllDay só para eventos genuinamente de dia inteiro (start.date sem dateTime)
              const isAllDay = Boolean(item.start?.date && !item.start?.dateTime);
              const rawEnd = item.end?.dateTime ?? item.end?.date;

              // B3: dedupe por iCalUID+start e trata item.id ausente sem colapsar chaves
              const canonicalId = item.iCalUID || item.id || `anon-${randomUUID()}`;
              const dedupeBaseKey = `${canonicalId}:${rawStart}`;

              // M1 & M2: Cálculo de dias abrangidos pelo evento
              let startDayStr: string;
              let lastDayStr: string;

              if (isAllDay) {
                startDayStr = item.start?.date ?? getSPDateString(rawStart);
                if (!startDayStr) continue; // B7 guard: ignora se data inválida
                const rawEndDate = item.end?.date;
                if (rawEndDate && rawEndDate > startDayStr) {
                  // Dia inteiro: end.date é exclusivo (último dia = end - 1)
                  lastDayStr = subtractDays(rawEndDate, 1);
                } else {
                  lastDayStr = startDayStr;
                }
              } else {
                startDayStr = getSPDateString(rawStart);
                if (!startDayStr) continue; // B7 guard: ignora se data inválida
                lastDayStr = rawEnd ? getSPEndDayForTimedEvent(rawEnd) : startDayStr;
                if (!lastDayStr || lastDayStr < startDayStr) {
                  lastDayStr = startDayStr;
                }
              }

              const isMultiDay = lastDayStr > startDayStr;

              // M1: clamp do dia de início para hoje caso tenha começado antes da janela
              const effectiveStart =
                startDayStr < window.startDateStr ? window.startDateStr : startDayStr;
              const lastWindowDay = window.dayKeys[window.dayKeys.length - 1];
              const effectiveEnd = lastDayStr > lastWindowDay ? lastWindowDay : lastDayStr;

              // M2: evento multi-dia aparece em CADA dia da janela coberto pelo período
              if (effectiveStart <= effectiveEnd) {
                for (const dayKey of window.dayKeys) {
                  if (dayKey >= effectiveStart && dayKey <= effectiveEnd) {
                    const dayDedupeKey = `${dedupeBaseKey}:${dayKey}`;

                    if (seenEventsByDay.has(dayDedupeKey)) {
                      // B3: mesmo compromisso em múltiplos calendários - mescla rótulos
                      const existing = seenEventsByDay.get(dayDedupeKey)!;
                      if (existing.calendarNames && !existing.calendarNames.includes(cal.name)) {
                        existing.calendarNames.push(cal.name);
                        existing.calendarName = existing.calendarNames.join(", ");
                      }
                    } else {
                      const safeHtmlLink = isValidCalendarHtmlLink(item.htmlLink)
                        ? item.htmlLink
                        : undefined;

                      const newEventItem: CalendarEventItem = {
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
                        calendarNames: [cal.name],
                        calendarColor: cal.color,
                        isSpecialCalendar: cal.isSpecial,
                        startDateSP: dayKey,
                        isMultiDay,
                      };

                      seenEventsByDay.set(dayDedupeKey, newEventItem);
                      events.push(newEventItem);
                    }
                  }
                }
              }
            }

            evPageToken = data.nextPageToken;
            evPage++;
            if (!evPageToken) break;
          } catch {
            isPartial = true;
            const calHash = createHash("sha256").update(cal.id).digest("hex").slice(0, 8);
            console.error(`Erro de conexão ao buscar eventos: cal_hash=${calHash}`);
            break;
          }
        }
      },
      CALENDAR_CONCURRENCY_LIMIT,
    );
  } finally {
    clearTimeout(globalTimer);
  }

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

  if (isPartial) {
    accountErrors["_partial"] = "Alguns calendários não puderam ser carregados a tempo.";
  }

  const finalResult: CalendarFeedResult = {
    isConfigured: true,
    accounts,
    events: trimmedEvents,
    accountErrors,
    window,
    isPartial,
  };

  // R1: Não cacheie resultado PARCIAL (isPartial/timeout): só cache de feed completo
  if (!isPartial) {
    setFeedCache(userId, finalResult);
  }

  return finalResult;
}
