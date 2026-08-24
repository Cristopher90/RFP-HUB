// Fixed categorical order (validated for CVD-safety) — never cycle or reassign by rank.
export const CATEGORICAL_COLORS = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#eda100", // yellow
  "#e87ba4", // magenta
  "#008300", // green
  "#4a3aa7", // violet
  "#e34948", // red
];

export function colorForIndex(index: number) {
  return CATEGORICAL_COLORS[index % CATEGORICAL_COLORS.length];
}
