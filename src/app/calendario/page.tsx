import type { Metadata } from "next";
import { requireCurrentUser } from "../../auth/server";
import { getDatabase } from "../../db/client";
import {
  getCalendarFeed,
  getSPDateString,
  getSPEndDayForTimedEvent,
  isValidCalendarHtmlLink,
  MAX_FEED_EVENTS_TOTAL,
  sanitizeCalendarColor,
} from "../../lib/calendar/store";
import { DICT, getDictionary, intlLocale, type Locale } from "../../lib/i18n";
import { getLocale } from "../../lib/i18n-server";
import { TIME_ZONE } from "../../lib/rules";
import { Header } from "../header";
import { Submit } from "../submit";
import { removeCalendarAccountAction } from "./actions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 15;

export const CALENDAR_ERROR_MESSAGES: Record<string, string> =
  DICT.pt.calendar.errors;

export const CALENDAR_SUCCESS_MESSAGES: Record<string, string> =
  DICT.pt.calendar.success;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getDictionary(locale).meta.calendarTitle };
}

function formatEventTime(
  isoString: string,
  isAllDay: boolean,
  locale: Locale,
): string {
  const t = getDictionary(locale).calendar;
  if (isAllDay) return t.allDay;
  try {
    const d = new Date(isoString);
    return new Intl.DateTimeFormat(intlLocale(locale), {
      timeZone: TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return isoString;
  }
}

function formatDayHeader(
  dateStr: string,
  todayStr: string,
  tomorrowStr: string,
  locale: Locale,
): string {
  const t = getDictionary(locale).calendar;
  try {
    const [y, m, d] = dateStr.split("-").map(Number);
    const dateObj = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
    const formatted = new Intl.DateTimeFormat(intlLocale(locale), {
      timeZone: TIME_ZONE,
      weekday: "long",
      day: "numeric",
      month: "long",
    }).format(dateObj);
    const simplified =
      locale === "pt" ? formatted.replace("-feira", "") : formatted;
    const capitalized = simplified.charAt(0).toUpperCase() + simplified.slice(1);

    if (dateStr === todayStr) {
      return t.todayLabel(capitalized);
    }
    if (dateStr === tomorrowStr) {
      return t.tomorrowLabel(capitalized);
    }
    return capitalized;
  } catch {
    return dateStr;
  }
}

function localizeAccountError(raw: string, locale: Locale): string {
  if (locale === "pt") return raw;
  const msgs = getDictionary(locale).calendar.accountErrors;
  if (raw.includes("expirada ou revogada")) return msgs.expired;
  if (
    raw.includes("a tempo") ||
    raw.includes("carregados") ||
    raw.includes("demoraram")
  ) {
    return msgs.partial;
  }
  return msgs.unavailable;
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.calendar;
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

  const daysWithEvents = feed.window.dayKeys.filter(
    (k) => (eventsByDay.get(k)?.length ?? 0) > 0,
  );

  const formattedDate = new Intl.DateTimeFormat(intlLocale(locale), {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  // Mapeamento estrito para códigos fixos: texto arbitrário externo é ignorado (I5)
  const errorMessage =
    query.error && Object.hasOwn(t.errors, query.error)
      ? t.errors[query.error]
      : undefined;
  const successMessage =
    query.success && Object.hasOwn(t.success, query.success)
      ? t.success[query.success]
      : undefined;

  return (
    <>
      <a className="skip" href="#calendario-main">
        {t.skipLink}
      </a>

      <Header active="calendario" user={user} locale={locale} />

      <main className="calendar-page" id="calendario-main">
        <div className="calendar-hero">
          <div className="hero-content">
            <span className="hero-eyebrow">{t.eyebrow}</span>
            <h1>{t.title}</h1>
            <p>{t.subtitle}</p>
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
            ℹ️ {localizeAccountError(feed.accountErrors["_partial"], locale)}
          </p>
        )}

        {!feed.isConfigured ? (
          <section
            className="calendar-unconfigured"
            aria-labelledby="unconfigured-title"
          >
            <h2 id="unconfigured-title">{t.unconfiguredTitle}</h2>
            <p>
              {t.unconfiguredBodyPrefix} <code>GOOGLE_CLIENT_ID</code>,{" "}
              <code>GOOGLE_CLIENT_SECRET</code> {t.unconfiguredBodyAnd}{" "}
              <code>CALENDAR_TOKEN_KEY</code>).
            </p>
            <p className="hint">{t.unconfiguredHint}</p>
          </section>
        ) : (
          <div className="calendar-workspace">
            {/* Coluna Principal: Eventos dos Próximos 7 Dias Agrupados */}
            <section
              className="calendar-events-section"
              aria-labelledby="events-title"
            >
              <div className="section-title">
                <div>
                  <h2 id="events-title">{t.agendaTitle}</h2>
                  <span className="calendar-date-label">
                    {t.todayIs(formattedDate)}
                  </span>
                </div>
                <span className="events-counter">
                  {feed.events.length}{" "}
                  {feed.events.length === 1 ? t.eventSingular : t.eventPlural}
                </span>
              </div>

              {feed.events.length >= MAX_FEED_EVENTS_TOTAL && (
                <p className="calendar-limit-notice" role="status">
                  {t.limitNotice(MAX_FEED_EVENTS_TOTAL)}
                </p>
              )}

              {feed.accounts.length === 0 ? (
                <div className="empty calendar-empty">
                  <h3>{t.noAccountsTitle}</h3>
                  <p>{t.noAccountsBody}</p>
                  <a href="/api/calendar/connect" className="btn-connect-primary">
                    {t.connectFirstBtn}
                  </a>
                </div>
              ) : feed.events.length === 0 ? (
                <div className="empty calendar-empty">
                  <h3>{t.noEventsTitle}</h3>
                  <p>{t.noEventsBody}</p>
                </div>
              ) : (
                <div className="calendar-agenda-groups">
                  {daysWithEvents.map((dayKey) => {
                    const dayEvents = eventsByDay.get(dayKey) ?? [];
                    const dayHeaderLabel = formatDayHeader(
                      dayKey,
                      todayStr,
                      tomorrowStr,
                      locale,
                    );

                    return (
                      <section
                        key={dayKey}
                        className="calendar-day-group"
                        aria-labelledby={`day-title-${dayKey}`}
                      >
                        <div className="calendar-day-header">
                          <h3
                            id={`day-title-${dayKey}`}
                            className="calendar-day-title"
                          >
                            {dayHeaderLabel}
                          </h3>
                          <span className="calendar-day-count">
                            {dayEvents.length}{" "}
                            {dayEvents.length === 1
                              ? t.eventSingular
                              : t.eventPlural}
                          </span>
                        </div>

                        <ol className="calendar-events-list">
                          {dayEvents.map((event) => {
                            const startFormatted = formatEventTime(
                              event.startTime,
                              event.isAllDay,
                              locale,
                            );
                            const endFormatted =
                              event.endTime && !event.isAllDay
                                ? formatEventTime(event.endTime, false, locale)
                                : null;
                            const safeLink =
                              event.htmlLink &&
                              isValidCalendarHtmlLink(event.htmlLink)
                                ? event.htmlLink
                                : null;

                            const evStartDay = getSPDateString(event.startTime);
                            const evEndDay = event.endTime
                              ? getSPEndDayForTimedEvent(event.endTime)
                              : evStartDay;

                            let timePrimary = startFormatted;
                            let timeSecondary = endFormatted
                              ? t.until(endFormatted)
                              : null;

                            if (event.isMultiDay && !event.isAllDay) {
                              if (dayKey > evStartDay && dayKey < evEndDay) {
                                timePrimary = t.continues;
                                timeSecondary = t.continuesSub;
                              } else if (
                                dayKey > evStartDay &&
                                dayKey === evEndDay
                              ) {
                                timePrimary = t.endsAt(endFormatted ?? "");
                                timeSecondary = t.endsSub;
                              } else if (
                                dayKey === evStartDay &&
                                dayKey < evEndDay
                              ) {
                                timePrimary = startFormatted;
                                timeSecondary = t.startsSub;
                              }
                            }

                            const displayTitle =
                              locale === "en" && event.title === "(Sem título)"
                                ? t.untitledEvent
                                : event.title;
                            const displayCalendarName =
                              locale === "en"
                                ? event.calendarNames?.length
                                  ? event.calendarNames
                                      .map((name) =>
                                        name === "Principal"
                                          ? t.defaultCalendarName
                                          : name,
                                      )
                                      .join(", ")
                                  : event.calendarName === "Principal"
                                    ? t.defaultCalendarName
                                    : event.calendarName
                                : event.calendarName;

                            return (
                              <li
                                key={`${event.id}-${event.calendarId}-${dayKey}`}
                                className={`calendar-event-card ${
                                  event.isSpecialCalendar
                                    ? "event-special-card"
                                    : ""
                                }`}
                              >
                                <div className="event-time-col">
                                  <strong className="event-start-time">
                                    {timePrimary}
                                  </strong>
                                  {timeSecondary && (
                                    <span className="event-end-time">
                                      {timeSecondary}
                                    </span>
                                  )}
                                </div>

                                <div className="event-info-col">
                                  <h4 className="event-title">{displayTitle}</h4>
                                  <div className="event-meta">
                                    <span
                                      className="event-calendar-badge"
                                      title={t.calendarBadgeTitle(
                                        displayCalendarName,
                                      )}
                                    >
                                      {sanitizeCalendarColor(
                                        event.calendarColor,
                                      ) && (
                                        <span
                                          className="event-color-dot"
                                          style={{
                                            backgroundColor:
                                              sanitizeCalendarColor(
                                                event.calendarColor,
                                              ),
                                          }}
                                          aria-hidden="true"
                                        />
                                      )}
                                      📅 {displayCalendarName}
                                    </span>
                                    {event.isMultiDay && (
                                      <span
                                        className="event-multiday-badge"
                                        title={t.multiDayTitle}
                                      >
                                        {t.multiDayBadge}
                                      </span>
                                    )}
                                    <span
                                      className="event-account-badge"
                                      title={t.accountBadgeTitle(
                                        event.accountEmail,
                                      )}
                                    >
                                      {event.accountEmail}
                                    </span>
                                    {safeLink && (
                                      <a
                                        href={safeLink}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="event-link"
                                        aria-label={t.viewInGoogleAria(
                                          displayTitle,
                                        )}
                                      >
                                        {t.viewInGoogle}
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
            <aside
              className="calendar-accounts-sidebar"
              aria-labelledby="accounts-title"
            >
              <div className="section-title">
                <h2 id="accounts-title">{t.connectedAccountsTitle}</h2>
                <span>{feed.accounts.length}</span>
              </div>

              <div className="connect-action-box">
                <a
                  href="/api/calendar/connect"
                  className="btn-connect-secondary"
                >
                  {t.connectAnotherBtn}
                </a>
              </div>

              {feed.accounts.length === 0 ? (
                <p className="hint">{t.noLinkedAccounts}</p>
              ) : (
                <ul className="connected-accounts-list">
                  {feed.accounts.map((account) => {
                    const hasError = feed.accountErrors[account.id];

                    return (
                      <li
                        key={account.id}
                        className={`connected-account-item ${hasError ? "account-has-error" : ""}`}
                      >
                        <div className="account-details">
                          <strong
                            className="account-email"
                            title={account.email}
                          >
                            {account.email}
                          </strong>
                          {hasError ? (
                            <div className="account-error-msg" role="alert">
                              <span>
                                ⚠️ {localizeAccountError(hasError, locale)}
                              </span>
                              <a
                                href="/api/calendar/connect"
                                className="btn-reconnect-link"
                              >
                                {t.reconnect}
                              </a>
                            </div>
                          ) : (
                            <span className="account-status-ok">{t.synced}</span>
                          )}
                        </div>

                        <form
                          action={removeCalendarAccountAction}
                          className="account-remove-form"
                        >
                          <input
                            type="hidden"
                            name="accountId"
                            value={account.id}
                          />
                          <Submit
                            className="btn-remove-account"
                            aria-label={t.removeAria(account.email)}
                            locale={locale}
                          >
                            {t.removeBtn}
                          </Submit>
                        </form>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="calendar-privacy-note">
                <h4>{t.privacyTitle}</h4>
                <p>
                  {t.privacyBodyBefore}{" "}
                  <strong>{t.privacyBodyStrong}</strong>
                  {t.privacyBodyAfter}
                </p>
              </div>
            </aside>
          </div>
        )}
      </main>

      <footer>
        {dict.common.brandName} <span>{dict.common.tagline}</span>
      </footer>
    </>
  );
}
