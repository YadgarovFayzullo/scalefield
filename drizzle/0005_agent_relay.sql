ALTER TABLE "servers" ALTER COLUMN "agent_url" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "agent_token_hash" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "agent_version" text;--> statement-breakpoint
ALTER TABLE "servers" ADD COLUMN "agent_hostname" text;--> statement-breakpoint
CREATE UNIQUE INDEX "servers_agent_token_hash" ON "servers" USING btree ("agent_token_hash");