// Interface themes: an accent color (remaps the violet scale used across the
// UI) and a color mode (light / dark / follow the system). Client-safe.
export const THEMES = [
  { value: "violet", swatch: "#7c3aed" },
  { value: "blue", swatch: "#2563eb" },
  { value: "emerald", swatch: "#059669" },
  { value: "orange", swatch: "#ea580c" },
  { value: "rose", swatch: "#e11d48" },
] as const;

// Color modes: the classic light / dark / follow-the-system, plus ready-made
// palettes. Each palette builds on a light or a dark base (see DARK_COLOR_MODES)
// and then remaps the neutral scale (globals.css, [data-palette]).
export const COLOR_MODES = [
  "light",
  "dark",
  "system",
  "warm",
  "ocean",
  "contrast",
  "graphite",
  "forest",
] as const;

// Modes that sit on the dark base.
export const DARK_COLOR_MODES: readonly string[] = ["dark", "graphite", "forest"];
// Modes that are palettes (need data-palette on <html>).
export const PALETTE_MODES: readonly string[] = ["warm", "ocean", "contrast", "graphite", "forest"];

// Two-tone swatch (background, ink) shown next to each mode in Mi perfil.
export const COLOR_MODE_SWATCH: Record<string, [string, string]> = {
  light: ["#ffffff", "#0f172a"],
  dark: ["#0b1220", "#eef1f7"],
  system: ["#ffffff", "#0b1220"],
  warm: ["#f6f0e4", "#1d1913"],
  ocean: ["#eaf2f7", "#12212e"],
  contrast: ["#ffffff", "#000000"],
  graphite: ["#161616", "#f0f0f0"],
  forest: ["#0a1410", "#eef5f0"],
};

// Visual style of the whole interface. "standard" is the current look; "pizarra"
// (slate and teal, square and flat), "cristal" (dark translucent glass) and "panel"
// (solid blue menu, light colorful cards) are offered to the Super Administrador
// only. They change looks, never behaviour.
export const UI_STYLES = ["standard", "pizarra", "cristal", "panel"] as const;
export type UiStyle = (typeof UI_STYLES)[number];

// Styles with a fixed appearance: "cristal" is always dark and "panel" always
// light, whatever color mode is chosen (the mode is ignored while they are on).
export function forcedUiMode(value: string): "dark" | "light" | null {
  if (value === "cristal") return "dark";
  if (value === "panel") return "light";
  return null;
}

export function isUiStyle(value: string): value is UiStyle {
  return (UI_STYLES as readonly string[]).includes(value);
}

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
