import "server-only";
import { getCurrentUser } from "@/lib/auth";
import { getCurrentSupplierUser } from "@/lib/supplierAuth";
import { DEFAULT_COLOR_MODE, DEFAULT_THEME, isColorMode, isTheme, type ColorMode, type ThemeName, type UiStyle, isUiStyle } from "@/lib/themes";

export type ViewerPreferences = {
  language: string;
  timeZone: string;
  currency: string;
  theme: ThemeName;
  colorMode: ColorMode;
  uiStyle: UiStyle;
};

export const DEFAULT_PREFERENCES: ViewerPreferences = {
  language: "es",
  timeZone: "America/Mexico_City",
  currency: "USD",
  theme: DEFAULT_THEME,
  colorMode: DEFAULT_COLOR_MODE,
  uiStyle: "standard",
};

// Resolves the CURRENT viewer's formatting preferences, trying the internal
// User session first, then the SupplierUser session, falling back to the
// schema defaults when neither is logged in (e.g. the public
// /respond/[token] page).
export async function getViewerPreferences(): Promise<ViewerPreferences> {
  const user = await getCurrentUser();
  if (user) {
    return {
      language: user.language,
      timeZone: user.timezone,
      currency: user.currency,
      theme: isTheme(user.theme) ? user.theme : DEFAULT_THEME,
      colorMode: isColorMode(user.colorMode) ? user.colorMode : DEFAULT_COLOR_MODE,
      // The other styles are for the Super Administrador only.
      uiStyle: user.role === "ADMIN" && isUiStyle(user.uiStyle) ? user.uiStyle : "standard",
    };
  }
  const supplierUser = await getCurrentSupplierUser();
  if (supplierUser) {
    return {
      language: supplierUser.language,
      timeZone: supplierUser.timezone,
      currency: supplierUser.currency,
      theme: isTheme(supplierUser.theme) ? supplierUser.theme : DEFAULT_THEME,
      colorMode: isColorMode(supplierUser.colorMode) ? supplierUser.colorMode : DEFAULT_COLOR_MODE,
      uiStyle: "standard",
    };
  }
  return DEFAULT_PREFERENCES;
}
