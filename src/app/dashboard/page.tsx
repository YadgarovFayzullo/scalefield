import Link from "next/link";
import Image from "next/image";
import { listProjects } from "@/lib/projects";
import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent } from "@/components/ui/card";

export const dynamic = "force-dynamic";

// Список проектов организации — точка входа после логина (как список проектов
// в Vercel/Supabase). Проект ведёт в свой раздел /p/<slug>.
export default async function ProjectsPage() {
  let projects: Awaited<ReturnType<typeof listProjects>> = [];
  let error: string | null = null;
  try {
    projects = await listProjects();
  } catch (e) {
    error = String(e);
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <Link href="/dashboard" className="flex items-center gap-3">
          <Image src="/scalefield.svg" alt="Scalefield" width={32} height={32} className="rounded-lg" />
          <span className="font-semibold">Scalefield</span>
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto max-w-5xl px-6 py-10">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold">Projects</h1>
          <p className="text-sm text-muted-foreground">Everything Scalefield runs and watches for you.</p>
        </div>
        {error ? (
          <Card className="border-destructive/40">
            <CardContent className="py-4 text-sm">
              Control-plane database is unreachable: <span className="font-mono">{error}</span>
            </CardContent>
          </Card>
        ) : projects.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-sm text-muted-foreground">
              No projects yet. Set <span className="font-mono">STATUS_API_URL</span>,{" "}
              <span className="font-mono">STATUS_API_TOKEN</span> and{" "}
              <span className="font-mono">GITHUB_REPOS</span>, then restart — the first project is
              created from them.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <Link key={p.id} href={`/p/${p.slug}`} className="group">
                <Card className="h-full transition-colors group-hover:border-foreground/40">
                  <CardContent className="py-5">
                    <div className="mb-1 text-base font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground font-mono">{p.slug}</div>
                    <div className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{p.server ? `${p.server.name}${p.server.provider ? ` · ${p.server.provider}` : ""}` : "no server"}</span>
                      <span>{p.services.length} service{p.services.length === 1 ? "" : "s"}</span>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
