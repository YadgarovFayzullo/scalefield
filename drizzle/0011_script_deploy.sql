ALTER TABLE "services" ADD COLUMN "deploy_mode" text DEFAULT 'image' NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "app_dir" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "deploy_command" text;