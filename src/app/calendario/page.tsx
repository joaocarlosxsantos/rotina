import { requireCurrentUser } from "../../auth/server";
import { getDatabase } from "../../db/client";
import {
  getCalendarFeed,
  getSPEndDayForTimedEvent,
  getSPDateString,
  getTodayBoundsSP,
  isValidCalendarHtmlLink,
  MAX_FEED_EVENTS_TOTAL,
  sanitizeCalendarColor,
} from "../../lib/calendar/store";
import { TIME_ZONE } from "../../lib/rules";
import { Header } from "../header";
import { removeCalendarAccountAction } from "./actions";
import { Submit } from "../submit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

export const CALENDAR_ERROR_MESSAGES: Record<string, string> = {
  access_denied: "A autorização foi cancelada ou recusada no Google.",
  missing_params: "Sessão de autorização expirada ou incompleta. Tente conectar novamente.",
  invalid_session: "Sessão de autorização corrompida. Tente conectar novamente.",
  invalid_state: "Falha na validação de segurança da autorização (state inválido).",
  user_mismatch: "A conta precisa ser vinculada pelo mesmo usuário autenticado.",
  unconfigured: "Integração com Google Calendar indisponível ou não configurada no servidor.",
  no_offline_access: "O Google não forneceu permissão de atualização offline. Conecte novamente autorizando o acesso.",
  email_unverified: "A conta Google precisa ter um e-mail verificado.",
  account_limit: "Limite máximo de 5 contas Google atingido. Remova uma conta antes de conectar outra.",
  auth_failed: "Não foi possível autorizar a conta Google. Tente novamente.",
  remove_failed: "Não foi possível remover a conta. Tente novamente.",
  invalid_account: "Identificador de conta inválido.",
};

export const CALENDAR_SUCCESS_MESSAGES: Record<string, string> = {
  connected: "Conta Google conectada com sucesso!",
  removed: "Conta Google removida com sucesso.",
};

function formatEventTime(isoString: string, isAllDay: boolean): string {
  if (isAllDay) return "Dia inteiro";
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return isoString;
  }
}

function formatDayHeader(dateStr: string, todayStr: string, tomorrowStr: string): string {
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const formatted = new Intl.DateTimeFormat("pt-BR", {
      timeZone: TIME_ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dateObj);
    const simplified = formatted.replace("-feira", "");
    const capitalized = simplified.charAt(0).toUpperCase() + simplified.slice(1);

    if (dateStr === todayStr) {
      return `Hoje — ${capitalized}`;
    }
    if (dateStr === tomorrowStr) {
      return `Amanhã — ${capitalized}`;
    }
    return capitalized;
  } catch {
    return dateStr;
  }
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireCurrentUser();
  const query = await searchParams;
  const db = await getDatabase();
  const now = new Date();

  const feed = await getCalendarFeed(db, user, now);
  const todayStr = feed.window.startDateStr;
  const tomorrowStr = feed.window.dayKeys[1] ?? "";

  const eventsByDay = new Map<string, typeof feed.events>();
  for (const event of feed.events) {
    const list = eventsByDay.get(event.startDateSP) ?? [];
    list.push(event);
    eventsByDay.set(event.startDateSP, list);
  }

  const daysWithEvents = feed.window.dayKeys.filter((k) => (eventsByDay.get(k)?.length ?? 0) > 0);

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  // Mapeamento estrito para códigos fixos: texto arbitrário externo é ignorado (I5)
  const errorMessage = query.error ? CALENDAR_ERROR_MESSAGES[query.error] : undefined;
  const successMessage = query.success ? CALENDAR_SUCCESS_MESSAGES[query.success] : undefined;

  return (
    <>
      <a className="skip" href="#calendario-main">
        Pular para o calendário
      </a>

      <Header active="calendario" user={user} />

      <main className="calendar-page" id="calendario-main">
        <div className="calendar-hero">
          <div className="hero-content">
            <span className="hero-eyebrow">Google Calendar</span>
            <h1>Seus compromissos e rotinas em um só lugar.</h1>
            <p>
              Conecte múltiplas contas do Google (modo somente leitura) para
              acompanhar seus eventos dos próximos 7 dias sem sair do seu caderno de hábitos.
            </p>
          </div>
        </div>

        {errorMessage && (
          <p className="notice error" role="alert">
            {errorMessage}
          </p>
        )}
        {successMessage && (
          <p className="notice" role="status">
            {successMessage}
          </p>
        )}
        {feed.accountErrors["_partial"] && (
          <p className="notice" role="status">
            ℹ️ {feed.accountErrors["_partial"]}
          </p>
        )}

        {!feed.isConfigured ? (
          <section className="calendar-unconfigured" aria-labelledby="unconfigured-title">
            <h2 id="unconfigured-title">Integração em configuração</h2>
            <p>
              A sincronização com o Google Calendar requer a configuração das chaves
              de integração no servidor (variáveis <code>GOOGLE_CLIENT_ID</code>,{" "}
              <code>GOOGLE_CLIENT_SECRET</code> e <code>CALENDAR_TOKEN_KEY</code>).
            </p>
            <p className="hint">
              Suas rotinas e companheiro continuam funcionando normalmente.
            </p>
          </section>
        ) : (
          <div className="calendar-workspace">
            {/* Coluna Principal: Eventos dos Próximos 7 Dias Agrupados */}
            <section className="calendar-events-section" aria-labelledby="events-title">
              <div className="section-title">
                <div>
                  <h2 id="events-title">Agenda dos próximos 7 dias</h2>
                  <span className="calendar-date-label">Hoje é {formattedDate}</span>
                </div>
                <span className="events-counter">
                  {feed.events.length} {feed.events.length === 1 ? "evento" : "eventos"}
                </span>
              </div>

              {feed.events.length >= MAX_FEED_EVENTS_TOTAL && (
                <p className="calendar-limit-notice" role="status">
                  Mostrando os {MAX_FEED_EVENTS_TOTAL} primeiros eventos.
                </p>
              )}

              {feed.accounts.length === 0 ? (
                <div className="empty calendar-empty">
                  <h3>Nenhuma conta Google conectada.</h3>
                  <p>
                    Conecte suas contas de trabalho, estudos ou pessoal para visualizar
                    todos os seus eventos dos próximos 7 dias organizados por dia e horário.
                  </p>
                  <a href="/api/calendar/connect" className="btn-connect-primary">
                    Conectar primeira conta Google
                  </a>
                </div>
              ) : feed.events.length === 0 ? (
                <div className="empty calendar-empty">
                  <h3>Nenhum evento agendado para os próximos 7 dias.</h3>
                  <p>
                    Seus próximos 7 dias estão livres nas contas conectadas. Ótimo momento para
                    avançar nas suas rotinas e cuidar do seu pet!
                  </p>
                </div>
              ) : (
                <div className="calendar-agenda-groups">
                  {daysWithEvents.map((dayKey) => {
                    const dayEvents = eventsByDay.get(dayKey) ?? [];
                    const dayHeaderLabel = formatDayHeader(dayKey, todayStr, tomorrowStr);

                    return (
                      <section
                        key={dayKey}
                        className="calendar-day-group"
                        aria-labelledby={`day-title-${dayKey}`}
                      >
                        <div className="calendar-day-header">
                          <h3 id={`day-title-${dayKey}`} className="calendar-day-title">
                            {dayHeaderLabel}
                          </h3>
                          <span className="calendar-day-count">
                            {dayEvents.length} {dayEvents.length === 1 ? "evento" : "eventos"}
                          </span>
                        </div>

                        <ol className="calendar-events-list">
                          {dayEvents.map((event) => {
                            const startFormatted = formatEventTime(event.startTime, event.isAllDay);
                            const endFormatted =
                              event.endTime && !event.isAllDay
                                ? formatEventTime(event.endTime, false)
                                : null;
                            const safeLink =
                              event.htmlLink && isValidCalendarHtmlLink(event.htmlLink)
                                ? event.htmlLink
                                : null;

                            // Formatação de horário refinada para eventos multi-dia com horário
                            const evStartDay = getSPDateString(event.startTime);
                            const evEndDay = event.endTime
                              ? getSPEndDayForTimedEvent(event.endTime)
                              : evStartDay;

                            let timePrimary = startFormatted;
                            let timeSecondary = endFormatted ? `até ${endFormatted}` : null;

                            if (event.isMultiDay && !event.isAllDay) {
                              if (dayKey > evStartDay && dayKey < evEndDay) {
                                timePrimary = "Continua";
                                timeSecondary = "dia inteiro";
                              } else if (dayKey > evStartDay && dayKey === evEndDay) {
                                timePrimary = `Até ${endFormatted ?? "fim"}`;
                                timeSecondary = "término";
                              } else if (dayKey === evStartDay && dayKey < evEndDay) {
                                timePrimary = startFormatted;
                                timeSecondary = "início";
                              }
                            }

                            return (
                              <li
                                key={`${event.id}-${event.calendarId}-${dayKey}`}
                                className={`calendar-event-card ${
                                  event.isSpecialCalendar ? "event-special-card" : ""
                                }`}
                              >
                                <div className="event-time-col">
                                  <strong className="event-start-time">{timePrimary}</strong>
                                  {timeSecondary && (
                                    <span className="event-end-time">{timeSecondary}</span>
                                  )}
                                </div>

                                <div className="event-info-col">
                                  <h4 className="event-title">{event.title}</h4>
                                  <div className="event-meta">
                                    <span
                                      className="event-calendar-badge"
                                      title={`Calendário: ${event.calendarName}`}
                                    >
                                      {sanitizeCalendarColor(event.calendarColor) && (
                                        <span
                                          className="event-color-dot"
                                          style={{
                                            backgroundColor: sanitizeCalendarColor(
                                              event.calendarColor,
                                            ),
                                          }}
                                          aria-hidden="true"
                                        />
                                      )}
                                      📅 {event.calendarName}
                                    </span>
                                    {event.isMultiDay && (
                                      <span
                                        className="event-multiday-badge"
                                        title="Evento que se estende por múltiplos dias"
                                      >
                                        Multi-dia
                                      </span>
                                    )}
                                    <span
                                      className="event-account-badge"
                                      title={`Conta: ${event.accountEmail}`}
                                    >
                                      {event.accountEmail}
                                    </span>
                                    {safeLink && (
                                      <a
                                        href={safeLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="event-link"
                                        aria-label={`Ver evento "${event.title}" no Google Agenda`}
                                      >
                                        Ver no Google Agenda ↗
                                      </a>
                                    )}
                                  </div>
                                </div>
                              </li>
                            );
                          })}
                        </ol>
                      </section>
                    );
                  })}
                </div>
              )}
            </section>

            {/* Coluna Lateral: Gerenciamento de Contas Conectadas */}
            <aside className="calendar-accounts-sidebar" aria-labelledby="accounts-title">
              <div className="section-title">
                <h2 id="accounts-title">Contas conectadas</h2>
                <span>{feed.accounts.length}</span>
              </div>

              <div className="connect-action-box">
                <a href="/api/calendar/connect" className="btn-connect-secondary">
                  + Conectar outra conta Google
                </a>
              </div>

              {feed.accounts.length === 0 ? (
                <p className="hint">
                  Você ainda não possui contas do Google vinculadas.
                </p>
              ) : (
                <ul className="connected-accounts-list">
                  {feed.accounts.map((account) => {
                    const hasError = feed.accountErrors[account.id];

                    return (
                      <li key={account.id} className={`connected-account-item ${hasError ? "account-has-error" : ""}`}>
                        <div className="account-details">
                          <strong className="account-email" title={account.email}>
                            {account.email}
                          </strong>
                          {hasError ? (
                            <div className="account-error-msg" role="alert">
                              <span>⚠️ {hasError}</span>
                              <a href="/api/calendar/connect" className="btn-reconnect-link">
                                Reconectar
                              </a>
                            </div>
                          ) : (
                            <span className="account-status-ok">● Sincronizado</span>
                          )}
                        </div>

                        <form action={removeCalendarAccountAction} className="account-remove-form">
                          <input type="hidden" name="accountId" value={account.id} />
                          <Submit className="btn-remove-account" aria-label={`Remover conta ${account.email}`}>
                            Remover
                          </Submit>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="calendar-privacy-note">
                <h4>Privacidade e Segurança</h4>
                <p>
                  O Rotina Pet solicita acesso <strong>estritamente somente leitura</strong>.
                  Seus dados nunca são compartilhados ou alterados e as chaves de acesso
                  são encriptadas com padrão militar AES-256-GCM.
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>

      <footer>
        Rotina Pet <span>Um passo de cada vez.</span>
      </footer>
    </>
  );
}
