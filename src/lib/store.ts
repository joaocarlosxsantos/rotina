import { randomUUID } from "node:crypto";
import { asc, eq, sql } from "drizzle-orm";
import type { createDatabase } from "../db/client";
import { activities, completions, routines } from "../db/schema";
import {
  dayKey,
  InputError,
  petMood,
  POINTS_PER_ACTIVITY,
  validId,
  validName,
} from "./rules";

type Database = ReturnType<typeof createDatabase>["db"];

export async function addRoutine(db: Database, name: unknown) {
  const row = {
    id: randomUUID(),
    name: validName(name),
    createdAt: Date.now(),
  };
  await db.insert(routines).values(row);
  return row;
}

export async function addActivity(
  db: Database,
  routineId: unknown,
  name: unknown,
) {
  const id = validId(routineId);
  const activityName = validName(name);
  const parent = await db
    .select({ id: routines.id })
    .from(routines)
    .where(eq(routines.id, id))
    .get();
  if (!parent)
    throw new InputError("Rotina não encontrada. Atualize a página.");
  const row = {
    id: randomUUID(),
    routineId: id,
    name: activityName,
    createdAt: Date.now(),
  };
  await db.insert(activities).values(row);
  return row;
}

export async function completeActivity(
  db: Database,
  activityId: unknown,
  now = new Date(),
) {
  const id = validId(activityId);
  const activity = await db
    .select({ id: activities.id })
    .from(activities)
    .where(eq(activities.id, id))
    .get();
  if (!activity)
    throw new InputError("Atividade não encontrada. Atualize a página.");
  // A restrição única é a autoridade contra cliques concorrentes e replay.
  const inserted = await db
    .insert(completions)
    .values({
      id: randomUUID(),
      activityId: id,
      day: dayKey(now),
      points: POINTS_PER_ACTIVITY,
    })
    .onConflictDoNothing({ target: [completions.activityId, completions.day] })
    .returning();
  return inserted.length > 0;
}

export async function dashboard(db: Database, now = new Date()) {
  const [routineRows, activityRows, today, score] = await Promise.all([
    db
      .select()
      .from(routines)
      .orderBy(asc(routines.createdAt), asc(routines.id)),
    db
      .select()
      .from(activities)
      .orderBy(asc(activities.createdAt), asc(activities.id)),
    db
      .select()
      .from(completions)
      .where(eq(completions.day, dayKey(now))),
    db
      .select({ value: sql<number>`coalesce(sum(${completions.points}), 0)` })
      .from(completions)
      .get(),
  ]);
  const completed = new Set(today.map((row) => row.activityId));
  const done = activityRows.filter((row) => completed.has(row.id)).length;
  return {
    routines: routineRows.map((routine) => ({
      ...routine,
      activities: activityRows
        .filter((row) => row.routineId === routine.id)
        .map((row) => ({ ...row, done: completed.has(row.id) })),
    })),
    done,
    total: activityRows.length,
    points: Number(score?.value ?? 0),
    mood: petMood(done, activityRows.length),
  };
}
