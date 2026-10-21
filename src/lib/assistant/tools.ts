import { participantWhere } from "@/lib/rfpAccess";
import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { findDecidedRfpIdsForUser, findPendingApprovalsForUser } from "@/lib/approvalEngine";
import { loadReportData } from "@/lib/reportsData";
import { nextRfpNumber } from "@/lib/rfpNumber";
import { zonedTimeToUtc } from "@/lib/timezone";
import { FORM_FIELDS, FORM_QUESTION_TYPES, type FormChange, type FormValidationIssue } from "@/lib/assistant/formChanges";

// What the assistant can do. Every data tool is read-only and scoped to the
// person asking (same visibility as the RFP list); the only write path is
// propose_rfp_draft, which just stores a proposal the user must confirm.

export type Artifact =
  | { type: "chart"; title: string; chartType: "bar" | "column" | "donut" | "line"; format: "number" | "currency" | "percent"; data: { label: string; value: number }[] }
  | { type: "table"; title: string; columns: string[]; rows: (string | number)[][] }
  | { type: "proposal"; id: string; title: string; summary: DraftSummary }
  // Only while someone edits an RFP: findings about the form, and changes the user can apply to it.
  | { type: "validation"; issues: FormValidationIssue[] }
  | { type: "formChanges"; id: string; summary: string; changes: FormChange[]; warnings: string[] };

export type DraftSummary = {
  title: string;
  description: string;
  commodity: string | null;
  region: string | null;
  deadline: string;
  items: { name: string; code: string | null; quantity: number; unit: string; historicalPrice: number | null }[];
  questions: { text: string; type: string }[];
  warnings: string[];
};

export type ToolContext = {
  user: { id: string; name: string; lastName: string | null; role: string; clientId: string; timezone: string; language: string };
  client: { id: string; currency: string };
  artifacts: Artifact[];
  // Set when the assistant runs inside the RFP form: the form's current state (JSON).
  form?: { snapshot: string };
};

const STATUSES = ["DRAFT", "PENDING_PUBLISH_APPROVAL", "AWAITING_START", "OPEN", "CLOSED"] as const;
const MAX_RESULT_CHARS = 28_000;

export const TOOLS: Anthropic.Tool[] = [
  {
    name: "list_rfps",
    description:
      "Lists the RFPs the user can see (their own; or all of the client's RFPs for administrators; or the ones assigned for approval, for approvers). Use it to find RFPs by status, text or creation date. Returns compact rows.",
    input_schema: {
      type: "object",
      properties: {
        status: { type: "string", enum: [...STATUSES], description: "Only RFPs in this status." },
        query: { type: "string", description: "Text to look for in the title." },
        created_from: { type: "string", description: "ISO date (YYYY-MM-DD), creation date from." },
        created_to: { type: "string", description: "ISO date (YYYY-MM-DD), creation date to." },
        limit: { type: "integer", description: "Max rows, default 30, max 60." },
      },
    },
  },
  {
    name: "get_rfp",
    description:
      "Full detail of one RFP by its number: header data, items with historical price, questions, invited suppliers with their response totals, and the award. Responses of blind RFPs that are still open are hidden.",
    input_schema: {
      type: "object",
      properties: { number: { type: "integer", description: "The RFP number, e.g. 12 for RFP-12." } },
      required: ["number"],
    },
  },
  {
    name: "get_report_data",
    description:
      "Aggregated analytics over the RFPs the user can see: supplier performance, awarded spend and savings per RFP, buyers, approval times, RFPs without responses and item price statistics. Pick only the sections you need. Savings = (reference price - awarded price) x quantity; the reference is the item's historical price or the average offer.",
    input_schema: {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: { type: "string", enum: ["summary", "suppliers", "rfps", "savings", "buyers", "approvals", "no_response", "item_prices"] },
          description: "Which sections to return. Default: summary.",
        },
        from: { type: "string", description: "ISO date, RFP creation date from." },
        to: { type: "string", description: "ISO date, RFP creation date to." },
      },
    },
  },
  {
    name: "search_suppliers",
    description: "Searches the client's supplier directory by code, tax ID (CIF), company name or email.",
    input_schema: {
      type: "object",
      properties: { query: { type: "string" } },
      required: ["query"],
    },
  },
  {
    name: "list_master_data",
    description: "Lists valid commodity, region or origin names of this client, to use exact values when drafting an RFP.",
    input_schema: {
      type: "object",
      properties: { kind: { type: "string", enum: ["commodities", "regions", "origins"] } },
      required: ["kind"],
    },
  },
  {
    name: "show_chart",
    description:
      "Shows a chart to the user. Call it after you have the numbers (from the other tools). Use bar for rankings, column for categories, line for time series, donut for shares.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        chart_type: { type: "string", enum: ["bar", "column", "donut", "line"] },
        value_format: { type: "string", enum: ["number", "currency", "percent"] },
        data: {
          type: "array",
          items: { type: "object", properties: { label: { type: "string" }, value: { type: "number" } }, required: ["label", "value"] },
        },
      },
      required: ["title", "chart_type", "data"],
    },
  },
  {
    name: "show_table",
    description: "Shows a table to the user (max 100 rows).",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        columns: { type: "array", items: { type: "string" } },
        rows: { type: "array", items: { type: "array", items: { type: ["string", "number"] } } },
      },
      required: ["title", "columns", "rows"],
    },
  },
  {
    name: "propose_rfp_draft",
    description:
      "Prepares a DRAFT RFP for the user to review. It does NOT create anything: the user sees the proposal and decides whether to create it. Use list_master_data first to use valid commodity/region names. Items need a name, quantity and unit; add a historical price when you know a realistic one.",
    input_schema: {
      type: "object",
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        commodity: { type: "string" },
        region: { type: "string" },
        deadline: { type: "string", description: "ISO date (YYYY-MM-DD) when suppliers must answer by. Default: in 14 days." },
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              name: { type: "string" },
              code: { type: "string" },
              quantity: { type: "number" },
              unit: { type: "string" },
              historical_price: { type: "number" },
            },
            required: ["name", "quantity", "unit"],
          },
        },
        questions: {
          type: "array",
          items: {
            type: "object",
            properties: { text: { type: "string" }, type: { type: "string", enum: ["TEXT", "NUMBER", "YES_NO", "SELECT"] }, options: { type: "array", items: { type: "string" } } },
            required: ["text", "type"],
          },
        },
      },
      required: ["title", "items"],
    },
  },
];

// ---------- scoping ----------

async function visibleRfpWhere(ctx: ToolContext): Promise<Prisma.RfpWhereInput> {
  const { user } = ctx;
  const base: Prisma.RfpWhereInput = { clientId: ctx.client.id };
  if (user.role === "ADMIN" || user.role === "CLIENT_ADMIN") return base;
  if (user.role === "APPROVER") {
    const pending = await findPendingApprovalsForUser(user.id);
    const decided = await findDecidedRfpIdsForUser(user.id);
    return { ...base, id: { in: [...new Set([...pending.map((p) => p.rfpId), ...decided])] } };
  }
  return { ...base, ...participantWhere(user.id) };
}

const personName = (u: { name: string; lastName: string | null } | null | undefined) => (u ? `${u.name} ${u.lastName ?? ""}`.trim() : null);
const isoDate = (v: unknown): Date | undefined => (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00:00.000Z`) : undefined);
const clip = (text: string) => (text.length > MAX_RESULT_CHARS ? `${text.slice(0, MAX_RESULT_CHARS)}…[truncated]` : text);
const round2 = (n: number) => Math.round(n * 100) / 100;

// ---------- executors ----------

async function listRfps(input: Record<string, unknown>, ctx: ToolContext) {
  const status = typeof input.status === "string" && (STATUSES as readonly string[]).includes(input.status) ? (input.status as (typeof STATUSES)[number]) : undefined;
  const limit = Math.min(Math.max(Number(input.limit) || 30, 1), 60);
  const from = isoDate(input.created_from);
  const to = isoDate(input.created_to);
  const rfps = await prisma.rfp.findMany({
    where: {
      ...(await visibleRfpWhere(ctx)),
      status: status ?? { not: "DELETED" },
      ...(typeof input.query === "string" && input.query.trim() ? { title: { contains: input.query.trim(), mode: "insensitive" } } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: new Date(to.getTime() + 86_399_999) } : {}) } } : {}),
    },
    include: { createdBy: { select: { name: true, lastName: true } }, invitations: { select: { response: { select: { id: true } } } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rfps.map((r) => {
    const blind = r.hideResponsesUntilClosed && r.status === "OPEN";
    return {
      number: r.number,
      title: r.title,
      status: r.status,
      commodity: r.commodity,
      region: r.region,
      buyer: personName(r.createdBy),
      estimatedPrice: r.estimatedPrice,
      deadline: r.deadlineAt.toISOString().slice(0, 10),
      invited: r.invitations.length,
      responded: blind ? null : r.invitations.filter((i) => i.response).length,
      awarded: Boolean(r.awardedInvitationId),
    };
  });
}

async function getRfp(input: Record<string, unknown>, ctx: ToolContext) {
  const rfp = await prisma.rfp.findFirst({
    where: { ...(await visibleRfpWhere(ctx)), number: Number(input.number) },
    include: {
      createdBy: { select: { name: true, lastName: true } },
      items: { orderBy: { order: "asc" } },
      questions: { orderBy: { order: "asc" } },
      invitations: { include: { supplier: true, response: { include: { itemPrices: true } } } },
    },
  });
  if (!rfp) return { error: "RFP not found or not visible to this user." };
  const blind = rfp.hideResponsesUntilClosed && rfp.status === "OPEN";
  const totalOf = (resp: { itemPrices: { itemId: string; unitPrice: number }[] } | null) =>
    resp ? round2(rfp.items.reduce((s, it) => s + (resp.itemPrices.find((p) => p.itemId === it.id)?.unitPrice ?? 0) * it.quantity, 0)) : null;
  return {
    number: rfp.number,
    title: rfp.title,
    description: rfp.description,
    status: rfp.status,
    buyer: personName(rfp.createdBy),
    commodity: rfp.commodity,
    region: rfp.region,
    estimatedPrice: rfp.estimatedPrice,
    createdAt: rfp.createdAt.toISOString().slice(0, 10),
    deadline: rfp.deadlineAt.toISOString().slice(0, 10),
    publishedAt: rfp.publishedAt?.toISOString().slice(0, 10) ?? null,
    items: rfp.items.map((i) => ({ code: i.code, name: i.name, quantity: i.quantity, unit: i.unit, historicalPrice: i.historicalPrice })),
    questions: rfp.questions.map((q) => ({ text: q.text, type: q.type, required: q.required })),
    invitations: blind
      ? "hidden: blind RFP still open"
      : rfp.invitations.map((inv) => ({
          supplier: inv.supplier.company || inv.supplier.name,
          status: inv.status,
          respondedAt: inv.response?.submittedAt.toISOString().slice(0, 10) ?? null,
          total: totalOf(inv.response),
          awarded: inv.id === rfp.awardedInvitationId,
        })),
    awardedAt: rfp.awardedAt?.toISOString().slice(0, 10) ?? null,
    currency: ctx.client.currency,
  };
}

async function getReportData(input: Record<string, unknown>, ctx: ToolContext) {
  const sections = Array.isArray(input.sections) && input.sections.length ? (input.sections as string[]) : ["summary"];
  const from = isoDate(input.from);
  const toRaw = isoDate(input.to);
  const data = await loadReportData({
    user: ctx.user,
    clientId: ctx.client.id,
    from,
    to: toRaw ? new Date(toRaw.getTime() + 86_399_999) : undefined,
  });
  const out: Record<string, unknown> = { currency: data.currency, scope: data.scope, rfpCount: data.rfpCount };
  const want = (s: string) => sections.includes(s);
  if (want("summary")) {
    const spend = data.savings.reduce((s, r) => s + r.awardedTotal, 0);
    const hist = data.savings.filter((r) => r.savingsHistorical !== null);
    const invited = data.rfps.reduce((s, r) => s + r.invited, 0);
    const responded = data.rfps.reduce((s, r) => s + r.responded, 0);
    out.summary = {
      awardedRfps: data.rfps.filter((r) => r.awarded).length,
      awardedSpend: round2(spend),
      savingsVsHistorical: round2(hist.reduce((s, r) => s + r.savingsHistorical!, 0)),
      historicalBase: round2(hist.reduce((s, r) => s + r.historicalTotal!, 0)),
      invitations: invited,
      responses: responded,
      responseRatePct: invited ? round2((responded / invited) * 100) : null,
      avgApprovalHours: data.approvals.length ? round2(data.approvals.reduce((s, a) => s + a.hours, 0) / data.approvals.length) : null,
      rfpsWithoutResponses: data.noResponse.length,
    };
  }
  if (want("suppliers")) out.suppliers = data.suppliers;
  if (want("rfps")) out.rfps = data.rfps.slice(0, 300);
  if (want("savings")) out.savings = data.savings;
  if (want("buyers")) out.buyers = data.buyers;
  if (want("approvals")) {
    const byKey = new Map<string, number[]>();
    for (const a of data.approvals) byKey.set(`${a.stage} · ${a.approver}`, [...(byKey.get(`${a.stage} · ${a.approver}`) ?? []), a.hours]);
    out.approvals = [...byKey.entries()].map(([k, v]) => ({ stageAndApprover: k, decisions: v.length, avgHours: round2(v.reduce((s, x) => s + x, 0) / v.length), maxHours: Math.max(...v) }));
  }
  if (want("no_response")) out.noResponse = data.noResponse;
  if (want("item_prices")) {
    out.itemPrices = data.items.slice(0, 40).map((it) => {
      const prices = it.points.map((p) => p.price);
      const sorted = [...it.points].sort((a, b) => a.date.localeCompare(b.date));
      return { item: it.label, unit: it.unit, offers: prices.length, min: Math.min(...prices), avg: round2(prices.reduce((s, p) => s + p, 0) / prices.length), max: Math.max(...prices), first: sorted[0].price, last: sorted[sorted.length - 1].price };
    });
  }
  return out;
}

async function searchSuppliers(input: Record<string, unknown>, ctx: ToolContext) {
  const q = String(input.query ?? "").trim();
  if (!q) return { error: "Empty query" };
  const rows = await prisma.supplierDirectory.findMany({
    where: {
      clientId: ctx.client.id,
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { taxId: { contains: q, mode: "insensitive" } },
        { companyName: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    },
    include: { userLinks: { where: { status: "ACCEPTED" }, select: { id: true } } },
    take: 20,
  });
  return rows.map((s) => ({ code: s.code, taxId: s.taxId, company: s.companyName, contact: `${s.contactFirstName} ${s.contactLastName}`.trim(), email: s.email, status: s.status, acceptedPortalContacts: s.userLinks.length }));
}

async function listMasterData(input: Record<string, unknown>, ctx: ToolContext) {
  const where = { clientId: ctx.client.id };
  const rows =
    input.kind === "commodities"
      ? await prisma.commodity.findMany({ where: { ...where, selectable: true }, select: { code: true, description: true }, orderBy: { description: "asc" }, take: 300 })
      : input.kind === "regions"
        ? await prisma.region.findMany({ where, select: { code: true, description: true }, orderBy: { description: "asc" }, take: 300 })
        : input.kind === "origins"
          ? await prisma.origin.findMany({ where, select: { code: true, description: true }, orderBy: { description: "asc" }, take: 300 })
          : [];
  return rows;
}

async function proposeDraft(input: Record<string, unknown>, ctx: ToolContext) {
  const warnings: string[] = [];
  const title = String(input.title ?? "").trim().slice(0, 200);
  if (!title) return { error: "title is required" };
  const rawItems = Array.isArray(input.items) ? (input.items as Record<string, unknown>[]) : [];
  const items = rawItems
    .slice(0, 40)
    .map((i) => ({
      name: String(i.name ?? "").trim().slice(0, 200),
      code: i.code ? String(i.code).trim().slice(0, 40) : null,
      quantity: Number(i.quantity),
      unit: String(i.unit ?? "unidad").trim().slice(0, 30) || "unidad",
      historicalPrice: i.historical_price !== undefined && Number.isFinite(Number(i.historical_price)) ? Number(i.historical_price) : null,
    }))
    .filter((i) => i.name && Number.isFinite(i.quantity) && i.quantity > 0);
  if (items.length === 0) return { error: "at least one item with name and a positive quantity is required" };

  // Only values that exist in this client's master data are kept.
  async function validName(kind: "commodity" | "region", value: unknown) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text) return null;
    const rows = kind === "commodity"
      ? await prisma.commodity.findMany({ where: { clientId: ctx.client.id }, select: { description: true } })
      : await prisma.region.findMany({ where: { clientId: ctx.client.id }, select: { description: true } });
    const hit = rows.find((r) => r.description.trim().toLowerCase() === text.toLowerCase());
    if (!hit) warnings.push(`${kind} "${text}" is not in the master data and was left empty.`);
    return hit?.description ?? null;
  }
  const commodity = await validName("commodity", input.commodity);
  const region = await validName("region", input.region);

  const rawDeadline = isoDate(input.deadline);
  const minDate = new Date(Date.now() + 86_400_000);
  const deadline = rawDeadline && rawDeadline > minDate ? String(input.deadline) : new Date(Date.now() + 14 * 86_400_000).toISOString().slice(0, 10);
  if (!rawDeadline || rawDeadline <= minDate) warnings.push("The deadline was missing or in the past: set to 14 days from today.");

  const questions = (Array.isArray(input.questions) ? (input.questions as Record<string, unknown>[]) : [])
    .slice(0, 15)
    .map((q) => ({
      text: String(q.text ?? "").trim().slice(0, 300),
      type: ["TEXT", "NUMBER", "YES_NO", "SELECT"].includes(String(q.type)) ? String(q.type) : "TEXT",
      options: Array.isArray(q.options) ? (q.options as unknown[]).map((o) => String(o).trim()).filter(Boolean).slice(0, 12) : [],
    }))
    .filter((q) => q.text);

  const summary: DraftSummary = {
    title,
    description: String(input.description ?? "").trim().slice(0, 2000),
    commodity,
    region,
    deadline,
    items,
    questions: questions.map((q) => ({ text: q.text, type: q.type })),
    warnings,
  };
  const proposal = await prisma.assistantProposal.create({
    data: { clientId: ctx.client.id, userId: ctx.user.id, payload: { ...summary, questionOptions: questions.map((q) => q.options) } as object },
  });
  ctx.artifacts.push({ type: "proposal", id: proposal.id, title, summary });
  return { proposalId: proposal.id, status: "PROPOSED_NOT_CREATED", note: "The user must confirm with the 'Create draft' button. Tell them to review it and do not say it was created.", warnings };
}

export async function executeTool(name: string, input: Record<string, unknown>, ctx: ToolContext): Promise<string> {
  switch (name) {
    case "list_rfps":
      return clip(JSON.stringify(await listRfps(input, ctx)));
    case "get_rfp":
      return clip(JSON.stringify(await getRfp(input, ctx)));
    case "get_report_data":
      return clip(JSON.stringify(await getReportData(input, ctx)));
    case "search_suppliers":
      return clip(JSON.stringify(await searchSuppliers(input, ctx)));
    case "list_master_data":
      return clip(JSON.stringify(await listMasterData(input, ctx)));
    case "show_chart": {
      const data = (Array.isArray(input.data) ? (input.data as Record<string, unknown>[]) : [])
        .slice(0, 40)
        .map((d) => ({ label: String(d.label ?? "").slice(0, 60), value: Number(d.value) }))
        .filter((d) => Number.isFinite(d.value));
      ctx.artifacts.push({
        type: "chart",
        title: String(input.title ?? "").slice(0, 120),
        chartType: ["bar", "column", "donut", "line"].includes(String(input.chart_type)) ? (input.chart_type as "bar") : "bar",
        format: ["currency", "percent"].includes(String(input.value_format)) ? (input.value_format as "currency") : "number",
        data,
      });
      return "Chart shown to the user.";
    }
    case "show_table": {
      const columns = (Array.isArray(input.columns) ? input.columns : []).map(String).slice(0, 12);
      const rows = (Array.isArray(input.rows) ? (input.rows as unknown[][]) : [])
        .slice(0, 100)
        .map((r) => r.slice(0, columns.length).map((c) => (typeof c === "number" ? c : String(c ?? ""))));
      ctx.artifacts.push({ type: "table", title: String(input.title ?? "").slice(0, 120), columns, rows });
      return "Table shown to the user.";
    }
    case "propose_rfp_draft":
      return clip(JSON.stringify(await proposeDraft(input, ctx)));
    case "report_validation":
      return clip(JSON.stringify(reportValidation(input, ctx)));
    case "propose_form_changes":
      return clip(JSON.stringify(await proposeFormChanges(input, ctx)));
    default:
      return JSON.stringify({ error: `Unknown tool ${name}` });
  }
}

// Creates the DRAFT RFP behind a confirmed proposal (called by the user's own click).
export async function createDraftFromProposal(proposalId: string, user: ToolContext["user"]) {
  const proposal = await prisma.assistantProposal.findFirst({ where: { id: proposalId, userId: user.id, clientId: user.clientId } });
  if (!proposal) return { error: "not_found" as const };
  if (proposal.status !== "PENDING") return { error: "already_done" as const };
  if (Date.now() - proposal.createdAt.getTime() > 24 * 3_600_000) return { error: "expired" as const };
  const p = proposal.payload as unknown as DraftSummary & { questionOptions?: string[][] };
  const estimated = p.items.reduce((s, i) => s + i.quantity * (i.historicalPrice ?? 0), 0);
  const rfp = await prisma.rfp.create({
    data: {
      clientId: user.clientId,
      number: await nextRfpNumber(),
      title: p.title,
      description: p.description,
      buyerName: `${user.name} ${user.lastName ?? ""}`.trim(),
      status: "DRAFT",
      deadlineAt: zonedTimeToUtc(`${p.deadline}T18:00`, user.timezone),
      commodity: p.commodity,
      region: p.region,
      estimatedPrice: estimated > 0 ? round2(estimated) : null,
      createdByUserId: user.id,
      scoringEnabled: true,
      items: {
        create: p.items.map((i, order) => ({
          clientId: user.clientId, order, code: i.code, name: i.name, quantity: i.quantity, unit: i.unit,
          weight: 1, decimals: 2, historicalPrice: i.historicalPrice, commodity: p.commodity,
        })),
      },
      questions: {
        create: p.questions.map((q, order) => ({
          clientId: user.clientId, order, text: q.text, type: q.type as "TEXT" | "NUMBER" | "YES_NO" | "SELECT", required: true, weight: 1,
          options: q.type === "SELECT" ? JSON.stringify(p.questionOptions?.[order] ?? []) : null,
        })),
      },
    },
  });
  await prisma.assistantProposal.update({ where: { id: proposal.id }, data: { status: "CREATED", rfpId: rfp.id } });
  return { rfpId: rfp.id, number: rfp.number };
}


// ---------- Inside the RFP form ----------
// While someone edits an RFP the assistant gets the form's state and two extra
// tools: one to report findings, one to propose changes the user applies.

export const FORM_TOOLS: Anthropic.Tool[] = [
  {
    name: "report_validation",
    description:
      "Shows the user a short checklist of findings about the RFP being edited (what is missing, inconsistent or risky). Call it once with all findings, most serious first. Use severity error for what would block or break the RFP, warning for what is probably wrong, info for suggestions. Max 12 findings.",
    input_schema: {
      type: "object",
      properties: {
        issues: {
          type: "array",
          items: {
            type: "object",
            properties: {
              severity: { type: "string", enum: ["error", "warning", "info"] },
              field: { type: "string", description: "Where: title, description, deadline, commodity, region, items, questions, suppliers or another field name." },
              message: { type: "string", description: "One short sentence saying what is wrong and how to fix it." },
            },
            required: ["severity", "field", "message"],
          },
        },
      },
      required: ["issues"],
    },
  },
  {
    name: "propose_form_changes",
    description:
      "Proposes changes to the RFP being edited: set a header field, add an item or add a supplier question. It does NOT change anything: the user sees each change and presses Apply. Use exact commodity/region names from list_master_data. Do not repeat items or questions that already exist in the form. Max 15 changes.",
    input_schema: {
      type: "object",
      properties: {
        summary: { type: "string", description: "One sentence on what these changes do." },
        changes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: ["field", "item", "question"] },
              field: { type: "string", enum: [...FORM_FIELDS], description: "kind=field: which header field." },
              value: { type: "string", description: "kind=field: the new value (estimatedPrice as a plain number)." },
              name: { type: "string", description: "kind=item: item name." },
              quantity: { type: "number" },
              unit: { type: "string" },
              code: { type: "string" },
              description: { type: "string" },
              historical_price: { type: "number", description: "Only when you know a realistic one from the user's own data." },
              text: { type: "string", description: "kind=question: the question text." },
              type: { type: "string", enum: [...FORM_QUESTION_TYPES] },
              options: { type: "array", items: { type: "string" }, description: "type=SELECT: the choices." },
              required: { type: "boolean" },
            },
            required: ["kind"],
          },
        },
      },
      required: ["summary", "changes"],
    },
  },
];

// Tools for a run: inside the RFP form the draft-creating tool is replaced by the form ones.
export function toolsFor(ctx: ToolContext): Anthropic.Tool[] {
  const notInForm = ["propose_rfp_draft", "show_chart", "show_table"];
  return ctx.form ? [...TOOLS.filter((t) => !notInForm.includes(t.name)), ...FORM_TOOLS] : TOOLS;
}

function reportValidation(input: Record<string, unknown>, ctx: ToolContext) {
  if (!ctx.form) return { error: "not available here" };
  const issues: FormValidationIssue[] = (Array.isArray(input.issues) ? (input.issues as Record<string, unknown>[]) : [])
    .slice(0, 12)
    .map((i) => ({
      severity: (["error", "warning", "info"].includes(String(i.severity)) ? i.severity : "info") as FormValidationIssue["severity"],
      field: String(i.field ?? "").trim().slice(0, 40),
      message: String(i.message ?? "").trim().slice(0, 300),
    }))
    .filter((i) => i.message);
  ctx.artifacts.push({ type: "validation", issues });
  return { shown: issues.length };
}

async function proposeFormChanges(input: Record<string, unknown>, ctx: ToolContext) {
  if (!ctx.form) return { error: "not available here" };
  let snapshot: { items?: { name?: string }[]; questions?: { text?: string }[] } = {};
  try {
    snapshot = JSON.parse(ctx.form.snapshot);
  } catch {
    /* keep empty */
  }
  const haveItems = new Set((snapshot.items ?? []).map((i) => String(i.name ?? "").trim().toLowerCase()).filter(Boolean));
  const haveQuestions = new Set((snapshot.questions ?? []).map((q) => String(q.text ?? "").trim().toLowerCase()).filter(Boolean));
  const [commodities, regions] = await Promise.all([
    prisma.commodity.findMany({ where: { clientId: ctx.client.id }, select: { description: true } }),
    prisma.region.findMany({ where: { clientId: ctx.client.id }, select: { description: true } }),
  ]);
  const warnings: string[] = [];
  const changes: FormChange[] = [];

  for (const raw of (Array.isArray(input.changes) ? (input.changes as Record<string, unknown>[]) : []).slice(0, 15)) {
    if (raw.kind === "field") {
      const field = String(raw.field);
      if (!(FORM_FIELDS as readonly string[]).includes(field)) continue;
      let value = String(raw.value ?? "").trim().slice(0, field === "description" || field === "internalNotes" ? 2000 : 200);
      if (field === "commodity" || field === "region") {
        const hit = (field === "commodity" ? commodities : regions).find((r) => r.description.trim().toLowerCase() === value.toLowerCase());
        if (!hit) {
          warnings.push(`${field} "${value}" is not in the master data: dropped.`);
          continue;
        }
        value = hit.description;
      }
      if (field === "estimatedPrice" && !Number.isFinite(Number(value))) {
        warnings.push("estimatedPrice must be a number: dropped.");
        continue;
      }
      changes.push({ kind: "field", field: field as (typeof FORM_FIELDS)[number], value });
    } else if (raw.kind === "item") {
      const name = String(raw.name ?? "").trim().slice(0, 200);
      const quantity = Number(raw.quantity);
      if (!name || !Number.isFinite(quantity) || quantity <= 0) continue;
      if (haveItems.has(name.toLowerCase())) {
        warnings.push(`Item "${name}" already exists: dropped.`);
        continue;
      }
      haveItems.add(name.toLowerCase());
      changes.push({
        kind: "item",
        name,
        quantity,
        unit: String(raw.unit ?? "unidad").trim().slice(0, 30) || "unidad",
        code: raw.code ? String(raw.code).trim().slice(0, 40) : null,
        description: String(raw.description ?? "").trim().slice(0, 500),
        historicalPrice: raw.historical_price !== undefined && Number.isFinite(Number(raw.historical_price)) ? Number(raw.historical_price) : null,
      });
    } else if (raw.kind === "question") {
      const text = String(raw.text ?? "").trim().slice(0, 300);
      if (!text) continue;
      if (haveQuestions.has(text.toLowerCase())) {
        warnings.push(`Question "${text}" already exists: dropped.`);
        continue;
      }
      haveQuestions.add(text.toLowerCase());
      const type = (FORM_QUESTION_TYPES as readonly string[]).includes(String(raw.type)) ? (String(raw.type) as (typeof FORM_QUESTION_TYPES)[number]) : "TEXT";
      const options = Array.isArray(raw.options) ? (raw.options as unknown[]).map((o) => String(o).trim()).filter(Boolean).slice(0, 12) : [];
      changes.push({ kind: "question", text, type: type === "SELECT" && options.length === 0 ? "TEXT" : type, options: type === "SELECT" ? options : [], required: raw.required !== false });
    }
  }
  if (changes.length === 0) return { error: "no valid changes", warnings };
  ctx.artifacts.push({
    type: "formChanges",
    id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    summary: String(input.summary ?? "").trim().slice(0, 300),
    changes,
    warnings,
  });
  return { status: "PROPOSED_NOT_APPLIED", note: "The user must press Apply for each change. Do not say they were applied.", warnings };
}
