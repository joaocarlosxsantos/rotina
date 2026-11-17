import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";
import type { createDatabase } from "../db/client";
import { activities, completions, routines } from "../db/schema";
import {
  ALL_WEEKDAYS,
  dayKey,
  currentStreak,
  InputError,
  MAX_STREAK_BONUS,
  petMood,
  POINTS_PER_ACTIVITY,
  SKIP_PENALTY,
  validId,
  validName,
  validTime,
  weekdaySP,
  weekdaysMask,
} from "./rules";

type Database = ReturnType<typeof createDatabase>["db"];

export async function addRoutine(
  db: Database,
  name: unknown,
  days: unknown = ALL_WEEKDAYS,
) {
  const row = {
    id: randomUUID(),
    name: validName(name),
    weekdays: weekdaysMask(days),
    archivedAt: null,
    createdAt: Date.now(),
  };
  await db.insert(routines).values(row);
  return row;
}

export async function updateRoutine(
  db: Database,
  routineId: unknown,
  name: unknown,
  days: unknown,
) {
  const id = validId(routineId);
  const values = { name: validName(name), weekdays: weekdaysMask(days) };
  const rows = await db
    .update(routines)
    .set(values)
    .where(and(eq(routines.id, id), isNull(routines.archivedAt)))
    .returning();
  if (!rows.length)
    throw new InputError("Rotina ativa não encontrada. Atualize a página.");
  return rows[0];
}

export async function archiveRoutine(db: Database, routineId: unknown) {
  const id = validId(routineId);
  const rows = await db
    .update(routines)
    .set({ archivedAt: Date.now() })
    .where(and(eq(routines.id, id), isNull(routines.archivedAt)))
    .returning();
  if (!rows.length)
    throw new InputError("Rotina ativa não encontrada. Atualize a página.");
}

const activeParent = sql`exists (select 1 from ${routines} where ${routines.id} = ${activities.routineId} and ${routines.archivedAt} is null)`;

export async function addActivity(
  db: Database,
  routineId: unknown,
  name: unknown,
  time: unknown = null,
) {
  const id = validId(routineId);
  const activityName = validName(name);
  const scheduledTime = validTime(time);
  // A condição de pai ativo faz parte da própria escrita.
  const rows = await db
    .insert(activities)
    .select(
      db
        .select({
          id: sql<string>`${randomUUID()}`.as("id"),
          routineId: routines.id,
          name: sql<string>`${activityName}`.as("name"),
          scheduledTime: sql<string | null>`${scheduledTime}`.as(
            "scheduled_time",
          ),
          archivedAt: sql<null>`null`.as("archived_at"),
          createdAt: sql<number>`${Date.now()}`.as("created_at"),
        })
        .from(routines)
        .where(and(eq(routines.id, id), isNull(routines.archivedAt))),
    )
    .returning();
  if (!rows.length)
    throw new InputError("Rotina ativa não encontrada. Atualize a página.");
  return rows[0];
}

export async function updateActivity(
  db: Database,
  activityId: unknown,
  name: unknown,
  time: unknown,
) {
  const id = validId(activityId);
  const values = { name: validName(name), scheduledTime: validTime(time) };
  const rows = await db
    .update(activities)
    .set(values)
    .where(
      and(eq(activities.id, id), isNull(activities.archivedAt), activeParent),
    )
    .returning();
  if (!rows.length)
    throw new InputError("Atividade ativa não encontrada. Atualize a página.");
  return rows[0];
}

export async function archiveActivity(db: Database, activityId: unknown) {
  const id = validId(activityId);
  const rows = await db
    .update(activities)
    .set({ archivedAt: Date.now() })
    .where(
      and(eq(activities.id, id), isNull(activities.archivedAt), activeParent),
    )
    .returning();
  if (!rows.length)
    throw new InputError("Atividade ativa não encontrada. Atualize a página.");
}

export async function completeActivity(
  db: Database,
  activityId: unknown,
  now = new Date(),
) {
  return recordActivity(db, activityId, "completed", now);
}

export async function skipActivity(
  db: Database,
  activityId: unknown,
  now = new Date(),
) {
  return recordActivity(db, activityId, "skipped", now);
}

async function recordActivity(
  db: Database,
  activityId: unknown,
  status: "completed" | "skipped",
  now: Date,
) {
  const id = validId(activityId);
  const dayBit = 1 << weekdaySP(now);
  const day = dayKey(now);
  const points = status === "completed" ? POINTS_PER_ACTIVITY : -SKIP_PENALTY;
  // Só os cinco dias anteriores importam para o teto do bônus. A leitura é parte do INSERT.
  const bonus =
    status === "skipped"
      ? sql<number>`0`
      : sql<number>`(
    with recursive consecutive(day, count) as (
      select date(${day}, '-1 day'), 0
      union all
      select date(day, '-1 day'), count + 1 from consecutive
      where count < ${MAX_STREAK_BONUS} and exists (
        select 1 from ${completions} history
        where history.day = consecutive.day and history.status = 'completed'
      )
    ) select max(count) from consecutive
  )`;
  const nextOrder = sql<number>`(select coalesce(max(event_order), 0) + 1 from ${completions})`;
  const previousBalance = sql<number>`coalesce((select balance_after from ${completions} order by event_order desc limit 1), 0)`;
  const eligible = and(
    eq(activities.id, id),
    isNull(activities.archivedAt),
    isNull(routines.archivedAt),
    sql`(${routines.weekdays} & ${dayBit}) != 0`,
  );
  // Agenda, exclusividade, bônus e saldo são verificados na mesma escrita atômica.
  const inserted = await db
    .insert(completions)
    .select(
      db
        .select({
          id: sql<string>`${randomUUID()}`.as("id"),
          activityId: activities.id,
          day: sql<string>`${day}`.as("day"),
          points: sql<number>`${points}`.as("points"),
          status: sql<"completed" | "skipped">`${status}`.as("status"),
          bonus: bonus.as("bonus"),
          eventOrder: nextOrder.as("event_order"),
          balanceAfter:
            sql<number>`max(0, ${previousBalance} + ${points} + ${bonus})`.as(
              "balance_after",
            ),
        })
        .from(activities)
        .innerJoin(routines, eq(activities.routineId, routines.id))
        .where(eligible),
    )
    .onConflictDoNothing({ target: [completions.activityId, completions.day] })
    .returning();
  if (inserted.length) return true;
  const activity = await db
    .select({ id: activities.id })
    .from(activities)
    .innerJoin(routines, eq(activities.routineId, routines.id))
    .where(eligible)
    .get();
  if (!activity)
    throw new InputError(
      "Atividade indisponível hoje ou arquivada. Atualize a página.",
    );
  const existing = await db
    .select({ status: completions.status })
    .from(completions)
    .where(and(eq(completions.activityId, id), eq(completions.day, day)))
    .get();
  if (existing && existing.status !== status) {
    throw new InputError(
      existing.status === "completed"
        ? "Atividade já concluída hoje. Não é possível pular no mesmo dia."
        : "Atividade já pulada hoje. Não é possível concluir no mesmo dia.",
    );
  }
  return false;
}

export async function catalog(db: Database) {
  const [routineRows, activityRows] = await Promise.all([
    db
      .select()
      .from(routines)
      .orderBy(asc(routines.createdAt), asc(routines.id)),
    db
      .select()
      .from(activities)
      .orderBy(
        sql`coalesce(${activities.scheduledTime}, '99:99')`,
        asc(activities.createdAt),
        asc(activities.id),
      ),
  ]);
  return routineRows.map((routine) => ({
    ...routine,
    activities: activityRows.filter((row) => row.routineId === routine.id),
  }));
}

export async function dashboard(db: Database, now = new Date()) {
  const dayBit = 1 << weekdaySP(now);
  const activeToday = and(
    isNull(routines.archivedAt),
    sql`(${routines.weekdays} & ${dayBit}) != 0`,
  );
  const [routineRows, activityRows, today, score, completedDays, history] =
    await Promise.all([
      db
        .select()
        .from(routines)
        .where(activeToday)
        .orderBy(asc(routines.createdAt), asc(routines.id)),
      db
        .select({ activity: activities })
        .from(activities)
        .innerJoin(routines, eq(activities.routineId, routines.id))
        .where(and(activeToday, isNull(activities.archivedAt)))
        .orderBy(
          sql`coalesce(${activities.scheduledTime}, '99:99')`,
          asc(activities.createdAt),
          asc(activities.id),
        ),
      db
        .select()
        .from(completions)
        .where(eq(completions.day, dayKey(now))),
      db
        .select({ value: completions.balanceAfter })
        .from(completions)
        .orderBy(desc(completions.eventOrder))
        .get(),
      db
        .selectDistinct({ day: completions.day })
        .from(completions)
        .where(
          and(
            eq(completions.status, "completed"),
            lte(completions.day, dayKey(now)),
          ),
        ),
      db
        .select({ event: completions, activityName: activities.name })
        .from(completions)
        .innerJoin(activities, eq(completions.activityId, activities.id))
        .orderBy(desc(completions.eventOrder))
        .limit(30),
    ]);
  const completed = new Set(
    today
      .filter((row) => row.status === "completed")
      .map((row) => row.activityId),
  );
  const skipped = new Set(
    today
      .filter((row) => row.status === "skipped")
      .map((row) => row.activityId),
  );
  const todayBonus = new Map(today.map((row) => [row.activityId, row.bonus]));
  const activeActivities = activityRows.map((row) => row.activity);
  const done = activeActivities.filter((row) => completed.has(row.id)).length;
  return {
    routines: routineRows.map((routine) => ({
      ...routine,
      activities: activeActivities
        .filter((row) => row.routineId === routine.id)
        .map((row) => ({
          ...row,
          done: completed.has(row.id),
          skipped: skipped.has(row.id),
          bonus: todayBonus.get(row.id) ?? 0,
        })),
    })),
    done,
    total: activeActivities.length,
    points: Number(score?.value ?? 0),
    streak: currentStreak(
      completedDays.map((row) => row.day),
      dayKey(now),
    ),
    history: history.map((row) => ({
      ...row.event,
      activityName: row.activityName,
    })),
    mood: petMood(done, activeActivities.length),
  };
}
