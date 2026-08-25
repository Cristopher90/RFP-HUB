"use client";

import { useEffect, useState } from "react";

function formatRemaining(ms: number): string {
  if (ms <= 0) return "Vencida";
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

// Live "time left" chip for an open RFP, ticking client-side every minute
// off a fixed deadline timestamp — no server round-trip needed.
export function CountdownTimer({ deadline }: { deadline: string }) {
  const target = new Date(deadline).getTime();
  // Starts null so the server-rendered markup never depends on "now" (which
  // would differ from the client's clock and trigger a hydration mismatch);
  // the real value fills in right after mount.
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  if (now === null) return null;

  const remaining = target - now;
  const urgent = remaining > 0 && remaining < 1000 * 60 * 60 * 24;

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
        remaining <= 0
          ? "bg-slate-100 text-slate-500"
          : urgent
            ? "bg-red-100 text-red-700"
            : "bg-blue-100 text-blue-700"
      }`}
    >
      {remaining <= 0 ? "Vencida" : `Quedan ${formatRemaining(remaining)}`}
    </span>
  );
}
