/** Кольцо-индикатор по проценту, как в Usage-виджете Vercel. `invert` — когда 100% это хорошо (контейнеры запущены). */
export function tone(pct: number, invert = false): "danger" | "warn" | "ok" {
  const v = invert ? 100 - pct : pct;
  if (v >= 90) return "danger";
  if (v >= 75) return "warn";
  return "ok";
}

const RING_COLOR = { danger: "#ef4444", warn: "#f59e0b", ok: "#3b82f6" } as const;

export function Ring({ pct, invert = false, size = 18 }: { pct: number; invert?: boolean; size?: number }) {
  const r = size * 0.39;
  const c = 2 * Math.PI * r;
  const filled = Math.min(100, Math.max(0, pct));
  const w = size * 0.14;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0 -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={w} className="text-muted" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={RING_COLOR[tone(pct, invert)]}
        strokeWidth={w}
        strokeLinecap="round"
        strokeDasharray={`${(filled / 100) * c} ${c}`}
      />
    </svg>
  );
}
