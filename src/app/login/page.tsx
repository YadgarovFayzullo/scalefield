"use client";

import * as React from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GithubButton } from "@/components/github-button";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  // Ошибка возврата с GitHub (?error=…) — показываем там же, где ошибку пароля.
  const [error, setError] = React.useState<string | null>(params.get("error"));
  const [busy, setBusy] = React.useState(false);
  const next = params.get("next");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error || `HTTP ${res.status}`);
        return;
      }
      // Только свой путь: `next` из адреса — не открытый редирект.
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <GithubButton query={`mode=login${next ? `&next=${encodeURIComponent(next)}` : ""}`} />
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        New to Scalefield?{" "}
        <a href="/signup" className="underline underline-offset-4">
          Sign up
        </a>{" "}
        — with GitHub, or with your invite link.
      </p>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-2">
            <Image src="/scalefield.svg" alt="Scalefield" width={48} height={48} />
          </div>
          <CardTitle>Sign in to Scalefield</CardTitle>
          <CardDescription>Deploy and run projects on your own servers</CardDescription>
        </CardHeader>
        <CardContent>
          <React.Suspense>
            <LoginForm />
          </React.Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
