"use client";

import { useEffect, useState } from "react";
import { loadPref, useSavePref } from "@/lib/userPrefsClient";

export type ColumnDef<K extends string> = {
  key: K;
  label: string;
  defaultWidth: number;
  minWidth?: number;
};

type StoredPrefs<K extends string> = {
  order: K[];
  hidden: K[];
  widths: Partial<Record<K, number>>;
};

// Per-table column layout (order, visibility, width), persisted to
// the database (per user) so a person's preferred layout follows them. Keyed by
// storageKey so each master-data table (commodities/regions/origins/
// suppliers) keeps its own independent layout.
export function useColumnPrefs<K extends string>(
  storageKey: string,
  defs: ColumnDef<K>[],
) {
  const allKeys = defs.map((d) => d.key);
  const [order, setOrder] = useState<K[]>(allKeys);
  const [hidden, setHidden] = useState<Set<K>>(new Set());
  const [widths, setWidths] = useState<Record<K, number>>(
    () =>
      Object.fromEntries(defs.map((d) => [d.key, d.defaultWidth])) as Record<
        K,
        number
      >,
  );
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Load the user's saved layout from the server after mount (not in a lazy
    // useState initializer) so the first client render matches the server's
    // defaults and avoids a hydration mismatch.
    let cancelled = false;
    loadPref<StoredPrefs<K>>(storageKey).then((parsed) => {
      if (cancelled) return;
      if (parsed) {
        const knownOrder = (parsed.order ?? []).filter((k) => allKeys.includes(k));
        const missing = allKeys.filter((k) => !knownOrder.includes(k));
        setOrder([...knownOrder, ...missing]);
        setHidden(new Set((parsed.hidden ?? []).filter((k) => allKeys.includes(k))));
        setWidths((prev) => ({ ...prev, ...parsed.widths }));
      }
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
    // Only read stored prefs once on mount for this storageKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);

  const toStore: StoredPrefs<K> = { order, hidden: [...hidden], widths };
  useSavePref(storageKey, toStore, loaded);

  function toggleVisible(key: K) {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function moveColumn(key: K, direction: -1 | 1) {
    setOrder((prev) => {
      const idx = prev.indexOf(key);
      const swapWith = idx + direction;
      if (idx === -1 || swapWith < 0 || swapWith >= prev.length) return prev;
      const next = [...prev];
      [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
      return next;
    });
  }

  function setWidth(key: K, width: number) {
    const def = defs.find((d) => d.key === key);
    const min = def?.minWidth ?? 60;
    setWidths((prev) => ({ ...prev, [key]: Math.max(min, Math.round(width)) }));
  }

  function resetPrefs() {
    setOrder(allKeys);
    setHidden(new Set());
    setWidths(
      Object.fromEntries(defs.map((d) => [d.key, d.defaultWidth])) as Record<
        K,
        number
      >,
    );
  }

  const visibleOrderedDefs = order
    .map((k) => defs.find((d) => d.key === k))
    .filter((d): d is ColumnDef<K> => Boolean(d) && !hidden.has(d!.key));

  return {
    order,
    hidden,
    widths,
    visibleOrderedDefs,
    toggleVisible,
    moveColumn,
    setWidth,
    resetPrefs,
  };
}
