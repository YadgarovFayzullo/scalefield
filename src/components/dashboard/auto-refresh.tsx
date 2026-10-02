"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

/** Перерисовать серверную страницу раз в `ms` — живые цифры без клиентского поллинга API. */
export function AutoRefresh({ ms = 15_000 }: { ms?: number }) {
  const router = useRouter();
  React.useEffect(() => {
    const t = setInterval(() => router.refresh(), ms);
    return () => clearInterval(t);
  }, [router, ms]);
  return null;
}
