import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "../auth/server";
import { getDatabase } from "../db/client";
import { getDictionary, intlLocale } from "../lib/i18n";
import { getLocale } from "../lib/i18n-server";
import {
  MAX_STREAK_BONUS,
  POINTS_PER_ACTIVITY,
  SKIP_PENALTY,
  TIME_ZONE,
  dayKey,
  scheduleSummary,
} from "../lib/rules";
import { dashboard } from "../lib/store";
import {
  createActivity,
  createRoutine,
  finishActivity,
  passActivity,
} from "./actions";
import { Header } from "./header";
import { Pet } from "./pet";
import { ActivityFields, RoutineFields } from "./routine-fields";
import { Submit } from "./submit";
import { WelcomePage } from "./welcome-page";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const DEFAULT_MOOD_LABELS = {
  feliz: "Feliz",
  ok: "De boa",
  triste: "Triste",
} as const;

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const user = await getCurrentUser();
  const t = getDictionary(locale);
  return {
    title: user ? t.meta.titleDefault : t.meta.welcomeTitle,
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const locale = await getLocale();
  const user = await getCurrentUser();
  if (!user) {
    return <WelcomePage locale={locale} />;
  }

  const dict = getDictionary(locale);
  const t = dict.today;
  const now = new Date();
  const data = await dashboard(await getDatabase(), user, now);
  const query = await searchParams;
  const progress = data.total ? Math.round((data.done / data.total) * 100) : 0;
  const dateLocale = intlLocale(locale);
  const date = new Intl.DateTimeFormat(dateLocale, {
    timeZone: TIME_ZONE,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);
  const moodBadge =
    locale === "en" ? t.moods[data.mood] : DEFAULT_MOOD_LABELS[data.mood];

  return (
    <>
      <a className="skip" href="#rotinas">
        {t.skipLink}
      </a>
      <Header active="hoje" user={user} mood={data.mood} locale={locale} />
      <main>
        <div className="intro">
          <div>
            <p className="date">{date}</p>
            <h1>
              {t.headlineLine1}
              <br />
              {t.headlineLine2}
            </h1>
            <p>{t.subtitle}</p>
          </div>
          <div className="score">
            <strong>{data.points.toLocaleString(dateLocale)}</strong>
            <span>{t.pointsBalance}</span>
          </div>
        </div>
        {typeof query.error === "string" && query.error && (
          <p className="notice error" role="alert">
            {query.error.slice(0, 200)}
          </p>
        )}
        {typeof query.success === "string" && query.success && (
          <p className="notice" role="status">
            {query.success.slice(0, 200)}
          </p>
        )}
        <div className="workspace">
          <section
            className="routines"
            id="rotinas"
            aria-labelledby="routines-title"
          >
            <div className="section-title">
              <h2 id="routines-title">{t.routinesTitle}</h2>
              <span>
                {data.routines.length}{" "}
                {data.routines.length === 1
                  ? t.routineSingular
                  : t.routinePlural}
              </span>
            </div>
            {data.routines.length === 0 && (
              <div className="empty">
                <h3>{t.emptyTitle}</h3>
                <p>
                  {t.emptyPrefix}{" "}
                  <Link href="/rotinas">{t.emptyLink}</Link>.
                </p>
              </div>
            )}
            {data.routines.map((routine) => (
              <section
                className="routine"
                key={routine.id}
                aria-labelledby={`routine-${routine.id}`}
              >
                <div className="routine-heading">
                  <h3 id={`routine-${routine.id}`}>{routine.name}</h3>
                  <Link
                    className="manage-link"
                    href={`/rotinas#routine-${routine.id}`}
                  >
                    {t.editAndArchive}
                  </Link>
                  <span>
                    {routine.activities.filter((a) => a.done).length}/
                    {routine.activities.length}
                  </span>
                </div>
                {routine.activities.length === 0 && (
                  <p className="hint">{t.emptyRoutineHint}</p>
                )}
                <ul>
                  {routine.activities.map((activity) => (
                    <li
                      key={activity.id}
                      className={
                        activity.done
                          ? "done"
                          : activity.skipped
                            ? "skipped"
                            : ""
                      }
                    >
                      <div>
                        <span className="activity-name">{activity.name}</span>
                        <span className="activity-schedule">
                          {scheduleSummary(activity, routine.weekdays, locale)}
                        </span>
                        {activity.scheduledTime && (
                          <time
                            className="schedule"
                            dateTime={activity.scheduledTime}
                          >
                            {activity.scheduledTime} · São Paulo
                          </time>
                        )}
                        <span className="activity-points">
                          {activity.skipped
                            ? `-${SKIP_PENALTY} ${t.pointsUnit} · ${t.skippedToday}`
                            : activity.done
                              ? `+${POINTS_PER_ACTIVITY} ${t.pointsUnit}${activity.bonus ? ` · +${activity.bonus} ${t.bonusLabel}` : ""}`
                              : `+${POINTS_PER_ACTIVITY} ${t.pointsUnit}`}
                        </span>
                      </div>
                      <form
                        action={finishActivity}
                        className="activity-actions"
                        aria-label={t.activityActionsAria(activity.name)}
                      >
                        <input
                          type="hidden"
                          name="activityId"
                          value={activity.id}
                        />
                        <Submit
                          disabled={activity.done || activity.skipped}
                          locale={locale}
                        >
                          {activity.done
                            ? t.doneBtn
                            : activity.skipped
                              ? t.skippedBtn
                              : t.completeBtn}
                        </Submit>
                        {!activity.done && !activity.skipped && (
                          <Submit
                            formAction={passActivity}
                            className="skip-activity"
                            locale={locale}
                          >
                            {t.skipBtn(SKIP_PENALTY)}
                          </Submit>
                        )}
                      </form>
                    </li>
                  ))}
                </ul>
                <form
                  className="inline-form"
                  action={createActivity}
                  aria-labelledby={`add-${routine.id}`}
                >
                  <input type="hidden" name="routineId" value={routine.id} />
                  <h4 id={`add-${routine.id}`}>{t.addActivityTitle}</h4>
                  <ActivityFields
                    prefix={`activity-${routine.id}`}
                    routineWeekdays={routine.weekdays}
                    today={dayKey(now)}
                    locale={locale}
                  />
                  <Submit locale={locale}>{t.addBtn}</Submit>
                </form>
              </section>
            ))}
            <form
              className="new-routine"
              action={createRoutine}
              aria-labelledby="new-title"
            >
              <h3 id="new-title">{t.newRoutineTitle}</h3>
              <RoutineFields prefix="home-new" locale={locale} />
              <Submit locale={locale}>{t.createRoutineBtn}</Submit>
            </form>
          </section>
          <aside aria-labelledby="pet-title">
            <div className="pet-home">
              <div className="pet-label">
                <h2 id="pet-title">{t.companionTitle}</h2>
                <span className={`mood mood-${data.mood}`}>{moodBadge}</span>
              </div>
              <div className="pet-scene">
                <Pet mood={data.mood} kind={data.petKind} locale={locale} />
                <div className="ground" />
              </div>
              <h3>{t.moodCopy[data.mood]}</h3>
              <p>
                {data.total === 0 ? t.petEmptyHint : t.petActiveHint}
              </p>
            </div>
            <section className="daily" aria-labelledby="today-title">
              <div className="section-title">
                <h2 id="today-title">{t.dailyTitle}</h2>
                <strong>{progress}%</strong>
              </div>
              <progress
                value={data.done}
                max={Math.max(data.total, 1)}
                aria-label={t.dailyProgressAria}
              />
              <p>{t.dailyCount(data.done, data.total)}</p>
              <small>{t.dailyResetNote}</small>
            </section>
            <section className="streak" aria-labelledby="streak-title">
              <h2 id="streak-title">{t.streakTitle}</h2>
              <strong>
                {data.streak}{" "}
                {data.streak === 1 ? t.daySingular : t.dayPlural}
              </strong>
              <p>{t.streakExplain(POINTS_PER_ACTIVITY, MAX_STREAK_BONUS)}</p>
              <p>{t.streakSkipExplain(SKIP_PENALTY)}</p>
            </section>
            <p className="gentle">
              {t.gentleLine1}
              <br />
              {t.gentleLine2}
            </p>
          </aside>
        </div>
        <section className="points-history" aria-labelledby="history-title">
          <h2 id="history-title">{t.historyTitle}</h2>
          <p className="hint">{t.historyHint(SKIP_PENALTY)}</p>
          {data.history.length === 0 ? (
            <p className="hint">{t.historyEmpty}</p>
          ) : (
            <ol>
              {data.history.map((event) => {
                const [, month, day] = event.day.split("-");
                const formattedEventDay =
                  locale === "en"
                    ? `${month}/${day}/${event.day.slice(0, 4)}`
                    : event.day.split("-").reverse().join("/");
                return (
                  <li key={event.id}>
                    <div>
                      <time dateTime={event.day}>{formattedEventDay}</time>
                      <strong>{event.activityName}</strong>
                      <span>
                        {event.status === "completed"
                          ? t.statusCompleted
                          : t.statusSkipped}
                      </span>
                    </div>
                    <div className="point-change">
                      <span>
                        {event.points >= 0 ? "+" : ""}
                        {event.points} {t.pointsUnit}
                      </span>
                      {event.bonus > 0 && (
                        <span>
                          +{event.bonus} {t.streakBonusEntry}
                        </span>
                      )}
                      <small>
                        {t.balanceLabel}:{" "}
                        {event.balanceAfter.toLocaleString(dateLocale)}
                      </small>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </section>
      </main>
      <footer>
        {dict.common.brandName} <span>{dict.common.tagline}</span>
      </footer>
    </>
  );
}
