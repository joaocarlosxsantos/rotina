import type { Metadata } from "next";
import { requireCurrentUser } from "../../auth/server";
import { getDatabase } from "../../db/client";
import { getDictionary, WEEKDAYS_BY_LOCALE } from "../../lib/i18n";
import { getLocale } from "../../lib/i18n-server";
import { dayKey, maskDays, scheduleSummary } from "../../lib/rules";
import { catalog } from "../../lib/store";
import {
  createActivity,
  createRoutine,
  editActivity,
  editRoutine,
} from "../actions";
import { ArchiveForm } from "../archive-form";
import { Header } from "../header";
import { ActivityFields, RoutineFields } from "../routine-fields";
import { Submit } from "../submit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  return { title: getDictionary(locale).meta.routinesTitle };
}

export default async function Manage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const user = await requireCurrentUser();
  const locale = await getLocale();
  const dict = getDictionary(locale);
  const t = dict.manage;
  const weekdays = WEEKDAYS_BY_LOCALE[locale];
  const today = dayKey();
  const rows = await catalog(await getDatabase(), user);
  const query = await searchParams;
  const active = rows.filter((row) => row.archivedAt === null);
  const archived = rows.filter((row) => row.archivedAt !== null);

  return (
    <>
      <a className="skip" href="#gerenciar">
        {t.skipLink}
      </a>
      <Header active="rotinas" user={user} locale={locale} />
      <main className="manage" id="gerenciar">
        <div className="manage-intro">
          <h1>{t.title}</h1>
          <p>{t.subtitle}</p>
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
        <section aria-labelledby="active-title">
          <h2 id="active-title">{t.activeTitle}</h2>
          {active.length === 0 && <p className="empty">{t.emptyActive}</p>}
          {active.map((routine) => (
            <section
              className="routine managed-routine"
              key={routine.id}
              aria-labelledby={`routine-${routine.id}`}
            >
              <h3 id={`routine-${routine.id}`}>{routine.name}</h3>
              <p className="schedule">
                {maskDays(routine.weekdays)
                  .map((day) => weekdays[day])
                  .join(" · ")}
              </p>
              <details className="edit-panel">
                <summary>{t.editRoutineSummary(routine.name)}</summary>
                <form
                  action={editRoutine}
                  aria-label={t.editRoutineAria(routine.name)}
                >
                  <input type="hidden" name="routineId" value={routine.id} />
                  <input type="hidden" name="returnTo" value="/rotinas" />
                  <RoutineFields
                    prefix={`edit-${routine.id}`}
                    name={routine.name}
                    days={maskDays(routine.weekdays)}
                    locale={locale}
                  />
                  <Submit locale={locale}>{t.saveRoutine}</Submit>
                </form>
              </details>
              <ul className="managed-activities">
                {routine.activities
                  .filter((activity) => activity.archivedAt === null)
                  .map((activity) => (
                    <li key={activity.id}>
                      <div className="managed-activity">
                        <h4>{activity.name}</h4>
                        <span className="activity-schedule">
                          {scheduleSummary(activity, routine.weekdays, locale)}
                          {activity.onceDate && activity.onceDate < today
                            ? t.pastDateTag
                            : ""}
                        </span>
                        <p className="schedule">
                          {activity.scheduledTime
                            ? `${activity.scheduledTime} · São Paulo`
                            : t.noTimeSet}
                        </p>
                        <details className="edit-panel">
                          <summary>
                            {t.editActivitySummary(activity.name)}
                          </summary>
                          <form
                            action={editActivity}
                            aria-label={t.editActivityAria(activity.name)}
                          >
                            <input
                              type="hidden"
                              name="activityId"
                              value={activity.id}
                            />
                            <input
                              type="hidden"
                              name="returnTo"
                              value="/rotinas"
                            />
                            <ActivityFields
                              prefix={`edit-${activity.id}`}
                              name={activity.name}
                              time={activity.scheduledTime}
                              routineWeekdays={routine.weekdays}
                              schedule={{
                                weekdays: activity.weekdays,
                                onceDate: activity.onceDate,
                              }}
                              today={today}
                              locale={locale}
                            />
                            <Submit locale={locale}>{t.saveActivity}</Submit>
                          </form>
                        </details>
                        <ArchiveForm
                          kind="activity"
                          id={activity.id}
                          name={activity.name}
                          locale={locale}
                        />
                      </div>
                    </li>
                  ))}
              </ul>
              <details className="edit-panel">
                <summary>{t.addActivitySummary(routine.name)}</summary>
                <form
                  action={createActivity}
                  aria-label={t.addActivityAria(routine.name)}
                >
                  <input type="hidden" name="routineId" value={routine.id} />
                  <input type="hidden" name="returnTo" value="/rotinas" />
                  <ActivityFields
                    prefix={`new-${routine.id}`}
                    routineWeekdays={routine.weekdays}
                    today={today}
                    locale={locale}
                  />
                  <Submit locale={locale}>{t.addActivityBtn}</Submit>
                </form>
              </details>
              <ArchiveForm
                kind="routine"
                id={routine.id}
                name={routine.name}
                locale={locale}
              />
              {routine.activities.some(
                (activity) => activity.archivedAt !== null,
              ) && (
                <details className="archived-list">
                  <summary>{t.archivedActivitiesSummary}</summary>
                  <ul>
                    {routine.activities
                      .filter((activity) => activity.archivedAt !== null)
                      .map((activity) => (
                        <li key={activity.id}>
                          {activity.name}
                          {activity.scheduledTime
                            ? ` · ${activity.scheduledTime}`
                            : ""}{" "}
                          {t.archivedSuffix}
                        </li>
                      ))}
                  </ul>
                </details>
              )}
            </section>
          ))}
        </section>
        <form
          className="new-routine"
          action={createRoutine}
          aria-labelledby="new-title"
        >
          <h2 id="new-title">{t.createRoutineTitle}</h2>
          <input type="hidden" name="returnTo" value="/rotinas" />
          <RoutineFields prefix="manage-new" locale={locale} />
          <Submit locale={locale}>{t.createRoutineBtn}</Submit>
        </form>
        <section className="archive-section" aria-labelledby="archived-title">
          <h2 id="archived-title">{t.archivedTitle}</h2>
          <p className="hint">{t.archivedHint}</p>
          {archived.length === 0 ? (
            <p className="hint">{t.noArchived}</p>
          ) : (
            <ul>
              {archived.map((routine) => (
                <li key={routine.id}>
                  <h3>{routine.name}</h3>
                  <p className="schedule">
                    {maskDays(routine.weekdays)
                      .map((day) => weekdays[day])
                      .join(" · ")}
                  </p>
                  <ul>
                    {routine.activities.map((activity) => (
                      <li key={activity.id}>
                        {activity.name}
                        {activity.scheduledTime
                          ? ` · ${activity.scheduledTime}`
                          : ""}
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
      <footer>
        {dict.common.brandName} <span>{dict.common.tagline}</span>
      </footer>
    </>
  );
}
