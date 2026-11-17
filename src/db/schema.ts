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

export const activities = pgTable(
  "activities",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id"),
    routineId: uuid("routine_id")
      .notNull()
      .references(() => routines.id),
    name: text("name").notNull(),
    scheduledTime: text("scheduled_time"),
    weekdays: integer("weekdays"),
    onceDate: date("once_date", { mode: "string" }),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "activity_weekdays_valid",
      sql`${table.weekdays} is null or ${table.weekdays} between 1 and 127`,
    ),
    check(
      "activity_schedule_consistent",
      sql`${table.weekdays} is null or ${table.onceDate} is null`,
    ),
  ],
);

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

export const userSettings = pgTable(
  "user_settings",
  {
    userId: text("user_id").primaryKey(),
    petKind: text("pet_kind").notNull().default("original"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    check(
      "user_settings_pet_kind_valid",
      sql`${table.petKind} in ('original', 'gato', 'cachorro', 'coelho', 'dragao', 'planta')`,
    ),
  ],
);

export const calendarAccounts = pgTable(
  "calendar_accounts",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull(),
    googleSub: text("google_sub").notNull(),
    email: text("email").notNull(),
    refreshTokenEnc: text("refresh_token_enc").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("calendar_accounts_user_sub").on(table.userId, table.googleSub),
    index("calendar_accounts_user").on(table.userId),
  ],
);
