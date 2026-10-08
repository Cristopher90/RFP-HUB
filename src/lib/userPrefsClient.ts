"use client";

import { useEffect } from "react";
import { loadUserPref, saveUserPref } from "@/lib/userPrefsActions";

// Reads a JSON preference saved for the signed-in user; null when there is
// none yet (or the read fails — the screen then just uses its defaults).
export async function loadPref<T>(key: string): Promise<T | null> {
  try {
    const raw = await loadUserPref(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

// Saves `value` for the signed-in user shortly after it stops changing (a
// column drag-resize changes it on every mouse move). Does nothing until
// `enabled`, so the defaults never overwrite what is still being loaded.
export function useSavePref(key: string, value: unknown, enabled: boolean) {
  const serialized = JSON.stringify(value);
  useEffect(() => {
    if (!enabled) return;
    const timer = setTimeout(() => {
      saveUserPref(key, serialized).catch(() => {});
    }, 600);
    return () => clearTimeout(timer);
  }, [key, serialized, enabled]);
}
