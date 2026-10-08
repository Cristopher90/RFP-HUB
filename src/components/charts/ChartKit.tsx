"use client";

import { usePreferences } from "@/i18n/PreferencesProvider";
import { CATEGORICAL_COLORS } from "@/lib/chartColors";

export type ChartType = "bar" | "column" | "donut" | "line";
export type Datum = { label: string; value: number };

const NEGATIVE = "#e34948";

function niceMax(value: number) {
  if (value <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

function truncate(text: string, max: number) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

// Axis scale that includes zero; supports negative values (savings can be
// negative).
function scaleOf(values: number[]) {
  const max = niceMax(Math.max(0, ...values));
  const rawMin = Math.min(0, ...values);
  const min = rawMin < 0 ? -niceMax(-rawMin) : 0;
  return { min, max };
}

export function ChartToggle({
  allowed,
  value,
  onChange,
}: {
  allowed: ChartType[];
  value: ChartType;
  onChange: (type: ChartType) => void;
}) {
  const { t } = usePreferences();
  return (
    <div className="inline-flex overflow-hidden rounded-lg border border-slate-300 text-sm">
      {allowed.map((type) => (
        <button
          key={type}
          type="button"
          onClick={() => onChange(type)}
          className={`px-3 py-1.5 font-medium ${
            value === type ? "bg-violet-600 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {t(`reportsPage.chart_${type}`)}
        </button>
      ))}
    </div>
  );
}

function HorizontalBars({ data, format }: { data: Datum[]; format: (v: number) => string }) {
  const max = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  return (
    <div className="space-y-2.5">
      {data.map((d, i) => (
        <div key={d.label + i}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ backgroundColor: d.value < 0 ? NEGATIVE : CATEGORICAL_COLORS[0] }}
              />
              <span className="truncate font-medium text-slate-700" title={d.label}>
                {d.label}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-600">{format(d.value)}</span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(2, (Math.abs(d.value) / max) * 100)}%`,
                backgroundColor: d.value < 0 ? NEGATIVE : CATEGORICAL_COLORS[0],
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

const W = 640;
const H = 280;
const PAD = { left: 56, right: 16, top: 16, bottom: 64 };

function Axes({
  min,
  max,
  format,
}: {
  min: number;
  max: number;
  format: (v: number) => string;
}) {
  const ticks = 4;
  const innerH = H - PAD.top - PAD.bottom;
  return (
    <g>
      {Array.from({ length: ticks + 1 }, (_, i) => {
        const value = min + ((max - min) * i) / ticks;
        const y = PAD.top + innerH - (innerH * i) / ticks;
        return (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y} y2={y} className="stroke-slate-200" strokeWidth={1} />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" className="fill-slate-500" fontSize={11}>
              {format(value)}
            </text>
          </g>
        );
      })}
    </g>
  );
}

function XLabels({ data }: { data: Datum[] }) {
  const innerW = W - PAD.left - PAD.right;
  const slot = innerW / Math.max(1, data.length);
  const rotate = data.length > 6;
  return (
    <g>
      {data.map((d, i) => {
        const x = PAD.left + slot * i + slot / 2;
        const y = H - PAD.bottom + 16;
        return (
          <text
            key={d.label + i}
            x={x}
            y={y}
            textAnchor={rotate ? "end" : "middle"}
            transform={rotate ? `rotate(-30 ${x} ${y})` : undefined}
            className="fill-slate-600"
            fontSize={11}
          >
            {truncate(d.label, 14)}
          </text>
        );
      })}
    </g>
  );
}

function Columns({ data, format }: { data: Datum[]; format: (v: number) => string }) {
  const { min, max } = scaleOf(data.map((d) => d.value));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const barW = Math.min(48, slot * 0.64);
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;
  const zero = y(0);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <Axes min={min} max={max} format={format} />
      {data.map((d, i) => {
        const x = PAD.left + slot * i + (slot - barW) / 2;
        const top = Math.min(y(d.value), zero);
        const height = Math.max(1, Math.abs(y(d.value) - zero));
        return (
          <g key={d.label + i}>
            <rect
              x={x}
              y={top}
              width={barW}
              height={height}
              rx={3}
              fill={d.value < 0 ? NEGATIVE : CATEGORICAL_COLORS[0]}
            >
              <title>{`${d.label}: ${format(d.value)}`}</title>
            </rect>
            {data.length <= 14 && (
              <text
                x={x + barW / 2}
                y={d.value < 0 ? top + height + 12 : top - 4}
                textAnchor="middle"
                className="fill-slate-600"
                fontSize={10}
              >
                {format(d.value)}
              </text>
            )}
          </g>
        );
      })}
      <line x1={PAD.left} x2={W - PAD.right} y1={zero} y2={zero} className="stroke-slate-400" strokeWidth={1} />
      <XLabels data={data} />
    </svg>
  );
}

function Lines({ data, format }: { data: Datum[]; format: (v: number) => string }) {
  const { min, max } = scaleOf(data.map((d) => d.value));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / data.length;
  const y = (v: number) => PAD.top + innerH - ((v - min) / (max - min)) * innerH;
  const points = data.map((d, i) => [PAD.left + slot * i + slot / 2, y(d.value)] as const);
  const path = points.map(([px, py]) => `${px},${py}`).join(" ");
  const area = `${points[0][0]},${y(0)} ${path} ${points[points.length - 1][0]},${y(0)}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      <Axes min={min} max={max} format={format} />
      <polygon points={area} fill={CATEGORICAL_COLORS[0]} opacity={0.12} />
      <polyline points={path} fill="none" stroke={CATEGORICAL_COLORS[0]} strokeWidth={2.5} strokeLinejoin="round" />
      {points.map(([px, py], i) => (
        <circle key={i} cx={px} cy={py} r={4} fill={CATEGORICAL_COLORS[0]} className="stroke-white" strokeWidth={1.5}>
          <title>{`${data[i].label}: ${format(data[i].value)}`}</title>
        </circle>
      ))}
      <XLabels data={data} />
    </svg>
  );
}

function Donut({ data, format }: { data: Datum[]; format: (v: number) => string }) {
  const { t } = usePreferences();
  const positive = data.filter((d) => d.value > 0);
  const top = positive.slice(0, 7);
  const rest = positive.slice(7).reduce((sum, d) => sum + d.value, 0);
  const slices = rest > 0 ? [...top, { label: t("reportsPage.others"), value: rest }] : top;
  const total = slices.reduce((s, d) => s + d.value, 0);
  const radius = 70;
  const circumference = 2 * Math.PI * radius;
  if (total <= 0) return null;
  const lengths = slices.map((s) => (s.value / total) * circumference);
  const offsets = lengths.map((_, i) => lengths.slice(0, i).reduce((a, b) => a + b, 0));
  return (
    <div className="flex flex-wrap items-center gap-8">
      <svg viewBox="0 0 200 200" className="h-52 w-52 shrink-0 -rotate-90" role="img">
        {slices.map((slice, i) => (
          <circle
            key={slice.label + i}
            cx={100}
            cy={100}
            r={radius}
            fill="none"
            stroke={CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length]}
            strokeWidth={34}
            strokeDasharray={`${lengths[i]} ${circumference - lengths[i]}`}
            strokeDashoffset={-offsets[i]}
          >
            <title>{`${slice.label}: ${format(slice.value)}`}</title>
          </circle>
        ))}
        <text
          x={100}
          y={104}
          textAnchor="middle"
          className="rotate-90 fill-slate-800"
          style={{ transformOrigin: "100px 100px" }}
          fontSize={18}
          fontWeight={600}
        >
          {format(total)}
        </text>
      </svg>
      <ul className="min-w-[12rem] flex-1 space-y-1.5 text-sm">
        {slices.map((slice, i) => (
          <li key={slice.label + i} className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: CATEGORICAL_COLORS[i % CATEGORICAL_COLORS.length] }}
              />
              <span className="truncate text-slate-700" title={slice.label}>
                {slice.label}
              </span>
            </span>
            <span className="shrink-0 tabular-nums text-slate-500">
              {format(slice.value)} · {Math.round((slice.value / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Chart({
  type,
  data,
  format = (v: number) => String(Math.round(v * 100) / 100),
  maxItems = 12,
}: {
  type: ChartType;
  data: Datum[];
  format?: (value: number) => string;
  maxItems?: number;
}) {
  const { t } = usePreferences();
  if (data.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-slate-400">
        {t("reportsPage.noData")}
      </div>
    );
  }
  const shown = type === "donut" ? data : data.slice(0, maxItems);
  if (type === "bar") return <HorizontalBars data={shown} format={format} />;
  if (type === "column") return <Columns data={shown} format={format} />;
  if (type === "line") return <Lines data={shown} format={format} />;
  return <Donut data={shown} format={format} />;
}
