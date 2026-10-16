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
// (solid blue menu, light colorful cards) are offered to every user (internal and
// supplier). They change looks, never behaviour.
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

// ---------- Cristal: panel transparency and background ----------
// The glass style lets the user tune how see-through the panels
// are (0 to 100, more is more opaque) and pick the background gradient: a preset
// or two custom colors ("custom:#rrggbb,#rrggbb").
export const DEFAULT_GLASS = 17;
export const DEFAULT_GLASS_BACKGROUND = "aurora";
export const DEFAULT_CUSTOM_COLORS: [string, string] = ["#5c46e6", "#1296aa"];

export const GLASS_BACKGROUNDS = {
  aurora: { base: "#090d22", colors: ["#5c46e6", "#1296aa", "#9634aa"] },
  oceano: { base: "#06121f", colors: ["#145ac8", "#0aaabe", "#1e3ca0"] },
  atardecer: { base: "#1a0b1f", colors: ["#be326e", "#eb7832", "#6e32be"] },
  bosque: { base: "#07140f", colors: ["#148c5a", "#0e7882", "#3c8228"] },
  grafito: { base: "#0d0f14", colors: ["#5a6482", "#3c465a", "#6e6e8c"] },
} as const;
export type GlassBackgroundName = keyof typeof GLASS_BACKGROUNDS;

const CUSTOM_BACKGROUND = /^custom:(#[0-9a-f]{6}),(#[0-9a-f]{6})$/;

export function isGlassBackground(value: string): boolean {
  return value in GLASS_BACKGROUNDS || CUSTOM_BACKGROUND.test(value);
}

export function normalizeGlass(value: number): number {
  return Number.isFinite(value) ? Math.min(100, Math.max(0, Math.round(value))) : DEFAULT_GLASS;
}

// "custom:#aabbcc,#112233" -> the two colors, or null for a preset.
export function parseCustomBackground(value: string): [string, string] | null {
  const m = CUSTOM_BACKGROUND.exec(value);
  return m ? [m[1], m[2]] : null;
}

export function customBackground(a: string, b: string): string {
  return `custom:${a.toLowerCase()},${b.toLowerCase()}`;
}

function rgba(hex: string, alpha: number, darken = 1): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.round(v * darken);
  return `rgba(${c((n >> 16) & 255)}, ${c((n >> 8) & 255)}, ${c(n & 255)}, ${alpha})`;
}

// Tint of the panels: 17 (the default) is the classic 7%; the top of the scale
// stops near 13% so the panels stay glassy and the text legible.
export function glassAlpha(glass: number): number {
  const v = normalizeGlass(glass);
  const alpha = v <= 17 ? 0.02 + v * 0.003 : 0.071 + (v - 17) * 0.0007;
  return Math.round(alpha * 1000) / 1000;
}

// CSS variables read by the "cristal" rules in globals.css.
export function glassCssVars(glass: number, background: string): Record<string, string> {
  const custom = parseCustomBackground(background);
  const preset = GLASS_BACKGROUNDS[(background in GLASS_BACKGROUNDS ? background : DEFAULT_GLASS_BACKGROUND) as GlassBackgroundName];
  const [c1, c2, c3] = custom ? [custom[0], custom[1], custom[1]] : preset.colors;
  const base = custom ? rgba(custom[0], 1, 0.1) : preset.base;
  return {
    "--glass-alpha": String(glassAlpha(glass)),
    "--bg-base": base,
    "--bg-a": rgba(c1, 0.7),
    "--bg-b": rgba(c2, 0.55),
    "--bg-c": rgba(c3, 0.5),
  };
}
