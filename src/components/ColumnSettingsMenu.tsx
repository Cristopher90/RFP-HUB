"use client";

import { useEffect, useRef, useState } from "react";
import type { ColumnDef } from "@/lib/useColumnPrefs";
import { usePreferences } from "@/i18n/PreferencesProvider";

export function ColumnSettingsMenu<K extends string>({
  defs,
  order,
  hidden,
  toggleVisible,
  moveColumn,
  resetPrefs,
}: {
  defs: ColumnDef<K>[];
  order: K[];
  hidden: Set<K>;
  toggleVisible: (key: K) => void;
  moveColumn: (key: K, direction: -1 | 1) => void;
  resetPrefs: () => void;
}) {
  const { t } = usePreferences();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const byKey = new Map(defs.map((d) => [d.key, d]));

  useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
      >
        {t("columnSettingsMenu.columns")}
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-64 rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-slate-400">
            {t("columnSettingsMenu.showHideAndOrder")}
          </p>
          {order.map((k, i) => {
            const def = byKey.get(k);
            if (!def) return null;
            return (
              <div
                key={k}
                className="flex items-center gap-2 rounded px-2 py-1.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={!hidden.has(k)}
                  onChange={() => toggleVisible(k)}
                />
                <span className="flex-1 text-sm text-slate-700">
                  {def.label}
                </span>
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={() => moveColumn(k, -1)}
                  title={t("columnSettingsMenu.moveLeft")}
                  className="rounded px-1 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-20"
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === order.length - 1}
                  onClick={() => moveColumn(k, 1)}
                  title={t("columnSettingsMenu.moveRight")}
                  className="rounded px-1 text-xs text-slate-400 hover:text-slate-700 disabled:opacity-20"
                >
                  ↓
                </button>
              </div>
            );
          })}
          <button
            type="button"
            onClick={resetPrefs}
            className="mt-1 w-full rounded px-2 py-1 text-left text-xs text-slate-400 hover:bg-slate-50 hover:text-slate-600"
          >
            {t("columnSettingsMenu.resetColumns")}
          </button>
        </div>
      )}
    </div>
  );
}

// Column header with a drag handle on its right edge to resize the column.
export function ResizableTh({
  width,
  onResize,
  children,
}: {
  width: number;
  onResize: (width: number) => void;
  children: React.ReactNode;
}) {
  const { t } = usePreferences();
  const startRef = useRef<{ x: number; width: number } | null>(null);

  function handleMouseDown(e: React.MouseEvent) {
    e.preventDefault();
    startRef.current = { x: e.clientX, width };
    function handleMouseMove(ev: MouseEvent) {
      if (!startRef.current) return;
      onResize(startRef.current.width + (ev.clientX - startRef.current.x));
    }
    function handleMouseUp() {
      startRef.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    }
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }

  return (
    <th
      style={{ width, minWidth: width }}
      className="relative px-3 pb-1 text-left"
    >
      <span className="pr-2">{children}</span>
      <span
        onMouseDown={handleMouseDown}
        title={t("columnSettingsMenu.dragToResize")}
        className="absolute right-0 top-0 h-full w-2 cursor-col-resize select-none hover:bg-violet-200"
      />
    </th>
  );
}
