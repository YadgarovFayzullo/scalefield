import Link from "next/link";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Projects" },
  { href: "/servers", label: "Servers" },
];

/** Шапка страниц верхнего уровня (список проектов, серверы): логотип, разделы, тема. */
export function PanelHeader({ active }: { active: "/dashboard" | "/servers" }) {
  return (
    <header className="flex items-center justify-between border-b border-border px-6 py-3">
      <div className="flex items-center gap-6">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground text-sm font-bold">S</div>
          <span className="font-semibold">Scalefield</span>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn(
                "rounded-md px-2.5 py-1.5 transition-colors",
                n.href === active ? "bg-muted font-medium" : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
              )}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </div>
      <ThemeToggle />
    </header>
  );
}
