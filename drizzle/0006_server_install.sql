ALTER TABLE "organizations" ADD COLUMN "ssh_public_key" text;--> statement-breakpoint
ALTER TABLE "organizations" ADD COLUMN "ssh_private_key_enc" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "status" text DEFAULT 'ready' NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "ssh_port" integer DEFAULT 22 NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "ssh_user" text DEFAULT 'root' NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "install_log" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "install_error" text;