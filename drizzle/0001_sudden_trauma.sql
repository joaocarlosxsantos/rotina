ALTER TABLE `activities` ADD `scheduled_time` text;--> statement-breakpoint
ALTER TABLE `activities` ADD `archived_at` integer;--> statement-breakpoint
ALTER TABLE `routines` ADD `weekdays` integer DEFAULT 127 NOT NULL;--> statement-breakpoint
ALTER TABLE `routines` ADD `archived_at` integer;