import "server-only";
import type { Prisma } from "@/generated/prisma/client";

type NoteUser = {
  id: string;
  role: string;
  clientId: string | null;
  canNoteOwn: boolean;
  canNoteTargeted: boolean;
  canNoteAll: boolean;
};

const isAdmin = (user: NoteUser) => user.role === "ADMIN" || user.role === "CLIENT_ADMIN";

// What kinds of notes a user may write. Administrators can write every kind;
// only the Super Administrador can also post news to other (or all) clients.
export function noteRights(user: NoteUser) {
  return {
    own: isAdmin(user) || user.canNoteOwn,
    targeted: user.role !== "ADMIN" && (isAdmin(user) || user.canNoteTargeted),
    all: isAdmin(user) || user.canNoteAll,
    anyClient: user.role === "ADMIN",
  };
}

export function canManageNote(user: NoteUser, note: { authorId: string; clientId: string | null }) {
  if (note.authorId === user.id) return true;
  if (user.role === "ADMIN") return true;
  return user.role === "CLIENT_ADMIN" && note.clientId !== null && note.clientId === user.clientId;
}

// Notes this user can see on Home: the ones they wrote (any date, so they can
// manage them), plus notes directed at them or at everybody in their client
// (or global news) that are currently inside their start/end window.
export function visibleNotesWhere(user: NoteUser, now: Date): Prisma.NoteWhereInput {
  return {
    OR: [
      { authorId: user.id },
      {
        AND: [
          {
            OR: [
              { scope: "ALL", clientId: null },
              ...(user.clientId ? [{ scope: "ALL" as const, clientId: user.clientId }] : []),
              { scope: "TARGETED", targets: { some: { userId: user.id } } },
            ],
          },
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ endsAt: null }, { endsAt: { gte: now } }] },
        ],
      },
    ],
  };
}
