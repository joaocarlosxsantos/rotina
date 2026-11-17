CREATE TABLE "calendar_accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"google_sub" text NOT NULL,
	"email" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "calendar_accounts_user_sub" ON "calendar_accounts" USING btree ("user_id","google_sub");--> statement-breakpoint
CREATE INDEX "calendar_accounts_user" ON "calendar_accounts" USING btree ("user_id");