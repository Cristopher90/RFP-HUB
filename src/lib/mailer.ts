import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";

// SMTP config comes from env. With no SMTP_HOST set nothing is sent — the
// message is just logged — so local dev (which points at the live database)
// can never email real people by accident. MAIL_REDIRECT_TO sends every
// message to one address instead, for testing against real data.
//   SMTP_HOST, SMTP_PORT (default 587), SMTP_USER, SMTP_PASS,
//   SMTP_SECURE ("true" for port 465), MAIL_FROM, APP_URL, MAIL_REDIRECT_TO

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!process.env.SMTP_HOST) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === "true",
      // Short timeouts: an unreachable/blocked SMTP host must fail fast
      // instead of holding a connection open for minutes.
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });
  }
  return transporter;
}

// Runs an email task after the response has been sent, so a slow or
// unreachable SMTP server can never keep a user's action (publish, approve,
// respond...) hanging. Falls back to fire-and-forget outside a request.
export function defer(task: () => Promise<void>): void {
  try {
    after(task);
  } catch {
    void task();
  }
}

export function appUrl(path: string): string {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

export function fill(template: string, vars: Record<string, string>): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => vars[key] ?? match);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export type EmailContent = {
  heading: string;
  paragraphs: string[];
  ctaLabel?: string;
  ctaUrl?: string;
};

function renderHtml(content: EmailContent): string {
  const paragraphs = content.paragraphs
    .map((p) => `<p style="margin:0 0 12px;line-height:1.5">${escapeHtml(p)}</p>`)
    .join("");
  const cta =
    content.ctaLabel && content.ctaUrl
      ? `<p style="margin:20px 0"><a href="${escapeHtml(content.ctaUrl)}" style="background:#7c3aed;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">${escapeHtml(content.ctaLabel)}</a></p>`
      : "";
  return `<div style="font-family:system-ui,sans-serif;font-size:14px;color:#1e293b;max-width:560px"><h2 style="margin:0 0 16px;font-size:18px">${escapeHtml(content.heading)}</h2>${paragraphs}${cta}</div>`;
}

function renderText(content: EmailContent): string {
  const lines = [content.heading, "", ...content.paragraphs];
  if (content.ctaUrl) lines.push("", `${content.ctaLabel ?? ""} ${content.ctaUrl}`.trim());
  return lines.join("\n");
}

export type EmailMeta = { kind: string; clientId?: string | null; rfpId?: string | null };

async function writeLog(
  meta: EmailMeta,
  to: string,
  sentTo: string,
  subject: string,
  status: "SENT" | "FAILED" | "NOT_SENT",
  error?: string,
) {
  try {
    await prisma.emailLog.create({
      data: {
        clientId: meta.clientId ?? null,
        rfpId: meta.rfpId ?? null,
        kind: meta.kind,
        toEmail: to,
        sentTo,
        subject,
        status,
        error: error ? error.slice(0, 1000) : null,
      },
    });
  } catch (logError) {
    console.error("[mail:log-error]", logError);
  }
}

// Never throws: a mail problem must not break the RFP action that triggered
// it. Every attempt is recorded in EmailLog (sent, failed, or not sent for
// lack of SMTP). Returns whether the message was actually handed to SMTP.
export async function sendEmail(
  to: string,
  subject: string,
  content: EmailContent,
  meta: EmailMeta,
): Promise<boolean> {
  const redirectTo = process.env.MAIL_REDIRECT_TO;
  const finalTo = redirectTo || to;
  const finalSubject = redirectTo ? `[${to}] ${subject}` : subject;
  try {
    const transport = getTransporter();
    if (!transport) {
      console.log(`[mail:not-sent] to=${finalTo} subject=${finalSubject}`);
      await writeLog(meta, to, finalTo, subject, "NOT_SENT");
      return false;
    }
    const info = await transport.sendMail({
      from: process.env.MAIL_FROM ?? process.env.SMTP_USER,
      to: finalTo,
      subject: finalSubject,
      text: renderText(content),
      html: renderHtml(content),
    });
    console.log(`[mail:sent] to=${finalTo} subject=${finalSubject} id=${info.messageId}`);
    await writeLog(meta, to, finalTo, subject, "SENT");
    return true;
  } catch (error) {
    console.error("[mail:error]", to, subject, error);
    await writeLog(meta, to, finalTo, subject, "FAILED", error instanceof Error ? error.message : String(error));
    return false;
  }
}
