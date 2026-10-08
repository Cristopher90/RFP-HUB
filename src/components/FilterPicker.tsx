"use client";

import { useEffect, useRef, useState } from "react";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { loadPref, useSavePref } from "@/lib/userPrefsClient";

// Which filters of a list the user wants on screen, saved per user. A filter
// that currently has a value is always shown, so nothing filters invisibly.
export function useVisibleFilters(prefKey: string, defaults: string[], active: string[]) {
  const [chosen, setChosen] = useState<string[]>(defaults);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPref<string[]>(prefKey).then((saved) => {
      if (cancelled) return;
      if (Array.isArray(saved)) setChosen(saved.filter((k) => typeof k === "string"));
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [prefKey]);

  useSavePref(prefKey, chosen, loaded);

  const visible = new Set([...chosen, ...active]);
  function show(key: string) {
    setChosen((prev) => (prev.includes(key) ? prev : [...prev, key]));
  }
  function hide(key: string) {
    setChosen((prev) => prev.filter((k) => k !== key));
  }
  return { visible, show, hide };
}

// "More filters" dropdown: a checkbox per available filter.
export function FilterPicker({
  filters,
  visible,
  onToggle,
}: {
  filters: { key: string; label: string }[];
  visible: Set<string>;
  onToggle: (key: string, show: boolean) => void;
}) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm hover:bg-slate-50"
      >
        {t("filters.moreFilters")} ▾
      </button>
      {open && (
        <div className="absolute left-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            {t("filters.chooseFilters")}
          </p>
          {filters.map((f) => (
            <label
              key={f.key}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={visible.has(f.key)}
                onChange={(e) => onToggle(f.key, e.target.checked)}
              />
              {f.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
