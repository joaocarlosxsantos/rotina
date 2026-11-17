import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const routines = sqliteTable("routines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  routineId: text("routine_id")
    .notNull()
    .references(() => routines.id),
  name: text("name").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const completions = sqliteTable(
  "completions",
  {
    id: text("id").primaryKey(),
    activityId: text("activity_id")
      .notNull()
      .references(() => activities.id),
    day: text("day").notNull(),
    points: integer("points").notNull().default(10),
  },
  (table) => [
    uniqueIndex("completion_activity_day").on(table.activityId, table.day),
  ],
);
