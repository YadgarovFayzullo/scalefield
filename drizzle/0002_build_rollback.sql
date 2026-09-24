ALTER TABLE "deployments" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "branch" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "dockerfile" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "build_context" text;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "auto_deploy" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "services" ADD COLUMN "webhook_secret_enc" text;