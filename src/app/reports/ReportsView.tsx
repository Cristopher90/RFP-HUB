"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePreferences } from "@/i18n/PreferencesProvider";
import { statusLabel } from "@/i18n/labels";
import { Chart, ChartToggle, type ChartType } from "@/components/charts/ChartKit";
import type { ReportData } from "@/lib/reportsData";

type TabKey = "summary" | "spend" | "suppliers" | "areas" | "buyers" | "times" | "noResponse" | "prices";
const TABS: TabKey[] = ["summary", "spend", "suppliers", "areas", "buyers", "times", "noResponse", "prices"];

const sum = (values: number[]) => values.reduce((a, b) => a + b, 0);
const avg = (values: number[]) => (values.length ? sum(values) / values.length : 0);
const round1 = (v: number) => Math.round(v * 10) / 10;

function groupBy<T>(rows: T[], key: (row: T) => string) {
  const map = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    map.set(k, [...(map.get(k) ?? []), row]);
  }
  return map;
}

function Card({ title, hint, controls, children }: { title?: string; hint?: string; controls?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {(title || controls) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-slate-800">{title}</h2>}
            {hint && <p className="mt-0.5 text-xs text-slate-500">{hint}</p>}
          </div>
          {controls && <div className="flex flex-wrap items-center gap-2">{controls}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

function Select<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-slate-500">
      {label}
      <select
        className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
        value={value}
        onChange={(e) => onChange(e.target.value as V)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function Table({ columns, rows }: { columns: string[]; rows: (string | number | React.ReactNode)[][] }) {
  const { t } = usePreferences();
  if (rows.length === 0) return null;
  return (
    <div className="mt-5 overflow-x-auto rounded-lg border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
          <tr>
            {columns.map((c, i) => (
              <th key={c + i} className={`px-4 py-2.5 ${i > 0 ? "text-right" : ""}`}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.slice(0, 200).map((row, ri) => (
            <tr key={ri} className="hover:bg-slate-50">
              {row.map((cell, ci) => (
                <td key={ci} className={`px-4 py-2 ${ci > 0 ? "text-right tabular-nums text-slate-600" : "font-medium text-slate-800"}`}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 200 && <p className="px-4 py-2 text-xs text-slate-400">{t("reportsPage.firstRows").replace("{count}", "200")}</p>}
    </div>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "good" ? "text-emerald-600" : tone === "bad" ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function ReportsView({ data }: { data: ReportData }) {
  const { t, formatCurrency, locale, dictionary } = usePreferences();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const [tab, setTab] = useState<TabKey>("summary");
  const money = (v: number) => formatCurrency(v, data.currency);
  // Short amounts for chart labels and KPI cards: $12.1k, $3.4M.
  const currencySymbol =
    new Intl.NumberFormat(locale, { style: "currency", currency: data.currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0)
      .find((part) => part.type === "currency")?.value ?? data.currency;
  const compactMoney = (v: number) => {
    const abs = Math.abs(v);
    const [scaled, suffix] = abs >= 1e9 ? [v / 1e9, "B"] : abs >= 1e6 ? [v / 1e6, "M"] : abs >= 1e3 ? [v / 1e3, "k"] : [v, ""];
    const text = new Intl.NumberFormat(locale, { maximumFractionDigits: suffix ? 1 : 0 }).format(Math.abs(scaled));
    return `${v < 0 ? "-" : ""}${currencySymbol}${text}${suffix}`;
  };
  const pct = (v: number) => `${round1(v)}%`;
  const noValue = t("reportsPage.noValue");
  const monthLabel = (key: string) => {
    const [y, m] = key.split("-").map(Number);
    return new Intl.DateTimeFormat(locale, { month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
  };

  // ----- Shared aggregates -----
  const spendTotal = sum(data.savings.map((s) => s.awardedTotal));
  const histRows = data.savings.filter((s) => s.savingsHistorical !== null);
  const savingsTotal = sum(histRows.map((s) => s.savingsHistorical!));
  const savingsBase = sum(histRows.map((s) => s.historicalTotal!));
  const savingsPct = savingsBase > 0 ? (savingsTotal / savingsBase) * 100 : 0;
  const invited = sum(data.rfps.map((r) => r.invited));
  const responded = sum(data.rfps.map((r) => r.responded));
  const responseRate = invited > 0 ? (responded / invited) * 100 : 0;
  const avgApproval = avg(data.approvals.map((a) => a.hours));
  const avgAward = avg(data.rfps.map((r) => r.daysToAward).filter((d): d is number => d !== null));
  const spendBySupplier = [...groupBy(data.savings, (s) => s.supplier).entries()]
    .map(([name, rows]) => ({ name, value: sum(rows.map((r) => r.awardedTotal)) }))
    .sort((a, b) => b.value - a.value);
  const top3Share = spendTotal > 0 ? (sum(spendBySupplier.slice(0, 3).map((s) => s.value)) / spendTotal) * 100 : 0;
  const topSupplier = spendBySupplier[0];

  const insights: { text: string; tone: "warn" | "good" | "info" }[] = [];
  if (data.noResponse.length > 0) {
    insights.push({ tone: "warn", text: t("reportsPage.insightNoResponse").replace("{count}", String(data.noResponse.length)) });
  }
  if (topSupplier && spendTotal > 0 && (topSupplier.value / spendTotal) * 100 >= 40 && spendBySupplier.length > 1) {
    insights.push({
      tone: "warn",
      text: t("reportsPage.insightConcentration")
        .replace("{supplier}", topSupplier.name)
        .replace("{pct}", String(Math.round((topSupplier.value / spendTotal) * 100))),
    });
  }
  if (avgApproval > 48) {
    insights.push({ tone: "warn", text: t("reportsPage.insightApproval").replace("{hours}", String(Math.round(avgApproval))) });
  }
  if (histRows.length > 0) {
    insights.push(
      savingsTotal >= 0
        ? { tone: "good", text: t("reportsPage.insightSavingsGood").replace("{amount}", money(savingsTotal)).replace("{pct}", pct(savingsPct)) }
        : { tone: "warn", text: t("reportsPage.insightSavingsBad").replace("{amount}", money(-savingsTotal)) },
    );
  }
  const lowResponders = data.suppliers.filter((s) => s.invited >= 3 && s.responded / s.invited < 0.3);
  if (lowResponders.length > 0) {
    insights.push({
      tone: "info",
      text:
        lowResponders.length === 1
          ? t("reportsPage.insightLowRespondersOne")
          : t("reportsPage.insightLowResponders").replace("{count}", String(lowResponders.length)),
    });
  }

  // ----- Per-tab state -----
  const [summaryChart, setSummaryChart] = useState<ChartType>("column");

  const [spendMetric, setSpendMetric] = useState<"spend" | "savings" | "savingsPct">("spend");
  const [spendBasis, setSpendBasis] = useState<"historical" | "average">("historical");
  const [spendGroup, setSpendGroup] = useState<"month" | "commodity" | "region" | "buyer" | "supplier" | "rfp">("month");
  const [spendChart, setSpendChart] = useState<ChartType>("column");

  const [supplierMetric, setSupplierMetric] = useState<"invited" | "responded" | "awarded" | "responseRate" | "winRate">("invited");
  const [supplierChart, setSupplierChart] = useState<ChartType>("bar");

  const [areaDim, setAreaDim] = useState<"commodity" | "region">("commodity");
  const [areaMetric, setAreaMetric] = useState<"rfps" | "awarded" | "spend" | "savings">("rfps");
  const [areaChart, setAreaChart] = useState<ChartType>("bar");

  const [buyerMetric, setBuyerMetric] = useState<"rfps" | "awarded" | "awardedValue" | "savings" | "responseRate">("rfps");
  const [buyerChart, setBuyerChart] = useState<ChartType>("bar");

  const [timeKind, setTimeKind] = useState<"approval" | "close" | "award">("approval");
  const [timeGroup, setTimeGroup] = useState<"stage" | "approver" | "month" | "commodity" | "buyer">("stage");
  const [timeChart, setTimeChart] = useState<ChartType>("bar");

  const [noRespGroup, setNoRespGroup] = useState<"commodity" | "region" | "buyer" | "status">("commodity");
  const [noRespChart, setNoRespChart] = useState<ChartType>("bar");

  const [itemQuery, setItemQuery] = useState("");
  const [itemKey, setItemKey] = useState<string>(data.items[0]?.key ?? "");
  const [priceChart, setPriceChart] = useState<ChartType>("line");

  // ----- Tab bodies -----
  function summaryTab() {
    const byMonth = [...groupBy(data.savings, (s) => s.month).entries()]
      .map(([m, rows]) => ({ label: monthLabel(m), key: m, value: sum(rows.map((r) => r.awardedTotal)) }))
      .sort((a, b) => a.key.localeCompare(b.key));
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Kpi label={t("reportsPage.kpiRfps")} value={String(data.rfpCount)} sub={`${data.rfps.filter((r) => r.awarded).length} ${t("reportsPage.kpiAwardedSub")}`} />
          <Kpi label={t("reportsPage.kpiSpend")} value={compactMoney(spendTotal)} sub={money(spendTotal)} />
          <Kpi
            label={t("reportsPage.kpiSavings")}
            value={histRows.length ? compactMoney(savingsTotal) : "—"}
            sub={histRows.length ? pct(savingsPct) : t("reportsPage.noReference")}
            tone={histRows.length ? (savingsTotal >= 0 ? "good" : "bad") : undefined}
          />
          <Kpi label={t("reportsPage.kpiResponseRate")} value={pct(responseRate)} sub={`${responded} / ${invited}`} />
          <Kpi label={t("reportsPage.kpiApproval")} value={data.approvals.length ? `${round1(avgApproval)} h` : "—"} sub={`${data.approvals.length} ${t("reportsPage.decisions")}`} />
          <Kpi label={t("reportsPage.kpiCycle")} value={avgAward ? `${round1(avgAward)} ${t("reportsPage.daysShort")}` : "—"} sub={t("reportsPage.kpiCycleSub")} />
          <Kpi label={t("reportsPage.kpiNoResponse")} value={String(data.noResponse.length)} tone={data.noResponse.length ? "bad" : undefined} />
          <Kpi label={t("reportsPage.kpiTop3")} value={spendTotal > 0 ? pct(top3Share) : "—"} sub={`${spendBySupplier.length} ${t("reportsPage.suppliersWithSpend")}`} />
        </div>

        {insights.length > 0 && (
          <Card title={t("reportsPage.insightsTitle")}>
            <ul className="space-y-2 text-sm">
              {insights.map((i, idx) => (
                <li key={idx} className="flex gap-2">
                  <span className={i.tone === "warn" ? "text-amber-500" : i.tone === "good" ? "text-emerald-500" : "text-violet-500"}>●</span>
                  <span className="text-slate-700">{i.text}</span>
                </li>
              ))}
            </ul>
          </Card>
        )}

        <div className="grid gap-6 lg:grid-cols-2">
          <Card
            title={t("reportsPage.spendByMonth")}
            controls={<ChartToggle allowed={["column", "line", "bar"]} value={summaryChart} onChange={setSummaryChart} />}
          >
            <Chart type={summaryChart} data={byMonth} format={compactMoney} />
          </Card>
          <Card title={t("reportsPage.spendBySupplier")}>
            <Chart type="donut" data={spendBySupplier.map((s) => ({ label: s.name, value: s.value }))} format={compactMoney} />
          </Card>
        </div>
      </div>
    );
  }

  function spendTab() {
    const dimLabel = (s: ReportData["savings"][number]) =>
      spendGroup === "month" ? s.month
      : spendGroup === "commodity" ? s.commodity || noValue
      : spendGroup === "region" ? s.region || noValue
      : spendGroup === "buyer" ? s.buyer
      : spendGroup === "supplier" ? s.supplier
      : `RFP-${s.number}`;
    const savingsOf = (s: ReportData["savings"][number]) => (spendBasis === "historical" ? s.savingsHistorical : s.savingsAverage);
    const baseOf = (s: ReportData["savings"][number]) => (spendBasis === "historical" ? s.historicalTotal : s.averageTotal);
    const groups = [...groupBy(data.savings, dimLabel).entries()].map(([key, rows]) => {
      const withSavings = rows.filter((r) => savingsOf(r) !== null);
      const sv = sum(withSavings.map((r) => savingsOf(r)!));
      const base = sum(withSavings.map((r) => baseOf(r)!));
      return { key, rfps: rows.length, spend: sum(rows.map((r) => r.awardedTotal)), savings: sv, savingsPct: base > 0 ? (sv / base) * 100 : 0, hasSavings: withSavings.length > 0 };
    });
    const valueOf = (g: (typeof groups)[number]) => (spendMetric === "spend" ? g.spend : spendMetric === "savings" ? g.savings : g.savingsPct);
    const labelOf = (key: string) => (spendGroup === "month" ? monthLabel(key) : key);
    const ordered = spendGroup === "month" ? [...groups].sort((a, b) => a.key.localeCompare(b.key)) : [...groups].sort((a, b) => valueOf(b) - valueOf(a));
    const chartData = ordered.map((g) => ({ label: labelOf(g.key), value: round1(valueOf(g)) }));
    const total = sum(groups.map((g) => g.spend));
    let cumulative = 0;
    const allowed: ChartType[] = spendGroup === "month" ? ["column", "line", "bar", "donut"] : ["bar", "column", "donut"];
    const chart = allowed.includes(spendChart) ? spendChart : allowed[0];
    const fmt = spendMetric === "savingsPct" ? pct : compactMoney;
    return (
      <Card
        title={t("reportsPage.spendTitle")}
        hint={t("reportsPage.spendHint")}
        controls={
          <>
            <Select label={t("reportsPage.metric")} value={spendMetric} onChange={setSpendMetric} options={[
              { value: "spend", label: t("reportsPage.mSpend") }, { value: "savings", label: t("reportsPage.mSavings") }, { value: "savingsPct", label: t("reportsPage.mSavingsPct") }]} />
            {spendMetric !== "spend" && (
              <Select label={t("reportsPage.basis")} value={spendBasis} onChange={setSpendBasis} options={[
                { value: "historical", label: t("reportsPage.basisHistorical") }, { value: "average", label: t("reportsPage.basisAverage") }]} />
            )}
            <Select label={t("reportsPage.groupBy")} value={spendGroup} onChange={setSpendGroup} options={[
              { value: "month", label: t("reportsPage.gMonth") }, { value: "commodity", label: t("reportsPage.gCommodity") }, { value: "region", label: t("reportsPage.gRegion") },
              { value: "buyer", label: t("reportsPage.gBuyer") }, { value: "supplier", label: t("reportsPage.gSupplier") }, { value: "rfp", label: "RFP" }]} />
            <ChartToggle allowed={allowed} value={chart} onChange={setSpendChart} />
          </>
        }
      >
        <Chart type={chart} data={spendMetric === "spend" || spendGroup === "month" ? chartData : chartData} format={fmt} />
        <Table
          columns={[t("reportsPage.group"), "RFP", t("reportsPage.mSpend"), t("reportsPage.shareOfSpend"), t("reportsPage.cumulative"), t("reportsPage.mSavings"), t("reportsPage.mSavingsPct")]}
          rows={[...groups].sort((a, b) => b.spend - a.spend).map((g) => {
            cumulative += g.spend;
            return [
              labelOf(g.key),
              g.rfps,
              money(g.spend),
              total > 0 ? pct((g.spend / total) * 100) : "—",
              total > 0 ? pct((cumulative / total) * 100) : "—",
              g.hasSavings ? money(g.savings) : "—",
              g.hasSavings ? pct(g.savingsPct) : "—",
            ];
          })}
        />
      </Card>
    );
  }

  function suppliersTab() {
    const rows = data.suppliers.map((s) => ({
      ...s,
      responseRate: s.invited > 0 ? (s.responded / s.invited) * 100 : 0,
      winRate: s.invited > 0 ? (s.awarded / s.invited) * 100 : 0,
    }));
    const valueOf = (r: (typeof rows)[number]) => r[supplierMetric];
    const ordered = [...rows].sort((a, b) => valueOf(b) - valueOf(a));
    const isPct = supplierMetric === "responseRate" || supplierMetric === "winRate";
    const allowed: ChartType[] = ["bar", "column", "donut"];
    return (
      <Card
        title={t("reportsPage.suppliersTitle")}
        hint={t("reportsPage.suppliersHint")}
        controls={
          <>
            <Select label={t("reportsPage.metric")} value={supplierMetric} onChange={setSupplierMetric} options={[
              { value: "invited", label: t("reportsPage.mInvited") }, { value: "responded", label: t("reportsPage.mResponded") }, { value: "awarded", label: t("reportsPage.mAwarded") },
              { value: "responseRate", label: t("reportsPage.mResponseRate") }, { value: "winRate", label: t("reportsPage.mWinRate") }]} />
            <ChartToggle allowed={allowed} value={supplierChart} onChange={setSupplierChart} />
          </>
        }
      >
        <Chart type={supplierChart} data={ordered.map((r) => ({ label: r.name, value: round1(valueOf(r)) }))} format={isPct ? pct : undefined} />
        <Table
          columns={[t("reportsPage.gSupplier"), t("reportsPage.mInvited"), t("reportsPage.mResponded"), t("reportsPage.mResponseRate"), t("reportsPage.mAwarded"), t("reportsPage.mWinRate")]}
          rows={ordered.map((r) => [r.name, r.invited, r.responded, pct(r.responseRate), r.awarded, pct(r.winRate)])}
        />
      </Card>
    );
  }

  function areasTab() {
    const keyOf = (r: { commodity: string; region: string }) => (areaDim === "commodity" ? r.commodity : r.region) || noValue;
    const rfpGroups = groupBy(data.rfps, keyOf);
    const savingsGroups = groupBy(data.savings, keyOf);
    const rows = [...rfpGroups.entries()].map(([name, rfps]) => {
      const sv = savingsGroups.get(name) ?? [];
      const hist = sv.filter((s) => s.savingsHistorical !== null);
      return {
        name,
        rfps: rfps.length,
        awarded: rfps.filter((r) => r.awarded).length,
        invited: sum(rfps.map((r) => r.invited)),
        responded: sum(rfps.map((r) => r.responded)),
        spend: sum(sv.map((s) => s.awardedTotal)),
        savings: sum(hist.map((s) => s.savingsHistorical!)),
      };
    });
    const ordered = [...rows].sort((a, b) => b[areaMetric] - a[areaMetric]);
    const isMoney = areaMetric === "spend" || areaMetric === "savings";
    return (
      <Card
        title={t("reportsPage.areasTitle")}
        hint={t("reportsPage.areasHint")}
        controls={
          <>
            <Select label={t("reportsPage.groupBy")} value={areaDim} onChange={setAreaDim} options={[
              { value: "commodity", label: t("reportsPage.gCommodity") }, { value: "region", label: t("reportsPage.gRegion") }]} />
            <Select label={t("reportsPage.metric")} value={areaMetric} onChange={setAreaMetric} options={[
              { value: "rfps", label: t("reportsPage.mRfps") }, { value: "awarded", label: t("reportsPage.mAwarded") }, { value: "spend", label: t("reportsPage.mSpend") }, { value: "savings", label: t("reportsPage.mSavings") }]} />
            <ChartToggle allowed={["bar", "column", "donut"]} value={areaChart} onChange={setAreaChart} />
          </>
        }
      >
        <Chart type={areaChart} data={ordered.map((r) => ({ label: r.name, value: round1(r[areaMetric]) }))} format={isMoney ? compactMoney : undefined} />
        <Table
          columns={[areaDim === "commodity" ? t("reportsPage.gCommodity") : t("reportsPage.gRegion"), t("reportsPage.mRfps"), t("reportsPage.mAwarded"), t("reportsPage.mResponseRate"), t("reportsPage.mSpend"), t("reportsPage.mSavings")]}
          rows={ordered.map((r) => [r.name, r.rfps, r.awarded, r.invited ? pct((r.responded / r.invited) * 100) : "—", money(r.spend), money(r.savings)])}
        />
      </Card>
    );
  }

  function buyersTab() {
    const rows = data.buyers.map((b) => ({ ...b, responseRate: b.invited > 0 ? (b.responded / b.invited) * 100 : 0, savings: b.savingsHistorical }));
    const ordered = [...rows].sort((a, b) => b[buyerMetric] - a[buyerMetric]);
    const isMoney = buyerMetric === "awardedValue" || buyerMetric === "savings";
    return (
      <Card
        title={t("reportsPage.buyersTitle")}
        controls={
          <>
            <Select label={t("reportsPage.metric")} value={buyerMetric} onChange={setBuyerMetric} options={[
              { value: "rfps", label: t("reportsPage.mRfps") }, { value: "awarded", label: t("reportsPage.mAwarded") }, { value: "awardedValue", label: t("reportsPage.mSpend") },
              { value: "savings", label: t("reportsPage.mSavings") }, { value: "responseRate", label: t("reportsPage.mResponseRate") }]} />
            <ChartToggle allowed={["bar", "column", "donut"]} value={buyerChart} onChange={setBuyerChart} />
          </>
        }
      >
        <Chart type={buyerChart} data={ordered.map((r) => ({ label: r.name, value: round1(r[buyerMetric]) }))} format={isMoney ? compactMoney : buyerMetric === "responseRate" ? pct : undefined} />
        <Table
          columns={[t("reportsPage.gBuyer"), t("reportsPage.mRfps"), t("reportsPage.mAwarded"), t("reportsPage.mResponseRate"), t("reportsPage.mSpend"), t("reportsPage.mSavings")]}
          rows={ordered.map((r) => [r.name, r.rfps, r.awarded, pct(r.responseRate), money(r.awardedValue), money(r.savings)])}
        />
      </Card>
    );
  }

  function timesTab() {
    const approvalGroups = timeKind === "approval";
    const group = approvalGroups
      ? (["stage", "approver", "month"].includes(timeGroup) ? timeGroup : "stage")
      : (["commodity", "buyer", "month"].includes(timeGroup) ? timeGroup : "commodity");
    let groups: { key: string; label: string; values: number[] }[];
    if (approvalGroups) {
      const keyOf = (a: ReportData["approvals"][number]) => (group === "stage" ? a.stage : group === "approver" ? a.approver : a.month);
      groups = [...groupBy(data.approvals, keyOf).entries()].map(([key, rows]) => ({
        key,
        label: group === "stage" ? (key === "PUBLISH" ? t("reportsPage.stagePUBLISH") : t("reportsPage.stageAWARD")) : group === "month" ? monthLabel(key) : key,
        values: rows.map((r) => r.hours),
      }));
    } else {
      const field = timeKind === "close" ? "daysToClose" : "daysToAward";
      const keyOf = (r: ReportData["rfps"][number]) => (group === "commodity" ? r.commodity || noValue : group === "buyer" ? r.buyer : r.month);
      groups = [...groupBy(data.rfps.filter((r) => r[field] !== null), keyOf).entries()].map(([key, rows]) => ({
        key,
        label: group === "month" ? monthLabel(key) : key,
        values: rows.map((r) => r[field]!),
      }));
    }
    const unit = approvalGroups ? "h" : t("reportsPage.daysShort");
    const ordered = group === "month" ? [...groups].sort((a, b) => a.key.localeCompare(b.key)) : [...groups].sort((a, b) => avg(b.values) - avg(a.values));
    const allowed: ChartType[] = group === "month" ? ["line", "column", "bar"] : ["bar", "column"];
    const chart = allowed.includes(timeChart) ? timeChart : allowed[0];
    return (
      <Card
        title={t("reportsPage.timesTitle")}
        hint={approvalGroups ? t("reportsPage.timesHintApproval") : t("reportsPage.timesHintCycle")}
        controls={
          <>
            <Select label={t("reportsPage.measure")} value={timeKind} onChange={(v) => { setTimeKind(v); setTimeGroup(v === "approval" ? "stage" : "commodity"); }} options={[
              { value: "approval", label: t("reportsPage.tApproval") }, { value: "close", label: t("reportsPage.tClose") }, { value: "award", label: t("reportsPage.tAward") }]} />
            <Select label={t("reportsPage.groupBy")} value={group as typeof timeGroup} onChange={setTimeGroup} options={
              approvalGroups
                ? [{ value: "stage", label: t("reportsPage.gStage") }, { value: "approver", label: t("reportsPage.gApprover") }, { value: "month", label: t("reportsPage.gMonth") }]
                : [{ value: "commodity", label: t("reportsPage.gCommodity") }, { value: "buyer", label: t("reportsPage.gBuyer") }, { value: "month", label: t("reportsPage.gMonth") }]} />
            <ChartToggle allowed={allowed} value={chart} onChange={setTimeChart} />
          </>
        }
      >
        <Chart type={chart} data={ordered.map((g) => ({ label: g.label, value: round1(avg(g.values)) }))} format={(v) => `${round1(v)} ${unit}`} />
        <Table
          columns={[t("reportsPage.group"), t("reportsPage.samples"), `${t("reportsPage.average")} (${unit})`, `${t("reportsPage.maximum")} (${unit})`]}
          rows={ordered.map((g) => [g.label, g.values.length, round1(avg(g.values)), round1(Math.max(...g.values))])}
        />
      </Card>
    );
  }

  function noResponseTab() {
    const keyOf = (r: ReportData["noResponse"][number]) =>
      noRespGroup === "commodity" ? r.commodity || noValue
      : noRespGroup === "region" ? r.region || noValue
      : noRespGroup === "buyer" ? r.buyer
      : statusLabel(dictionary, r.status);
    const groups = [...groupBy(data.noResponse, keyOf).entries()].map(([label, rows]) => ({ label, value: rows.length })).sort((a, b) => b.value - a.value);
    return (
      <Card
        title={t("reportsPage.noResponseTitle")}
        hint={t("reportsPage.noResponseHint")}
        controls={
          <>
            <Select label={t("reportsPage.groupBy")} value={noRespGroup} onChange={setNoRespGroup} options={[
              { value: "commodity", label: t("reportsPage.gCommodity") }, { value: "region", label: t("reportsPage.gRegion") }, { value: "buyer", label: t("reportsPage.gBuyer") }, { value: "status", label: t("reportsPage.gStatus") }]} />
            <ChartToggle allowed={["bar", "column", "donut"]} value={noRespChart} onChange={setNoRespChart} />
          </>
        }
      >
        <Chart type={noRespChart} data={groups} />
        <Table
          columns={["RFP", t("reportsPage.gStatus"), t("reportsPage.gCommodity"), t("reportsPage.gRegion"), t("reportsPage.gBuyer"), t("reportsPage.mInvited")]}
          rows={data.noResponse.map((r) => [
            <Link key={r.id} href={`/rfps/${r.id}`} className="text-violet-700 hover:underline">RFP-{r.number} — {r.title}</Link>,
            statusLabel(dictionary, r.status),
            r.commodity || noValue,
            r.region || noValue,
            r.buyer,
            r.invited,
          ])}
        />
      </Card>
    );
  }

  function pricesTab() {
    const q = itemQuery.trim().toLowerCase();
    const matches = data.items.filter((i) => !q || i.label.toLowerCase().includes(q)).slice(0, 50);
    const item = data.items.find((i) => i.key === itemKey) ?? matches[0];
    if (!item) {
      return <Card title={t("reportsPage.pricesTitle")}><p className="text-sm text-slate-400">{t("reportsPage.noData")}</p></Card>;
    }
    const prices = item.points.map((p) => p.price);
    const ordered = [...item.points].sort((a, b) => a.date.localeCompare(b.date));
    const first = ordered[0].price;
    const last = ordered[ordered.length - 1].price;
    const change = first > 0 ? ((last - first) / first) * 100 : 0;
    const spread = Math.min(...prices) > 0 ? ((Math.max(...prices) - Math.min(...prices)) / Math.min(...prices)) * 100 : 0;
    const byMonth = [...groupBy(ordered, (p) => p.date.slice(0, 7)).entries()].map(([m, pts]) => ({ label: monthLabel(m), value: round1(avg(pts.map((p) => p.price)) * 100) / 100 }));
    const bySupplier = [...groupBy(item.points, (p) => p.supplier).entries()]
      .map(([label, pts]) => ({ label, value: Math.round(avg(pts.map((p) => p.price)) * 100) / 100 }))
      .sort((a, b) => a.value - b.value);
    const chart: ChartType = ["line", "column", "bar"].includes(priceChart) ? priceChart : "line";
    return (
      <Card
        title={t("reportsPage.pricesTitle")}
        hint={t("reportsPage.pricesHint")}
        controls={<ChartToggle allowed={["line", "column", "bar"]} value={chart} onChange={setPriceChart} />}
      >
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            className="w-56 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            placeholder={t("reportsPage.searchItem")}
            value={itemQuery}
            onChange={(e) => setItemQuery(e.target.value)}
          />
          <select
            className="min-w-[16rem] rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm shadow-sm focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500"
            value={item.key}
            onChange={(e) => setItemKey(e.target.value)}
          >
            {(matches.some((m) => m.key === item.key) ? matches : [item, ...matches]).map((i) => (
              <option key={i.key} value={i.key}>
                {i.label} ({i.points.length})
              </option>
            ))}
          </select>
        </div>
        <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Kpi label={t("reportsPage.min")} value={money(Math.min(...prices))} />
          <Kpi label={t("reportsPage.average")} value={money(avg(prices))} />
          <Kpi label={t("reportsPage.max")} value={money(Math.max(...prices))} />
          <Kpi label={t("reportsPage.variation")} value={pct(change)} sub={t("reportsPage.firstToLast")} tone={change > 0 ? "bad" : change < 0 ? "good" : undefined} />
          <Kpi label={t("reportsPage.spread")} value={pct(spread)} sub={t("reportsPage.spreadSub")} />
        </div>
        <Chart type={chart} data={chart === "line" ? byMonth : bySupplier} format={(v) => money(v)} />
        <Table
          columns={[t("reportsPage.colDate"), t("reportsPage.gSupplier"), t("reportsPage.unitPrice"), "RFP", t("reportsPage.mAwarded")]}
          rows={[...ordered].reverse().map((p) => [
            new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(new Date(p.date)),
            p.supplier,
            money(p.price),
            `RFP-${p.rfp}`,
            p.awarded ? "✓" : "",
          ])}
        />
      </Card>
    );
  }

  const body: Record<TabKey, () => React.ReactNode> = {
    summary: summaryTab,
    spend: spendTab,
    suppliers: suppliersTab,
    areas: areasTab,
    buyers: buyersTab,
    times: timesTab,
    noResponse: noResponseTab,
    prices: pricesTab,
  };

  // Numbers, currencies and dates are formatted with Intl, which can differ
  // slightly between server and browser: render the report on the client only.
  if (!mounted) return <div className="h-64" aria-hidden />;

  return (
    <div>
      <div className="mb-6 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`rounded-full px-4 py-1.5 text-sm font-medium ${
              tab === key ? "bg-violet-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {t(`reportsPage.tab_${key}`)}
          </button>
        ))}
      </div>
      {body[tab]()}
    </div>
  );
}
