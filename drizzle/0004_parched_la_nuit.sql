ALTER TABLE "activities" ADD COLUMN "weekdays" integer;--> statement-breakpoint
ALTER TABLE "activities" ADD COLUMN "once_date" date;--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activity_weekdays_valid" CHECK ("activities"."weekdays" is null or "activities"."weekdays" between 1 and 127);--> statement-breakpoint
ALTER TABLE "activities" ADD CONSTRAINT "activity_schedule_consistent" CHECK ("activities"."weekdays" is null or "activities"."once_date" is null);