import { authenticatedId, type CurrentUser } from "../auth/contracts";
import { randomUUID } from "node:crypto";
import { and, asc, desc, eq, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "../db/client";
import { activities, completions, routines, userSettings } from "../db/schema";
import { isPetKind, DEFAULT_PET_KIND, type PetKind } from "./pets";
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
  activityScheduledOn,
  precomputeScheduledDays,
  validActivitySchedule,
} from "./rules";

export function userLedgerLock(user: CurrentUser) {
  const userId = authenticatedId(user);
  return sql`select pg_advisory_xact_lock(hashtextextended(${userId}, 724681))`;
}

async function scheduleWrite<T>(
  db: Database,
  user: CurrentUser,
  work: (tx: Database) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(userLedgerLock(user));
    return work(tx);
  });
}

async function userSchedules(db: Database, userId: string) {
  return db
    .select({
      weekdays: activities.weekdays,
      onceDate: activities.onceDate,
      routineWeekdays: routines.weekdays,
    })
    .from(activities)
    .innerJoin(routines, eq(activities.routineId, routines.id))
    .where(
      and(
        eq(activities.userId, userId),
        eq(routines.userId, userId),
        isNull(activities.archivedAt),
        isNull(routines.archivedAt),
      ),
    );
}

export async function addRoutine(
  db: Database,
  user: CurrentUser,
  name: unknown,
  days: unknown = ALL_WEEKDAYS,
) {
  const userId = authenticatedId(user);
  return scheduleWrite(db, user, async (db) => {
    const row = {
      id: randomUUID(),
      userId,
      name: validName(name),
      weekdays: weekdaysMask(days),
      archivedAt: null,
      createdAt: new Date(),
    };
    await db.insert(routines).values(row);
    return row;
  });
}

export async function updateRoutine(
  db: Database,
  user: CurrentUser,
  routineId: unknown,
  name: unknown,
  days: unknown,
) {
  const userId = authenticatedId(user);
  return scheduleWrite(db, user, async (db) => {
    const id = validId(routineId);
    const values = { name: validName(name), weekdays: weekdaysMask(days) };
    const rows = await db
      .update(routines)
      .set(values)
      .where(
        and(
          eq(routines.id, id),
          eq(routines.userId, userId),
          isNull(routines.archivedAt),
        ),
      )
      .returning();
    if (!rows.length)
      throw new InputError("Rotina ativa não encontrada. Atualize a página.");
    return rows[0];
  });
}

export async function archiveRoutine(
  db: Database,
  user: CurrentUser,
  routineId: unknown,
) {
  const userId = authenticatedId(user);
  return scheduleWrite(db, user, async (db) => {
    const id = validId(routineId);
    const rows = await db
      .update(routines)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(routines.id, id),
          eq(routines.userId, userId),
          isNull(routines.archivedAt),
        ),
      )
      .returning();
    if (!rows.length)
      throw new InputError("Rotina ativa não encontrada. Atualize a página.");
  });
}

const activeParent = (userId: string) =>
  sql`exists (select 1 from ${routines} where ${routines.id} = ${activities.routineId} and ${routines.userId} = ${userId} and ${routines.archivedAt} is null for share)`;

export async function addActivity(
  db: Database,
  user: CurrentUser,
  routineId: unknown,
  name: unknown,
  time: unknown = null,
  scheduleInput?: unknown,
) {
  const userId = authenticatedId(user);
  const id = validId(routineId);
  const activityName = validName(name),
    scheduledTime = validTime(time);
  const schedule = validActivitySchedule(scheduleInput);
  return scheduleWrite(db, user, async (db) => {
    const [parent] = await db
      .select({ id: routines.id })
      .from(routines)
      .where(
        and(
          eq(routines.id, id),
          eq(routines.userId, userId),
          isNull(routines.archivedAt),
        ),
      )
      .limit(1)
      .for("share");
    if (!parent)
      throw new InputError(
        "Rotina ativa n\u00e3o encontrada. Atualize a p\u00e1gina.",
      );
    const [row] = await db
      .insert(activities)
      .values({
        id: randomUUID(),
        userId,
        routineId: id,
        name: activityName,
        scheduledTime,
        ...schedule,
      })
      .returning();
    return row;
  });
}

export async function updateActivity(
  db: Database,
  user: CurrentUser,
  activityId: unknown,
  name: unknown,
  time: unknown,
  scheduleInput?: unknown,
) {
  const userId = authenticatedId(user);
  return scheduleWrite(db, user, async (db) => {
    const id = validId(activityId);
    const values = {
      name: validName(name),
      scheduledTime: validTime(time),
      ...(scheduleInput === undefined
        ? {}
        : validActivitySchedule(scheduleInput)),
    };
    const rows = await db
      .update(activities)
      .set(values)
      .where(
        and(
          eq(activities.id, id),
          eq(activities.userId, userId),
          isNull(activities.archivedAt),
          activeParent(userId),
        ),
      )
      .returning();
    if (!rows.length)
      throw new InputError(
        "Atividade ativa não encontrada. Atualize a página.",
      );
    return rows[0];
  });
}

export async function archiveActivity(
  db: Database,
  user: CurrentUser,
  activityId: unknown,
) {
  const userId = authenticatedId(user);
  return scheduleWrite(db, user, async (db) => {
    const id = validId(activityId);
    const rows = await db
      .update(activities)
      .set({ archivedAt: new Date() })
      .where(
        and(
          eq(activities.id, id),
          eq(activities.userId, userId),
          isNull(activities.archivedAt),
          activeParent(userId),
        ),
      )
      .returning();
    if (!rows.length)
      throw new InputError(
        "Atividade ativa não encontrada. Atualize a página.",
      );
  });
}

export async function completeActivity(
  db: Database,
  user: CurrentUser,
  activityId: unknown,
  now = new Date(),
) {
  authenticatedId(user);
  return recordActivity(db, user, activityId, "completed", now);
}

export async function skipActivity(
  db: Database,
  user: CurrentUser,
  activityId: unknown,
  now = new Date(),
) {
  authenticatedId(user);
  return recordActivity(db, user, activityId, "skipped", now);
}

async function recordActivity(
  db: Database,
  user: CurrentUser,
  activityId: unknown,
  status: "completed" | "skipped",
  now: Date,
) {
  const userId = authenticatedId(user);
  const id = validId(activityId);
  const day = dayKey(now);
  return db.transaction(
    async (tx) => {
      // O lock pertence ao usuário. Colisões de hash só causam espera adicional.
      await tx.execute(userLedgerLock(user));
      const [activity] = await tx
        .select({
          id: activities.id,
          weekdays: activities.weekdays,
          onceDate: activities.onceDate,
          routineWeekdays: routines.weekdays,
        })
        .from(activities)
        .innerJoin(routines, eq(activities.routineId, routines.id))
        .where(
          and(
            eq(activities.id, id),
            eq(activities.userId, userId),
            eq(routines.userId, userId),
            isNull(activities.archivedAt),
            isNull(routines.archivedAt),
          ),
        )
        .for("share", { of: [activities, routines] })
        .limit(1);
      if (
        !activity ||
        !activityScheduledOn(activity, activity.routineWeekdays, day)
      )
        throw new InputError(
          "Atividade indisponível hoje ou arquivada. Atualize a página.",
        );
      const [existing] = await tx
        .select({ status: completions.status })
        .from(completions)
        .where(
          and(
            eq(completions.userId, userId),
            eq(completions.activityId, id),
            eq(completions.day, day),
          ),
        )
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
          and(
            eq(completions.userId, userId),
            eq(completions.status, "completed"),
            lte(completions.day, day),
          ),
        );
      const schedules = await userSchedules(tx, userId);
      const scheduled = precomputeScheduledDays(schedules);
      const bonus =
        status === "completed"
          ? Math.min(
              currentStreak(
                [...days.map((row) => row.day), day],
                day,
                scheduled,
              ) - 1,
              MAX_STREAK_BONUS,
            )
          : 0;
      const [last] = await tx
        .select({
          balance: completions.balanceAfter,
          order: completions.eventOrder,
        })
        .from(completions)
        .where(eq(completions.userId, userId))
        .orderBy(desc(completions.eventOrder))
        .limit(1);
      const points =
        status === "completed" ? POINTS_PER_ACTIVITY : -SKIP_PENALTY;
      const inserted = await tx
        .insert(completions)
        .values({
          id: randomUUID(),
          userId,
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

const activeParentOwned = (userId: string) =>
  sql`exists (select 1 from ${routines} where ${routines.id} = ${activities.routineId} and ${routines.userId} = ${userId})`;

export async function catalog(db: Database, user: CurrentUser) {
  const userId = authenticatedId(user);
  const [routineRows, activityRows] = await Promise.all([
    db
      .select()
      .from(routines)
      .where(eq(routines.userId, userId))
      .orderBy(asc(routines.createdAt), asc(routines.id)),
    db
      .select()
      .from(activities)
      .where(and(eq(activities.userId, userId), activeParentOwned(userId)))
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

export async function dashboard(
  db: Database,
  user: CurrentUser,
  now = new Date(),
) {
  const userId = authenticatedId(user);
  const dayBit = 1 << weekdaySP(now);
  const activeToday = and(
    eq(routines.userId, userId),
    isNull(routines.archivedAt),
  );
  const [
    routineRows,
    activityRows,
    today,
    score,
    completedDays,
    history,
    currentPet,
  ] = await Promise.all([
    db
      .select()
      .from(routines)
      .where(activeToday)
      .orderBy(asc(routines.createdAt), asc(routines.id)),
    db
      .select({ activity: activities, routineWeekdays: routines.weekdays })
      .from(activities)
      .innerJoin(routines, eq(activities.routineId, routines.id))
      .where(
        and(
          activeToday,
          eq(activities.userId, userId),
          isNull(activities.archivedAt),
        ),
      )
      .orderBy(
        sql`coalesce(${activities.scheduledTime}, '99:99')`,
        asc(activities.createdAt),
        asc(activities.id),
      ),
    db
      .select()
      .from(completions)
      .where(
        and(eq(completions.userId, userId), eq(completions.day, dayKey(now))),
      ),
    db
      .select({ value: completions.balanceAfter })
      .from(completions)
      .where(eq(completions.userId, userId))
      .orderBy(desc(completions.eventOrder))
      .limit(1),
    db
      .selectDistinct({ day: completions.day })
      .from(completions)
      .where(
        and(
          eq(completions.userId, userId),
          eq(completions.status, "completed"),
          lte(completions.day, dayKey(now)),
        ),
      ),
    db
      .select({ event: completions, activityName: activities.name })
      .from(completions)
      .innerJoin(activities, eq(completions.activityId, activities.id))
      .where(and(eq(completions.userId, userId), eq(activities.userId, userId)))
      .orderBy(desc(completions.eventOrder))
      .limit(30),
    getUserPet(db, user),
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
  const activeActivities = activityRows
    .filter((row) =>
      activityScheduledOn(row.activity, row.routineWeekdays, dayKey(now)),
    )
    .map((row) => row.activity);
  const done = activeActivities.filter((row) => completed.has(row.id)).length;
  const scheduled = precomputeScheduledDays(
    activityRows.map(({ activity, routineWeekdays }) => ({
      weekdays: activity.weekdays,
      onceDate: activity.onceDate,
      routineWeekdays,
    })),
  );
  return {
    routines: routineRows
      .filter(
        (routine) =>
          activeActivities.some(
            (activity) => activity.routineId === routine.id,
          ) ||
          ((routine.weekdays & dayBit) !== 0 &&
            !activityRows.some((row) => row.activity.routineId === routine.id)),
      )
      .map((routine) => ({
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
      scheduled,
    ),
    history: history.map((row) => ({
      ...row.event,
      activityName: row.activityName,
    })),
    mood: petMood(done, activeActivities.length),
    petKind: currentPet,
  };
}

export async function getUserPet(
  db: Database,
  user: CurrentUser,
): Promise<PetKind> {
  const userId = authenticatedId(user);
  const rows = await db
    .select({ petKind: userSettings.petKind })
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  if (!rows.length) return DEFAULT_PET_KIND;
  const kind = rows[0].petKind;
  return isPetKind(kind) ? kind : DEFAULT_PET_KIND;
}

export async function setUserPet(
  db: Database,
  user: CurrentUser,
  petKind: unknown,
): Promise<PetKind> {
  const userId = authenticatedId(user);
  if (!isPetKind(petKind)) {
    throw new InputError("Pet inválido. Escolha um companheiro do catálogo.");
  }

  await db
    .insert(userSettings)
    .values({
      userId,
      petKind,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: {
        petKind,
        updatedAt: new Date(),
      },
    });

  return petKind;
}
