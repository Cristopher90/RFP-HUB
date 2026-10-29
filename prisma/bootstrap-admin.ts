import "dotenv/config";
import { randomBytes, scryptSync } from "crypto";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// First-run bootstrap for a NEW, empty database (e.g. production): creates the
// single Super Administrador and nothing else. Clients, users, templates and
// the rest are then created from the app itself.
//
// Unlike prisma/seed.ts (demo data — it WIPES every table first), this never
// deletes anything and refuses to run if the database already has users.
//
// Credentials come from the environment so no password is ever stored in a
// file or in the repository:
//   DATABASE_URL    target database
//   ADMIN_EMAIL     login email of the Super Administrador
//   ADMIN_PASSWORD  initial password (at least 12 characters; change it later in Mi perfil)
//   ADMIN_NAME      first name (optional, default "Admin")
//   ADMIN_LASTNAME  last name (optional)

const connectionString = process.env.DATABASE_URL ?? "";
const email = (process.env.ADMIN_EMAIL ?? "").trim().toLowerCase();
const password = process.env.ADMIN_PASSWORD ?? "";

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

if (!connectionString) fail("DATABASE_URL is not set.");
if (!email || !email.includes("@")) fail("ADMIN_EMAIL is missing or not an email.");
if (password.length < 12) fail("ADMIN_PASSWORD must have at least 12 characters.");

const adapter = new PrismaPg({
  connectionString,
  ssl: /localhost|127\.0\.0\.1/.test(connectionString) ? undefined : { rejectUnauthorized: false },
});
const prisma = new PrismaClient({ adapter });

function hashPassword(value: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(value, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

async function main() {
  const host = new URL(connectionString).host;
  const existing = await prisma.user.count();
  if (existing > 0) {
    fail(`The database at ${host} already has ${existing} user(s); nothing was changed.`);
  }
  await prisma.user.create({
    data: {
      name: process.env.ADMIN_NAME?.trim() || "Admin",
      lastName: process.env.ADMIN_LASTNAME?.trim() || null,
      email,
      passwordHash: hashPassword(password),
      role: "ADMIN",
      clientId: null,
    },
  });
  console.log(`✓ Super Administrador ${email} created in ${host}.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
