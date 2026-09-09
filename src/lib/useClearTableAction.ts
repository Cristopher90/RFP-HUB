"use client";

import { useState, useTransition } from "react";

// Shared by every "datos maestros" screen's Super Administrador-only
// "Borrar tabla" button: confirms in a native dialog (this is a real,
// immediate, irreversible server delete — unlike removing a row locally,
// which only takes effect on the next "Guardar cambios"), then runs the
// given server action and reports the result.
export function useClearTableAction(
  clearFn: () => Promise<{ error: string } | { success: true }>,
) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(confirmMessage: string, onSuccess: () => void) {
    if (!window.confirm(confirmMessage)) return;
    setError(null);
    startTransition(async () => {
      const result = await clearFn();
      if ("error" in result) setError(result.error);
      else onSuccess();
    });
  }

  return { run, pending, error, setError };
}
