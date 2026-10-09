import "server-only";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";

export type LoginEventType = "LOGIN" | "LOGOUT" | "LOGIN_FAILED";
export type LoginMethod = "PASSWORD" | "QUICK" | "INVITATION";

// Writes one row of the access log (visible only to the Super Administrador).
// Never throws: a logging problem must not break signing in or out.
export async function recordLoginEvent(options: {
  event: LoginEventType;
  kind: "USER" | "SUPPLIER" | "UNKNOWN";
  email: string;
  method?: LoginMethod;
  userId?: string | null;
  name?: string | null;
  clientId?: string | null;
}): Promise<void> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || h.get("x-real-ip") || null;
    await prisma.loginEvent.create({
      data: {
        event: options.event,
        kind: options.kind,
        method: options.method ?? null,
        userId: options.userId ?? null,
        email: options.email.trim().toLowerCase().slice(0, 200),
        name: options.name ?? null,
        clientId: options.clientId ?? null,
        ip: ip ? ip.slice(0, 64) : null,
        userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
      },
    });
  } catch (error) {
    console.error("[loginLog]", error);
  }
}
