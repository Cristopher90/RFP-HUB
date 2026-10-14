"use server";

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { requireUser } from "@/lib/auth";
import { getDictionary } from "@/i18n/getDictionary";

const MAX_BYTES = 8 * 1024 * 1024;

// Stores the file a buyer attaches as the answer to one of their own questions
// while creating / editing an RFP. Returns the value to keep as the answer
// ("/uploads/<stored name>|<file name>", the same format the RFP page uses).
export async function uploadBuyerAttachment(
  formData: FormData,
): Promise<{ error: string } | { value: string }> {
  const user = await requireUser();
  const d = getDictionary(user.language).rfpForm;
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: d.attachmentMissing };
  if (file.size > MAX_BYTES) return { error: d.attachmentTooBig };
  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await mkdir(uploadsDir, { recursive: true });
  const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_");
  const storedName = `${randomUUID()}-${safeName}`;
  await writeFile(path.join(uploadsDir, storedName), Buffer.from(await file.arrayBuffer()));
  return { value: `/uploads/${storedName}|${safeName}` };
}
