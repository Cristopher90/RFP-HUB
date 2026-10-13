import "server-only";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

// Symmetric encryption for secrets stored in the database (a client's AI API
// key). The key is derived from ASSISTANT_SECRET, falling back to
// DATABASE_URL: a database leak alone then never exposes the stored keys.
function key(): Buffer {
  const secret = process.env.ASSISTANT_SECRET ?? process.env.DATABASE_URL;
  if (!secret) throw new Error("ASSISTANT_SECRET (or DATABASE_URL) is not set");
  return createHash("sha256").update(secret).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, data] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const decipher = createDecipheriv("aes-256-gcm", key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
