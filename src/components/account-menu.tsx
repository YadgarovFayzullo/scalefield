"use client";

import * as React from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export type AccountInfo = { name: string | null; email: string; avatarUrl: string | null; isPlatformAdmin: boolean };

function initials(a: AccountInfo): string {
  const src = (a.name || a.email).trim();
  const parts = src.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** Аватар с меню аккаунта: кто вошёл, приглашения (владельцу платформы), выход. */
export function AccountMenu({ account }: { account: AccountInfo }) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  async function logout() {
    await fetch("/api/logout", { method: "POST" }).catch(() => {});
    window.location.href = "/login";
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-primary text-[11px] font-semibold text-primary-foreground ring-2 ring-border transition-opacity hover:opacity-90"
        aria-label="Account"
      >
        {account.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.avatarUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          initials(account)
        )}
      </button>
      {open && (
        <div className="absolute right-0 top-9 z-50 w-60 rounded-lg border border-border bg-popover p-1 text-sm shadow-lg">
          <div className="border-b border-border px-3 py-2">
            <p className="truncate font-medium">{account.name || account.email}</p>
            <p className="truncate text-xs text-muted-foreground">{account.email}</p>
          </div>
          <MenuLink href="/dashboard">Projects</MenuLink>
          <MenuLink href="/servers">Servers</MenuLink>
          <MenuLink href="/settings/github">GitHub</MenuLink>
          {account.isPlatformAdmin && <MenuLink href="/settings/invites">Invites</MenuLink>}
          <button type="button" onClick={logout} className="w-full rounded-md px-3 py-1.5 text-left text-muted-foreground hover:bg-muted hover:text-foreground">
            Log out
          </button>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("block rounded-md px-3 py-1.5 text-muted-foreground hover:bg-muted hover:text-foreground")}>
      {children}
    </Link>
  );
}
