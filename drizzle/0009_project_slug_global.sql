DROP INDEX "projects_org_slug";--> statement-breakpoint
CREATE UNIQUE INDEX "projects_slug" ON "projects" USING btree ("slug");