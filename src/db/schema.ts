import { sql } from "drizzle-orm";
import {
  check,
  date,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  index,
  uuid,
} from "drizzle-orm/pg-core";

export const outcome = pgEnum("activity_outcome", ["completed", "skipped"]);
export const routines = pgTable(
  "routines",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id"),
    name: text("name").notNull(),
    weekdays: integer("weekdays").notNull().default(127),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("routine_user").on(table.userId),
    check("routine_weekdays_valid", sql`${table.weekdays} between 1 and 127`),
  ],
);

export const activities = pgTable("activities", {
  id: uuid("id").primaryKey(),
    userId: text("user_id"),
  routineId: uuid("routine_id")
    .notNull()
    .references(() => routines.id),
  name: text("name").notNull(),
  scheduledTime: text("scheduled_time"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const completions = pgTable(
  "completions",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id"),
    activityId: uuid("activity_id")
      .notNull()
      .references(() => activities.id),
    day: date("day", { mode: "string" }).notNull(),
    points: integer("points").notNull(),
    status: outcome("status").notNull(),
    bonus: integer("bonus").notNull().default(0),
    eventOrder: integer("event_order").notNull(),
    balanceAfter: integer("balance_after").notNull(),
  },
  (table) => [
    uniqueIndex("completion_activity_day").on(table.activityId, table.day),
    uniqueIndex("completion_event_order").on(table.userId, table.eventOrder),
    check("completion_balance_nonnegative", sql`${table.balanceAfter} >= 0`),
    check("completion_bonus_valid", sql`${table.bonus} between 0 and 5`),
    check(
      "completion_points_valid",
      sql`(${table.status} = 'completed' and ${table.points} = 10) or (${table.status} = 'skipped' and ${table.points} = -5 and ${table.bonus} = 0)`,
    ),
  ],
);
