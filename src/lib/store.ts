import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "../db/client";
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
    createdAt: new Date(),
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
    .set({ archivedAt: new Date() })
    .where(and(eq(routines.id, id), isNull(routines.archivedAt)))
    .returning();
  if (!rows.length)
    throw new InputError("Rotina ativa não encontrada. Atualize a página.");
}

const activeParent = sql`exists (select 1 from ${routines} where ${routines.id} = ${activities.routineId} and ${routines.archivedAt} is null for share)`;

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
          id: sql<string>`${randomUUID()}::uuid`.as("id"),
          routineId: routines.id,
          name: sql<string>`${activityName}`.as("name"),
          scheduledTime: sql<string | null>`${scheduledTime}::text`.as(
            "scheduled_time",
          ),
          archivedAt: sql<Date | null>`null::timestamptz`.as("archived_at"),
          createdAt: sql<Date>`now()`.as("created_at"),
        })
        .from(routines)
        .where(and(eq(routines.id, id), isNull(routines.archivedAt)))
        .for("share", { of: routines }),
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
    .set({ archivedAt: new Date() })
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
  const day = dayKey(now);
  const dayBit = 1 << weekdaySP(now);
  return db.transaction(
    async (tx) => {
      // Lock transacional global enquanto não há login; serializa saldo e bônus entre instâncias.
      await tx.execute(sql`select pg_advisory_xact_lock(724681, 1)`);
      const [activity] = await tx
        .select({ id: activities.id })
        .from(activities)
        .innerJoin(routines, eq(activities.routineId, routines.id))
        .where(
          and(
            eq(activities.id, id),
            isNull(activities.archivedAt),
            isNull(routines.archivedAt),
            sql`(${routines.weekdays} & ${dayBit}) != 0`,
          ),
        )
        .for("share", { of: [activities, routines] })
        .limit(1);
      if (!activity)
        throw new InputError(
          "Atividade indisponível hoje ou arquivada. Atualize a página.",
        );
      const [existing] = await tx
        .select({ status: completions.status })
        .from(completions)
        .where(and(eq(completions.activityId, id), eq(completions.day, day)))
        .limit(1);
      if (existing) {
        if (existing.status === status) return false;
        throw new InputError(
          existing.status === "completed"
            ? "Atividade já concluída hoje. Não é possível pular no mesmo dia."
            : "Atividade já pulada hoje. Não é possível concluir no mesmo dia.",
        );
      }
      const days = await tx
        .selectDistinct({ day: completions.day })
        .from(completions)
        .where(
          and(eq(completions.status, "completed"), lte(completions.day, day)),
        );
      const bonus =
        status === "completed"
          ? Math.min(
              currentStreak([...days.map((row) => row.day), day], day) - 1,
              MAX_STREAK_BONUS,
            )
          : 0;
      const [last] = await tx
        .select({
          balance: completions.balanceAfter,
          order: completions.eventOrder,
        })
        .from(completions)
        .orderBy(desc(completions.eventOrder))
        .limit(1);
      const points =
        status === "completed" ? POINTS_PER_ACTIVITY : -SKIP_PENALTY;
      const inserted = await tx
        .insert(completions)
        .values({
          id: randomUUID(),
          activityId: id,
          day,
          points,
          status,
          bonus,
          eventOrder: (last?.order ?? 0) + 1,
          balanceAfter: Math.max(0, (last?.balance ?? 0) + points + bonus),
        })
        .onConflictDoNothing({
          target: [completions.activityId, completions.day],
        })
        .returning({ id: completions.id });
      return inserted.length > 0;
    },
    { isolationLevel: "read committed" },
  );
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
        .limit(1),
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
    points: Number(score[0]?.value ?? 0),
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
