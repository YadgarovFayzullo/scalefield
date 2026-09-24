"use client";

import { createContext, useContext } from "react";

/**
 * Текущий проект для клиентских компонентов. Кладётся layout'ом `/p/[project]`;
 * `useMetric` строит по нему адреса API: `/api/projects/<slug>/status/<metric>`.
 */
export type ProjectContextValue = {
  slug: string;
  name: string;
  serverName: string | null;
  contentMetrics: boolean;
  /** База API проекта, например `/api/projects/researcher-uz`. */
  apiBase: string;
  /** База страниц проекта, например `/p/researcher-uz`. */
  pathBase: string;
};

const ProjectContext = createContext<ProjectContextValue | null>(null);

export function ProjectProvider({
  value,
  children,
}: {
  value: ProjectContextValue;
  children: React.ReactNode;
}) {
  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject(): ProjectContextValue {
  const ctx = useContext(ProjectContext);
  if (!ctx) {
    throw new Error("useProject вызван вне /p/[project]");
  }
  return ctx;
}
