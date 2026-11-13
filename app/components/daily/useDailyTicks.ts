import { useMemo, useState } from "react";
import { sendJson } from "@/app/lib/daily/http";
import type { Tick, TickKind } from "./types";

/** Which of today's three small things are done, and ticking one off. */
export function useDailyTicks(initialTicks: Tick[], today: string) {
  const [ticks, setTicks] = useState(initialTicks);
  const [busyKind, setBusyKind] = useState<TickKind | null>(null);

  const done = useMemo(
    () => new Set(ticks.map((t) => `${t.kind}:${t.day}`)),
    [ticks],
  );
  const isDone = (kind: TickKind) => done.has(`${kind}:${today}`);

  async function tick(kind: TickKind) {
    if (isDone(kind) || busyKind) return;
    setBusyKind(kind);
    try {
      const res = await sendJson("/api/daily", "POST", { kind, day: today });
      if (res.ok) setTicks((t) => [...t, { kind, day: today }]);
    } finally {
      setBusyKind(null);
    }
  }

  return { isDone, busyKind, tick };
}
