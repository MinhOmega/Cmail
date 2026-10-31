ALTER TABLE "app_settings" ALTER COLUMN "app_name" SET DEFAULT 'Cmail';--> statement-breakpoint
ALTER TABLE "app_settings" ADD COLUMN "accent_color" text;--> statement-breakpoint
ALTER TABLE "messages" ADD COLUMN "verification_code" text;