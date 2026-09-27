"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GithubButton } from "@/components/github-button";

type InviteInfo = { email: string | null; orgName: string | null };

/** Регистрация по ссылке-приглашению: сначала проверяем ссылку, потом форма. */
function SignupForm() {
  const params = useSearchParams();
  const token = params.get("invite") || "";
  const [info, setInfo] = React.useState<InviteInfo | null>(null);
  const [invalid, setInvalid] = React.useState<string | null>(null);
  // Без приглашения — регистрация через GitHub, если она открыта (SIGNUP_OPEN).
  const [openSignup, setOpenSignup] = React.useState(false);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState<string | null>(params.get("error"));
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    if (!token) {
      fetch("/api/auth/providers")
        .then((r) => r.json())
        .then((j: { signupOpen?: boolean }) => {
          if (j.signupOpen) setOpenSignup(true);
          else setInvalid("Registration is invite-only. Ask the Scalefield owner for an invite link.");
        })
        .catch(() => setInvalid("Registration is invite-only. Ask the Scalefield owner for an invite link."));
      return;
    }
    fetch(`/api/invites/lookup?token=${encodeURIComponent(token)}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) setInvalid(j?.error || "This invite is not valid");
        else {
          setInfo(j as InviteInfo);
          if (j.email) setEmail(j.email);
        }
      })
      .catch(() => setInvalid("Could not check the invite"));
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/signup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ invite: token, name, email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || `HTTP ${res.status}`);
        return;
      }
      window.location.href = "/dashboard";
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  if (openSignup) {
    return (
      <div className="space-y-4">
        <GithubButton query="mode=login" label="Sign up with GitHub" />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-center text-xs text-muted-foreground">
          Your repositories show up right after — pick one and deploy it to your server.{" "}
          <Link href="/login" className="underline underline-offset-4">
            Already have an account?
          </Link>
        </p>
      </div>
    );
  }
  if (invalid) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-sm text-muted-foreground">{invalid}</p>
        <Link href="/login" className="text-sm underline underline-offset-4">
          Sign in instead
        </Link>
      </div>
    );
  }
  if (!info) return <p className="text-center text-sm text-muted-foreground">Checking your invite…</p>;

  return (
    <form onSubmit={submit} className="space-y-4">
      <GithubButton query={`mode=signup&invite=${encodeURIComponent(token)}`} label="Sign up with GitHub" />
      {info.orgName && (
        <p className="rounded-md bg-muted px-3 py-2 text-sm">
          You&apos;re joining <span className="font-medium">{info.orgName}</span>.
        </p>
      )}
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input id="name" autoComplete="name" autoFocus value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={Boolean(info.email)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="new-password" minLength={10} value={password} onChange={(e) => setPassword(e.target.value)} required />
        <p className="text-xs text-muted-foreground">At least 10 characters.</p>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}

export default function SignupPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2">
            <Image src="/scalefield.svg" alt="Scalefield" width={48} height={48} />
          </div>
          <CardTitle>Create your Scalefield account</CardTitle>
          <CardDescription>Deploy from GitHub to your own servers</CardDescription>
        </CardHeader>
        <CardContent>
          <React.Suspense>
            <SignupForm />
          </React.Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
