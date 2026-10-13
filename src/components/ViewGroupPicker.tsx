"use client";

import { useEffect, useRef, useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";

export type ViewGroupOption = { id: string; name: string };

// Multi-select of a client's view groups ("grupos de visualización"): a button
// summarising the choice that opens a small checkbox list.
export function ViewGroupPicker({
  groups,
  value,
  onChange,
  compact = false,
  inline = false,
}: {
  groups: ViewGroupOption[];
  value: string[];
  onChange: (next: string[]) => void;
  compact?: boolean;
  // Plain checkbox list instead of a dropdown (for tables with scroll containers).
  inline?: boolean;
}) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  // The list is drawn with fixed positioning so a table's scroll container
  // can't clip it; it follows the button and closes on scroll/resize.
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const selected = groups.filter((g) => value.includes(g.id));
  const summary =
    selected.length === 0
      ? t("viewGroups.noneSelected")
      : selected.length <= 2
        ? selected.map((g) => g.name).join(", ")
        : `${selected.length} ${t("viewGroups.groupsCount")}`;

  if (inline) {
    return groups.length === 0 ? (
      <span className="text-xs text-slate-400">{t("viewGroups.noGroupsDefined")}</span>
    ) : (
      <div className="flex flex-wrap gap-x-3 gap-y-1">
        {groups.map((g) => (
          <label key={g.id} className="flex cursor-pointer items-center gap-1 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={value.includes(g.id)}
              onChange={(e) => onChange(e.target.checked ? [...value, g.id] : value.filter((x) => x !== g.id))}
            />
            {g.name}
          </label>
        ))}
      </div>
    );
  }

  return (
    <div className="relative" ref={ref}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          const rect = buttonRef.current?.getBoundingClientRect();
          if (rect) setPos({ top: rect.bottom + 4, left: rect.left });
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        className={`flex w-full items-center justify-between rounded-md border border-slate-300 bg-white text-left shadow-sm hover:border-violet-400 ${
          compact ? "px-2 py-1 text-xs" : "px-3 py-2 text-sm"
        } ${selected.length === 0 ? "text-slate-400" : "text-slate-700"}`}
      >
        <span className="truncate">{summary}</span>
        <span className="ml-2 text-slate-400">▾</span>
      </button>
      {open && pos && (
        <div
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 max-h-60 w-64 overflow-auto rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          {groups.length === 0 ? (
            <p className="px-2 py-1 text-xs text-slate-400">{t("viewGroups.noGroupsDefined")}</p>
          ) : (
            groups.map((g) => (
              <label
                key={g.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={value.includes(g.id)}
                  onChange={(e) =>
                    onChange(e.target.checked ? [...value, g.id] : value.filter((x) => x !== g.id))
                  }
                />
                {g.name}
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}
