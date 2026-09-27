ALTER TABLE "users" ADD COLUMN "email_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Аккаунты, заведённые до флага: владелец из OWNER_EMAIL и приглашённые — адрес за ними ручался владелец.
UPDATE "users" SET "email_verified" = true;
