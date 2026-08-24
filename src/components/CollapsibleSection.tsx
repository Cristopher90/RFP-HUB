"use client";

import { useEffect, useState } from "react";

// Drop-in replacement for the app's `<section className="rounded-xl border
// ... p-6 shadow-sm">` card pattern: same look, but the header toggles the
// body open/closed. When storageKey is given, the open/closed state is
// remembered per-section across reloads.
export function CollapsibleSection({
  title,
  subtitle,
  right,
  defaultOpen = true,
  storageKey,
  className,
  bodyClassName,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    if (!storageKey) return;
    // Hydrate from localStorage only after mount so the server-rendered
    // default (open) matches the client's first render.
    try {
      const raw = localStorage.getItem(`section-open:${storageKey}`);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw !== null) setOpen(raw === "1");
    } catch {
      // ignore malformed/unavailable localStorage
    }
  }, [storageKey]);

  function toggle() {
    setOpen((prev) => {
      const next = !prev;
      if (storageKey) {
        try {
          localStorage.setItem(`section-open:${storageKey}`, next ? "1" : "0");
        } catch {
          // ignore write failures
        }
      }
      return next;
    });
  }

  return (
    <section
      className={
        className ?? "rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
      }
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <button
          type="button"
          onClick={toggle}
          className="flex flex-1 items-start gap-2 text-left"
        >
          <span
            className={`mt-0.5 shrink-0 text-xs text-slate-400 transition-transform ${
              open ? "rotate-90" : ""
            }`}
            aria-hidden
          >
            ▶
          </span>
          <span>
            <span className="block text-base font-semibold text-slate-900">
              {title}
            </span>
            {subtitle && (
              <span className="mt-0.5 block text-sm font-normal text-slate-500">
                {subtitle}
              </span>
            )}
          </span>
        </button>
        {right && <div onClick={(e) => e.stopPropagation()}>{right}</div>}
      </div>
      {open && (
        <div className={bodyClassName ?? "mt-4"}>{children}</div>
      )}
    </section>
  );
}
