import type { ReactNode } from "react";

// Building blocks of the "bento" interface style: a 6-column mosaic of tiles
// (dark, lime, lilac, peach or white). Server-safe (no hooks). Used only when
// the viewer has the bento style on; the screens' data and actions are the
// same as in the classic layout.

export type TileTone = "white" | "dark" | "lime" | "lilac" | "peach";
export type TileSpan = 1 | 2 | 3 | 4 | 5 | 6;

const TONES: Record<TileTone, string> = {
  white: "bg-white text-slate-900",
  dark: "bg-[#15151a] text-[#f3f2ee]",
  lime: "bg-[#d9f26b] text-[#15151a]",
  lilac: "bg-[#dcd6ff] text-[#15151a]",
  peach: "bg-[#ffd9c2] text-[#15151a]",
};

// Full class names so Tailwind can see them. Everything stacks on small screens.
const SPANS: Record<TileSpan, string> = {
  1: "md:col-span-1",
  2: "md:col-span-2",
  3: "md:col-span-3",
  4: "md:col-span-4",
  5: "md:col-span-5",
  6: "md:col-span-6",
};
const ROWS: Record<number, string> = { 1: "", 2: "md:row-span-2", 3: "md:row-span-3" };

export function BentoGrid({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`grid grid-cols-1 gap-3 md:grid-cols-6 ${className}`}>{children}</div>;
}

export function Tile({
  tone = "white",
  span = 2,
  rows = 1,
  className = "",
  children,
}: {
  tone?: TileTone;
  span?: TileSpan;
  rows?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`min-w-0 rounded-2xl p-5 ${TONES[tone]} ${SPANS[span]} ${ROWS[rows] ?? ""} ${className}`}
    >
      {children}
    </div>
  );
}

// A number with a label above and an optional line below.
export function Metric({
  label,
  value,
  sub,
  size = "md",
}: {
  label: string;
  value: ReactNode;
  sub?: ReactNode;
  size?: "md" | "lg";
}) {
  return (
    <div className="flex h-full flex-col justify-between gap-2">
      <span className="text-sm opacity-70">{label}</span>
      <span
        className={`font-medium leading-none tracking-tighter ${
          size === "lg" ? "text-7xl" : "text-5xl"
        }`}
      >
        {value}
      </span>
      {sub ? <span className="text-sm opacity-70">{sub}</span> : <span />}
    </div>
  );
}

export function TileTitle({ children }: { children: ReactNode }) {
  return <h2 className="mb-3 text-sm font-medium opacity-70">{children}</h2>;
}
