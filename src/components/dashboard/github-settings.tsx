"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/tables";

/** Создание GitHub App по манифесту: имя должно быть уникальным на всём GitHub. */
export function CreateGithubApp() {
  const [name, setName] = React.useState("Scalefield");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        window.location.href = `/api/github/manifest/start?name=${encodeURIComponent(name)}`;
      }}
      className="flex flex-wrap items-end gap-3"
    >
      <label className="block min-w-60 flex-1">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">App name (unique on GitHub)</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={34} required />
      </label>
      <Button type="submit">Create GitHub App</Button>
    </form>
  );
}

export function DisconnectInstallation({ id, login }: { id: string; login: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Disconnect @${login} from this team? Deploys from its private repos will stop.`)) return;
        setBusy(true);
        try {
          await api(`/api/github/installations/${id}`, { method: "DELETE" });
          router.refresh();
        } catch (e) {
          alert(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      Disconnect
    </Button>
  );
}

export function ShareInstallation({ sourceId, orgId, login }: { sourceId: string; orgId: string; login: string }) {
  const router = useRouter();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await api("/api/github/installations/share", { method: "POST", body: JSON.stringify({ sourceId, orgId }) });
          router.refresh();
        } catch (e) {
          alert(e instanceof Error ? e.message : String(e));
        } finally {
          setBusy(false);
        }
      }}
    >
      Use @{login} here
    </Button>
  );
}
