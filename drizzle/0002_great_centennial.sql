CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"pet_kind" text DEFAULT 'original' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_settings_pet_kind_valid" CHECK ("user_settings"."pet_kind" in ('original', 'gato', 'cachorro', 'coelho', 'dragao', 'planta'))
);
