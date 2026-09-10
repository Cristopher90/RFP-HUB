import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";

export type ViewerPreferences = {
  language: string;
  timeZone: string;
  currency: string;
};

export const DEFAULT_PREFERENCES: ViewerPreferences = {
  language: "es",
  timeZone: "America/Mexico_City",
  currency: "USD",
};

// Resolves the CURRENT viewer's formatting preferences, trying the internal
// User session first, then the SupplierUser session, falling back to the
// schema defaults when neither is logged in (e.g. the public
// /respond/[token] page).
export async function getViewerPreferences(): Promise<ViewerPreferences> {
  const user = await getCurrentUser();
  if (user) {
    return { language: user.language, timeZone: user.timezone, currency: user.currency };
  }
  const supplierUser = await getCurrentSupplierUser();
  if (supplierUser) {
    return {
      language: supplierUser.language,
      timeZone: supplierUser.timezone,
      currency: supplierUser.currency,
    };
  }
  return DEFAULT_PREFERENCES;
}
