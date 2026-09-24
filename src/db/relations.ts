import { relations } from "drizzle-orm";
import { buckets, databases, deployments, domains, projects, servers, services, organizations } from "./schema";

export const organizationsRelations = relations(organizations, ({ many }) => ({
  projects: many(projects),
  servers: many(servers),
}));

export const serversRelations = relations(servers, ({ one, many }) => ({
  org: one(organizations, { fields: [servers.orgId], references: [organizations.id] }),
  projects: many(projects),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  org: one(organizations, { fields: [projects.orgId], references: [organizations.id] }),
  server: one(servers, { fields: [projects.serverId], references: [servers.id] }),
  services: many(services),
  deployments: many(deployments),
  databases: many(databases),
  buckets: many(buckets),
}));

export const servicesRelations = relations(services, ({ one, many }) => ({
  project: one(projects, { fields: [services.projectId], references: [projects.id] }),
  domains: many(domains),
}));

export const domainsRelations = relations(domains, ({ one }) => ({
  service: one(services, { fields: [domains.serviceId], references: [services.id] }),
}));

export const deploymentsRelations = relations(deployments, ({ one }) => ({
  project: one(projects, { fields: [deployments.projectId], references: [projects.id] }),
  service: one(services, { fields: [deployments.serviceId], references: [services.id] }),
}));
