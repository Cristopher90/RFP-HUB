import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { canSeeByGroups } from "@/lib/viewGroups";

// Downloads a supplier document, only for staff who may see that supplier and
// that document type (same client, view groups).
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new Response("Unauthorized", { status: 401 });

  const doc = await prisma.supplierDocument.findUnique({
    where: { id },
    include: {
      supplierDirectory: { select: { viewGroupIds: true } },
      type: { select: { viewGroupIds: true } },
    },
  });
  if (
    !doc ||
    (user.role !== "ADMIN" && doc.clientId !== user.clientId) ||
    !canSeeByGroups(user, doc.supplierDirectory.viewGroupIds) ||
    !canSeeByGroups(user, doc.type.viewGroupIds)
  ) {
    return new Response("Not found", { status: 404 });
  }
  return new Response(new Uint8Array(doc.fileData), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(doc.size),
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(doc.fileName)}`,
      "Cache-Control": "private, no-store",
    },
  });
}
