ALTER TABLE "deployments" ADD COLUMN "log" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "command" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "env_enc" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "volumes" jsonb DEFAULT '[]'::jsonb NOT NULL;