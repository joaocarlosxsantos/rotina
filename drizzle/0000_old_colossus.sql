CREATE TYPE "public"."activity_outcome" AS ENUM('completed', 'skipped');--> statement-breakpoint
CREATE TABLE "activities" (
	"id" uuid PRIMARY KEY NOT NULL,
	"routine_id" uuid NOT NULL,
	"name" text NOT NULL,
	"scheduled_time" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "completions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"activity_id" uuid NOT NULL,
	"day" date NOT NULL,
	"points" integer NOT NULL,
	"status" "activity_outcome" NOT NULL,
	"bonus" integer DEFAULT 0 NOT NULL,
	"event_order" integer NOT NULL,
	"balance_after" integer NOT NULL,
	CONSTRAINT "completion_balance_nonnegative" CHECK ("completions"."balance_after" >= 0),
	CONSTRAINT "completion_bonus_valid" CHECK ("completions"."bonus" between 0 and 5),
	CONSTRAINT "completion_points_valid" CHECK (("completions"."status" = 'completed' and "completions"."points" = 10) or ("completions"."status" = 'skipped' and "completions"."points" = -5 and "completions"."bonus" = 0))
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" uuid PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"weekdays" integer DEFAULT 127 NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "routine_weekdays_valid" CHECK ("routines"."weekdays" between 1 and 127)
);
--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activities_routine_id_routines_id_fk" FOREIGN KEY ("routine_id") REFERENCES "public"."routines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "completions" ADD CONSTRAINT "completions_activity_id_activities_id_fk" FOREIGN KEY ("activity_id") REFERENCES "public"."activities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "completion_activity_day" ON "completions" USING btree ("activity_id","day");--> statement-breakpoint
CREATE UNIQUE INDEX "completion_event_order" ON "completions" USING btree ("event_order");