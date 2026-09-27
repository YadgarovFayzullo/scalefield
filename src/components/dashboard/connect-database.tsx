"use client";

import * as React from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { DatabaseIcon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProject } from "@/lib/project-context";
import { api } from "@/lib/tables";

/** Совпадает с NO_DATABASE в src/lib/project-db.ts — по нему страницы показывают эту форму. */
export const NO_DATABASE = "Project has no database registered";

/**
 * «У проекта нет базы» → форма подключения, а не голая ошибка. Строку
 * проверяет агент сервера проекта: адрес — такой, каким базу видит сервер
 * (имя контейнера в docker-сети, например `qrtifact-db-1:5432`), а не
 * публичный.
 */
export function ConnectDatabase({ onConnected }: { onConnected: () => void }) {
  const { apiBase } = useProject();
  const [url, setUrl] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`${apiBase}/database`, { method: "PUT", body: JSON.stringify({ url }) });
      onConnected();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto w-full max-w-lg rounded-xl border border-border p-6">
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
          <HugeiconsIcon icon={DatabaseIcon} className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium">Connect a database</p>
          <p className="text-sm text-muted-foreground">This project has no PostgreSQL connected yet.</p>
        </div>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Connection string</span>
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="postgresql://user:password@my-db-container:5432/app"
          className="font-mono text-xs"
          required
          autoComplete="off"
        />
        <span className="mt-1 block text-xs text-muted-foreground">
          As the server sees it — the agent connects from inside the server, so use the container name, not a public address. Stored encrypted.
        </span>
      </label>
      {error && <p className="mt-3 rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</p>}
      <div className="mt-4 flex justify-end">
        <Button type="submit" disabled={busy}>
          {busy ? "Checking…" : "Connect"}
        </Button>
      </div>
    </form>
  );
}
