DROP INDEX "completion_event_order";--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "completions" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "routines" ADD COLUMN "user_id" text;--> statement-breakpoint
CREATE INDEX "routine_user" ON "routines" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "completion_event_order" ON "completions" USING btree ("user_id","event_order");