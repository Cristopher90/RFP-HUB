// Interface themes: an accent color (remaps the violet scale used across the
// UI) and a color mode (light / dark / follow the system). Client-safe.
export const THEMES = [
  { value: "violet", swatch: "#7c3aed" },
  { value: "blue", swatch: "#2563eb" },
  { value: "emerald", swatch: "#059669" },
  { value: "orange", swatch: "#ea580c" },
  { value: "rose", swatch: "#e11d48" },
] as const;

export const COLOR_MODES = ["light", "dark", "system"] as const;

export type ThemeName = (typeof THEMES)[number]["value"];
export type ColorMode = (typeof COLOR_MODES)[number];

export const DEFAULT_THEME: ThemeName = "violet";
export const DEFAULT_COLOR_MODE: ColorMode = "light";

export function isTheme(value: string): value is ThemeName {
  return THEMES.some((t) => t.value === value);
}

export function isColorMode(value: string): value is ColorMode {
  return (COLOR_MODES as readonly string[]).includes(value);
}

// Visual style of the whole interface. "bento" (tiles on a warm canvas, ink and
// lime accents) is only offered to the Super Administrador for now; it changes
// looks only, never behaviour.
export const UI_STYLES = ["classic", "bento"] as const;
export type UiStyle = (typeof UI_STYLES)[number];

export function isUiStyle(value: string): value is UiStyle {
  return (UI_STYLES as readonly string[]).includes(value);
}
