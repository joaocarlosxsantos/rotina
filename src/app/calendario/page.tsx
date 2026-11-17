import { requireCurrentUser } from "../../auth/server";
import { getDatabase } from "../../db/client";
import { getCalendarFeed, getTodayBoundsSP } from "../../lib/calendar/store";
import { TIME_ZONE } from "../../lib/rules";
import { Header } from "../header";
import { removeCalendarAccountAction } from "./actions";
import { Submit } from "../submit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  const { dateStr } = getTodayBoundsSP(now);

  const formattedDate = new Intl.DateTimeFormat("pt-BR", {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

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
              acompanhar os eventos de hoje sem sair do seu caderno de hábitos.
            </p>
          </div>
        </div>

        {query.error && (
          <p className="notice error" role="alert">
            {query.error.slice(0, 250)}
          </p>
        )}
        {query.success && (
          <p className="notice" role="status">
            {query.success.slice(0, 250)}
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
            {/* Coluna Principal: Eventos do Dia */}
            <section className="calendar-events-section" aria-labelledby="events-title">
              <div className="section-title">
                <div>
                  <h2 id="events-title">Agenda de hoje</h2>
                  <span className="calendar-date-label">{formattedDate}</span>
                </div>
                <span className="events-counter">
                  {feed.events.length} {feed.events.length === 1 ? "evento" : "eventos"}
                </span>
              </div>

              {feed.accounts.length === 0 ? (
                <div className="empty calendar-empty">
                  <h3>Nenhuma conta Google conectada.</h3>
                  <p>
                    Conecte suas contas de trabalho, estudos ou pessoal para visualizar
                    todos os seus eventos do dia organizados em ordem cronológica.
                  </p>
                  <a href="/api/calendar/connect" className="btn-connect-primary">
                    Conectar primeira conta Google
                  </a>
                </div>
              ) : feed.events.length === 0 ? (
                <div className="empty calendar-empty">
                  <h3>Nenhum evento agendado para hoje.</h3>
                  <p>
                    Seu dia está livre nas contas conectadas. Ótimo momento para
                    avançar nas suas rotinas e cuidar do seu pet!
                  </p>
                </div>
              ) : (
                <ol className="calendar-events-list">
                  {feed.events.map((event) => {
                    const startFormatted = formatEventTime(event.startTime, event.isAllDay);
                    const endFormatted = event.endTime && !event.isAllDay
                      ? formatEventTime(event.endTime, false)
                      : null;

                    return (
                      <li key={event.id} className="calendar-event-card">
                        <div className="event-time-col">
                          <strong className="event-start-time">{startFormatted}</strong>
                          {endFormatted && (
                            <span className="event-end-time">até {endFormatted}</span>
                          )}
                        </div>

                        <div className="event-info-col">
                          <h3 className="event-title">{event.title}</h3>
                          <div className="event-meta">
                            <span className="event-account-badge" title={`Conta: ${event.accountEmail}`}>
                              {event.accountEmail}
                            </span>
                            {event.htmlLink && (
                              <a
                                href={event.htmlLink}
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
