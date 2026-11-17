CREATE TABLE `activities` (
	`id` text PRIMARY KEY NOT NULL,
	`routine_id` text NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`routine_id`) REFERENCES `routines`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `completions` (
	`id` text PRIMARY KEY NOT NULL,
	`activity_id` text NOT NULL,
	`day` text NOT NULL,
	`points` integer DEFAULT 10 NOT NULL,
	FOREIGN KEY (`activity_id`) REFERENCES `activities`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `completion_activity_day` ON `completions` (`activity_id`,`day`);--> statement-breakpoint
CREATE TABLE `routines` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`created_at` integer NOT NULL
);
