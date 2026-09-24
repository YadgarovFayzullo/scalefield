"use client";

import { useProject } from "@/lib/project-context";
import { SqlEditor } from "@/components/dashboard/sql-editor";

export default function SqlPage() {
  const { slug, apiBase } = useProject();
  return <SqlEditor slug={slug} apiBase={apiBase} />;
}
