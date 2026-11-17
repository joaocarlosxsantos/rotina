import {
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const routines = sqliteTable("routines", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  // 127 = ALL_WEEKDAYS (rules.ts): todos os dias da semana.
  weekdays: integer("weekdays").notNull().default(127),
  archivedAt: integer("archived_at"),
  createdAt: integer("created_at").notNull(),
});

export const activities = sqliteTable("activities", {
  id: text("id").primaryKey(),
  routineId: text("routine_id")
    .notNull()
    .references(() => routines.id),
  name: text("name").notNull(),
  scheduledTime: text("scheduled_time"),
  archivedAt: integer("archived_at"),
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
    // Uma linha resolve o dia: concluir ou pular compartilham o mesmo índice único.
    status: text("status", { enum: ["completed", "skipped"] })
      .notNull()
      .default("completed"),
    bonus: integer("bonus").notNull().default(0),
    eventOrder: integer("event_order").notNull().default(0),
    balanceAfter: integer("balance_after").notNull().default(0),
  },
  (table) => [
    uniqueIndex("completion_activity_day").on(table.activityId, table.day),
    uniqueIndex("completion_event_order").on(table.eventOrder),
  ],
);
