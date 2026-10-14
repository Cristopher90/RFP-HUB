import { prisma } from "@/lib/prisma";
import { requireClientScope } from "@/lib/clientScope";
import { getDictionary } from "@/i18n/getDictionary";
import { findDecidedRfpIdsForUser, findPendingApprovalsForUser } from "@/lib/approvalEngine";
import { sweepAwaitingStart } from "@/lib/rfpStatus";
import { canManageNote, noteRights, visibleNotesWhere } from "@/lib/notes";
import { PendingApprovalsBox } from "../PendingApprovalsBox";
import { WeekCalendar } from "./WeekCalendar";
import { StatusSummary } from "./StatusSummary";
import { NotesBoard, type NoteView } from "./NotesBoard";
import { usesBento } from "@/lib/themes";
import { BentoGrid, Metric, Tile, TileTitle } from "@/components/bento/Bento";

const WINDOW_DAYS = 70;

// "Inicio": sticky-note board, this week's RFPs and the user's RFPs by status.
export default async function HomePage() {
  const scope = await requireClientScope();
  const { user } = scope;
  const dictionary = getDictionary(user.language);
  const d = dictionary.homePage;
  const now = new Date();

  // "Own" RFPs: the ones the user created — or, for an approver, the ones
  // assigned to them for approval.
  const pendingApprovals = await findPendingApprovalsForUser(user.id);
  let ownWhere;
  if (user.role === "APPROVER") {
    const pending = pendingApprovals;
    const decided = await findDecidedRfpIdsForUser(user.id);
    ownWhere = { id: { in: [...new Set([...pending.map((p) => p.rfpId), ...decided])] } };
  } else {
    ownWhere = { createdByUserId: user.id };
  }
  await sweepAwaitingStart(scope.where);

  const from = new Date(now.getTime() - WINDOW_DAYS * 86_400_000);
  const to = new Date(now.getTime() + WINDOW_DAYS * 86_400_000);
  const [statusGroups, windowRfps, rawNotes, users, clients] = await Promise.all([
    prisma.rfp.groupBy({
      by: ["status"],
      where: { ...ownWhere, status: { not: "DELETED" } },
      _count: { _all: true },
    }),
    prisma.rfp.findMany({
      where: {
        ...ownWhere,
        status: { notIn: ["DRAFT", "DELETED"] },
        OR: [
          { deadlineAt: { gte: from, lte: to } },
          { startDate: { gte: from, lte: to } },
          { startDate: null, publishedAt: { gte: from, lte: to } },
        ],
      },
      select: { id: true, number: true, title: true, status: true, deadlineAt: true, startDate: true, publishedAt: true },
    }),
    prisma.note.findMany({
      where: visibleNotesWhere(user, now),
      include: {
        author: true,
        targets: { select: { userId: true } },
        client: true,
        reads: { select: { userId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    user.clientId
      ? prisma.user.findMany({
          where: { clientId: user.clientId, id: { not: user.id } },
          orderBy: { name: "asc" },
          select: { id: true, name: true, lastName: true, email: true },
        })
      : Promise.resolve([]),
    scope.isSuperAdmin ? prisma.client.findMany({ orderBy: { description: "asc" } }) : Promise.resolve([]),
  ]);

  const events = windowRfps.map((r) => ({
    id: r.id,
    number: r.number,
    title: r.title,
    closesAt: r.deadlineAt.toISOString(),
    startsAt: (r.startDate ?? r.publishedAt)?.toISOString() ?? null,
  }));

  const notes: NoteView[] = rawNotes.map((n) => ({
    id: n.id,
    body: n.body,
    weight: n.weight,
    scope: n.scope,
    startsAt: n.startsAt?.toISOString() ?? null,
    endsAt: n.endsAt?.toISOString() ?? null,
    authorName: `${n.author.name} ${n.author.lastName ?? ""}`.trim(),
    isMine: n.authorId === user.id,
    canManage: canManageNote(user, n),
    read: n.reads.some((r) => r.userId === user.id),
    readCount: n.reads.length,
    targetIds: n.targets.map((t) => t.userId),
    targetCount: n.targets.length,
    clientLabel:
      n.clientId === null ? d.globalNews : n.clientId !== user.clientId ? (n.client?.description ?? null) : null,
    state: n.startsAt && n.startsAt > now ? "scheduled" : n.endsAt && n.endsAt < now ? "expired" : "active",
  }));

  if (usesBento(user)) {
    // Bento layout: the same data as below, arranged as a mosaic of tiles.
    const b = dictionary.bento;
    const count = (status: string) => statusGroups.find((g) => g.status === status)?._count._all ?? 0;
    const weekEnd = now.getTime() + 7 * 86_400_000;
    const closingThisWeek = windowRfps.filter(
      (r) => r.status === "OPEN" && r.deadlineAt.getTime() >= now.getTime() && r.deadlineAt.getTime() <= weekEnd,
    ).length;
    return (
      <div className="mx-auto max-w-6xl px-6 py-8">
        <BentoGrid>
          <Tile span={4} className="flex flex-col justify-center">
            <h1 className="text-3xl font-medium tracking-tight">{b.greeting.replace("{name}", user.name)}</h1>
            <p className="mt-1 text-sm text-slate-500">
              {pendingApprovals.length > 0
                ? b.approvalsWaiting.replace("{count}", String(pendingApprovals.length))
                : b.approvalsNone}
            </p>
          </Tile>
          <Tile tone="peach" span={2}>
            <Metric label={b.pendingMine} value={pendingApprovals.length} />
          </Tile>
          <Tile tone="dark" span={2}>
            <Metric label={b.open} value={count("OPEN")} size="lg" />
          </Tile>
          <Tile tone="lime" span={2}>
            <Metric label={b.closingThisWeek} value={closingThisWeek} size="lg" />
          </Tile>
          <Tile tone="lilac" span={2}>
            <Metric
              label={b.toApprove}
              value={count("PENDING_PUBLISH_APPROVAL")}
              size="lg"
              sub={`${count("DRAFT")} ${b.drafts.toLowerCase()}`}
            />
          </Tile>
          {pendingApprovals.length > 0 && (
            <div className="md:col-span-6">
              <PendingApprovalsBox
                items={pendingApprovals.map((p) => ({
                  rfpId: p.rfpId,
                  rfpNumber: p.rfpNumber,
                  rfpTitle: p.rfpTitle,
                  stage: p.stage,
                  approvalId: p.approvalId,
                  createdAt: p.createdAt.toISOString(),
                }))}
              />
            </div>
          )}
          <Tile span={6} className="bg-amber-50">
            <TileTitle>{d.notesTitle}</TileTitle>
            <NotesBoard
              notes={notes}
              rights={noteRights(user)}
              users={users.map((u) => ({ id: u.id, name: u.name, lastName: u.lastName ?? "", email: u.email }))}
              clients={clients.map((c) => ({ id: c.id, label: c.description }))}
            />
          </Tile>
          <Tile span={4}>
            <TileTitle>{d.weekTitle}</TileTitle>
            <WeekCalendar events={events} />
          </Tile>
          <Tile span={2}>
            <TileTitle>{d.statusTitle}</TileTitle>
            {statusGroups.length === 0 ? (
              <p className="text-sm text-slate-400">{d.noRfps}</p>
            ) : (
              <StatusSummary counts={statusGroups.map((g) => ({ status: g.status, count: g._count._all }))} />
            )}
          </Tile>
        </BentoGrid>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{d.title}</h1>
      <p className="mt-1 text-sm text-slate-500">{d.subtitle.replace("{name}", user.name)}</p>

      {pendingApprovals.length > 0 && (
        <div className="mt-6 -mb-2">
          <PendingApprovalsBox
            items={pendingApprovals.map((p) => ({
              rfpId: p.rfpId,
              rfpNumber: p.rfpNumber,
              rfpTitle: p.rfpTitle,
              stage: p.stage,
              approvalId: p.approvalId,
              createdAt: p.createdAt.toISOString(),
            }))}
          />
        </div>
      )}

      <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">{d.notesTitle}</h2>
        <NotesBoard
          notes={notes}
          rights={noteRights(user)}
          users={users.map((u) => ({ id: u.id, name: u.name, lastName: u.lastName ?? "", email: u.email }))}
          clients={clients.map((c) => ({ id: c.id, label: c.description }))}
        />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">{d.weekTitle}</h2>
        <WeekCalendar events={events} />
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-base font-semibold text-slate-900">{d.statusTitle}</h2>
        {statusGroups.length === 0 ? (
          <p className="text-sm text-slate-400">{d.noRfps}</p>
        ) : (
          <StatusSummary counts={statusGroups.map((g) => ({ status: g.status, count: g._count._all }))} />
        )}
      </section>
    </div>
  );
}
