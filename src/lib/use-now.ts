"use client";

import * as React from "react";

/**
 * Текущее время, обновляемое раз в `everyMs`, пока `active`. До первого тика
 * (и на сервере) — null: так разметка SSR и первого клиентского рендера
 * совпадают, а секунды появляются сразу после гидрации. Нужен для таймеров
 * «идёт уже 1m 3s» у живых деплоев: интервал заводится только у строк, которым
 * он нужен, завершённые ничего не тикают.
 */
export function useNow(active: boolean, everyMs = 1000): number | null {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [active, everyMs]);
  return active ? now : null;
}

/** Секунды от `startedAt` до `now`; null, пока `now` неизвестно. */
export function elapsedSeconds(startedAt: string, now: number | null): number | null {
  return now == null ? null : Math.max(0, Math.round((now - new Date(startedAt).getTime()) / 1000));
}
