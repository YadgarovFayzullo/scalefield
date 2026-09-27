"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/tables";
import { fmtAgo } from "@/lib/format";
import type { InviteView } from "@/lib/invites";

/**
 * Выдача приглашений: email (необязательно — тогда ссылка для любого
 * адреса), куда — своя новая команда или одна из ваших, заметка. Ссылка
 * показывается один раз: в базе хранится только хеш токена.
 */
export function InvitesBoard({ initial, teams }: { initial: InviteView[]; teams: { id: string; name: string }[] }) {
  const [invites, setInvites] = React.useState(initial);
  const [email, setEmail] = React.useState("");
  const [target, setTarget] = React.useState<string>("own");
  const [role, setRole] = React.useState("member");
  const [note, setNote] = React.useState("");
  const [link, setLink] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setLink(null);
    try {
      const res = await api<{ invite: InviteView; link: string }>("/api/invites", {
        method: "POST",
        body: JSON.stringify({ email, joinOrgId: target === "own" ? null : target, role, note }),
      });
      setInvites((prev) => [res.invite, ...prev]);
      setLink(res.link);
      setEmail("");
      setNote("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    try {
      await api(`/api/invites/${id}`, { method: "DELETE" });
      setInvites((prev) => prev.filter((i) => i.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ссылка видна в поле */
    }
  }

  const now = Date.now();
  const status = (i: InviteView) =>
    i.usedAt ? `Used by ${i.usedByEmail ?? "—"}` : new Date(i.expiresAt).getTime() < now ? "Expired" : `Pending · expires ${new Date(i.expiresAt).toLocaleDateString()}`;

  return (
    <>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold">Invites</h1>
        <p className="text-sm text-muted-foreground">Scalefield is invite-only. Each link creates one account and works for 14 days.</p>
      </div>

      <form onSubmit={create} className="mb-8 space-y-4 rounded-xl border border-border p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Email (optional)</span>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Any email if empty" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Team</span>
            <select value={target} onChange={(e) => setTarget(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
              <option value="own">Their own new team</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  Join “{t.name}”
                </option>
              ))}
            </select>
          </label>
          {target !== "own" && (
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Role</span>
              <select value={role} onChange={(e) => setRole(e.target.value)} className="h-9 w-full rounded-md border border-input bg-transparent px-2 text-sm">
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </label>
          )}
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Note (for you)</span>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. QRTifact team" />
          </label>
        </div>
        {error && <p className="rounded-md border border-destructive/40 bg-destructive/5 p-2 text-sm text-destructive">{error}</p>}
        {link && (
          <div className="rounded-md border border-emerald-500/40 bg-emerald-500/5 p-3">
            <p className="mb-2 text-sm font-medium">Invite link — shown only once</p>
            <div className="flex gap-2">
              <Input readOnly value={link} className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" variant="outline" onClick={copy}>
                {copied ? "Copied" : "Copy"}
              </Button>
            </div>
          </div>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={busy}>
            {busy ? "Creating…" : "Create invite"}
          </Button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5 font-medium">For</th>
              <th className="px-4 py-2.5 font-medium">Team</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {invites.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                  No invites yet
                </td>
              </tr>
            ) : (
              invites.map((i) => (
                <tr key={i.id} className="border-t border-border">
                  <td className="px-4 py-3">
                    <div>{i.email || "Any email"}</div>
                    <div className="text-xs text-muted-foreground">
                      {i.note ? `${i.note} · ` : ""}
                      {fmtAgo(i.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{i.orgName ? `${i.orgName} (${i.role})` : "Own team"}</td>
                  <td className="px-4 py-3 text-muted-foreground">{status(i)}</td>
                  <td className="px-4 py-3 text-right">
                    {!i.usedAt && (
                      <Button variant="outline" size="sm" onClick={() => revoke(i.id)}>
                        Revoke
                      </Button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
