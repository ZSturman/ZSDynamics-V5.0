import { sendEmail, escapeHtml } from "./mail";
import {
  handleIntake,
  handleSubscriptionLink,
  runIntakeJobs,
  type IntakeEnv,
} from "./intake";

/**
 * zacharysturman.com API Worker
 *
 * Endpoints:
 *   POST /contact                  — contact-form submission (Turnstile + rate-limited)
 *   POST /newsletter-interest      — opt-in email collection
 *   POST /internal/daily-summary   — bearer-protected; relays a daily GA summary email
 *   GET  /health                   — liveness probe
 *
 * Spam controls:
 *   - Honeypot field `hp` (must be empty)
 *   - Cloudflare Turnstile token verification
 *   - Atomic D1 counters with rotating salted IP/email hashes
 *
 * Contact messages go to the owner and private Notion tracker. Confirmed
 * subscribers receive new-writing emails. Request bodies are never logged.
 */

export interface Env extends IntakeEnv {
  // vars
  ALLOWED_ORIGINS: string;
  CONTACT_FROM_EMAIL: string;
  // secrets
  RESEND_API_KEY: string;
  CONTACT_TO_EMAIL: string;
  TURNSTILE_SECRET?: string;
  INTERNAL_TOKEN: string;
}

type ReportAttachment = {
  filename?: unknown;
  content?: unknown;
  contentType?: unknown;
};

const MAX_REPORT_ATTACHMENTS = 8;
const MAX_REPORT_ATTACHMENT_BYTES = 2 * 1024 * 1024;
const MAX_REPORT_ATTACHMENT_TOTAL_BYTES = 15 * 1024 * 1024;
const REPORT_IMAGE_FILE_RE = /^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:jpg|jpeg|png)$/i;

function expectedReportAttachmentMime(filename: string): string {
  return /\.png$/i.test(filename) ? "image/png" : "image/jpeg";
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function parseAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = parseAllowedOrigins(env);
  const allowOrigin =
    origin && allowed.includes(origin) ? origin : (allowed[0] ?? "*");
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  body: unknown,
  init: ResponseInit & { origin?: string | null; env?: Env } = {},
): Response {
  const { origin, env, ...rest } = init;
  const headers: Record<string, string> = {
    "Content-Type": "application/json; charset=utf-8",
    ...(env ? corsHeaders(origin ?? null, env) : {}),
    ...(rest.headers as Record<string, string> | undefined),
  };
  return new Response(JSON.stringify(body), { ...rest, headers });
}

function decodedBase64ByteLength(value: string): number {
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return Math.floor((value.length * 3) / 4) - padding;
}

function validateReportAttachments(
  rawAttachments: unknown,
):
  | { attachments: Array<{ filename: string; content: string }> }
  | { error: string } {
  if (rawAttachments === undefined) return { attachments: [] };
  if (
    !Array.isArray(rawAttachments) ||
    rawAttachments.length > MAX_REPORT_ATTACHMENTS
  ) {
    return { error: "invalid_attachments" };
  }

  const attachments: Array<{ filename: string; content: string }> = [];
  let totalBytes = 0;
  for (const rawAttachment of rawAttachments as ReportAttachment[]) {
    const filename =
      typeof rawAttachment?.filename === "string" ? rawAttachment.filename : "";
    const content =
      typeof rawAttachment?.content === "string" ? rawAttachment.content : "";
    const contentType =
      typeof rawAttachment?.contentType === "string"
        ? rawAttachment.contentType
        : undefined;
    if (
      !REPORT_IMAGE_FILE_RE.test(filename) ||
      (contentType && contentType !== expectedReportAttachmentMime(filename)) ||
      !content ||
      content.length % 4 !== 0 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(content)
    ) {
      return { error: "invalid_attachments" };
    }
    try {
      atob(content);
    } catch {
      return { error: "invalid_attachments" };
    }
    const bytes = decodedBase64ByteLength(content);
    if (
      bytes <= 0 ||
      bytes > MAX_REPORT_ATTACHMENT_BYTES ||
      totalBytes + bytes > MAX_REPORT_ATTACHMENT_TOTAL_BYTES
    ) {
      return { error: "attachments_too_large" };
    }
    totalBytes += bytes;
    attachments.push({ filename, content });
  }
  return { attachments };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleDailySummary(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const auth = request.headers.get("Authorization") || "";
  const expected = `Bearer ${env.INTERNAL_TOKEN}`;
  if (!env.INTERNAL_TOKEN || auth !== expected) {
    return jsonResponse(
      { ok: false, error: "unauthorized" },
      { status: 401, origin, env },
    );
  }
  let body: {
    subject?: string;
    html?: string;
    text?: string;
    idempotencyKey?: string;
    attachments?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse(
      { ok: false, error: "invalid_json" },
      { status: 400, origin, env },
    );
  }
  const subject = (body.subject || "Daily analytics summary").slice(0, 300);
  const html = body.html || "";
  const text = body.text || "";
  if (!html && !text) {
    return jsonResponse(
      { ok: false, error: "empty_body" },
      { status: 400, origin, env },
    );
  }
  const validatedAttachments = validateReportAttachments(body.attachments);
  if ("error" in validatedAttachments) {
    return jsonResponse(
      { ok: false, error: validatedAttachments.error },
      { status: 400, origin, env },
    );
  }
  const idempotencyKey =
    typeof body.idempotencyKey === "string" &&
    /^[A-Za-z0-9._:-]{1,256}$/.test(body.idempotencyKey)
      ? body.idempotencyKey
      : undefined;
  const sent = await sendEmail(env, {
    to: env.CONTACT_TO_EMAIL,
    subject,
    html: html || `<pre>${escapeHtml(text)}</pre>`,
    text: text || subject,
    attachments: validatedAttachments.attachments,
    idempotencyKey,
  });
  if (!sent) {
    return jsonResponse(
      { ok: false, error: "send_failed" },
      { status: 502, origin, env },
    );
  }
  return jsonResponse(
    { ok: true, status: "sent" },
    { status: 200, origin, env },
  );
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders(origin, env),
      });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse(
        {
          ok: true,
          status: "alive",
          intakeConfigured: Boolean(
            env.INTAKE_DB &&
              env.TURNSTILE_SECRET &&
              env.RESEND_API_KEY &&
              env.CONTACT_TO_EMAIL &&
              env.INTERNAL_TOKEN,
          ),
          notionConfigured: Boolean(
            env.NOTION_API_KEY &&
              env.NOTION_MESSAGES_DATA_SOURCE_ID &&
              env.NOTION_SUBSCRIBERS_DATA_SOURCE_ID,
          ),
        },
        { origin, env },
      );
    }

    // Signed subscription links are served by the API itself. Their HTML forms
    // submit with the API Origin, rather than the portfolio's Origin.
    if (
      ["/confirm", "/unsubscribe"].includes(url.pathname) &&
      ["GET", "POST"].includes(request.method)
    ) {
      if (origin && origin !== url.origin)
        return jsonResponse(
          { ok: false, error: "origin_not_allowed" },
          { status: 403 },
        );
      return handleSubscriptionLink(request, env);
    }

    // Origin allow-list (skip for /internal which uses bearer auth from server-to-server)
    if (!url.pathname.startsWith("/internal/")) {
      const allowed = parseAllowedOrigins(env);
      if (origin && !allowed.includes(origin)) {
        return jsonResponse(
          { ok: false, error: "origin_not_allowed" },
          { status: 403, env },
        );
      }
    }

    if (url.pathname === "/contact" && request.method === "POST") {
      return handleIntake(request, env, origin, "contact");
    }
    if (url.pathname === "/newsletter-interest" && request.method === "POST") {
      return handleIntake(request, env, origin, "newsletter");
    }
    if (
      url.pathname === "/internal/intake-status" &&
      request.method === "GET"
    ) {
      if (
        !env.INTERNAL_TOKEN ||
        request.headers.get("Authorization") !== `Bearer ${env.INTERNAL_TOKEN}`
      ) {
        return jsonResponse(
          { ok: false, error: "unauthorized" },
          { status: 401 },
        );
      }
      if (!env.INTAKE_DB)
        return jsonResponse(
          { ok: false, error: "storage_unavailable" },
          { status: 503 },
        );
      const messages = await env.INTAKE_DB.prepare(
        "SELECT count(*) total, sum(email_sent_at IS NULL) email_pending, sum(email_sent_at IS NULL AND email_attempts>=8) email_failed, sum(notion_page_id IS NULL) notion_pending FROM messages",
      ).first();
      const subscribers = await env.INTAKE_DB.prepare(
        "SELECT status,count(*) total FROM subscribers GROUP BY status",
      ).all();
      const writing = await env.INTAKE_DB.prepare(
        "SELECT count(*) total, sum(sent_at IS NULL) pending, sum(sent_at IS NULL AND attempts>=8) failed FROM article_deliveries",
      ).first();
      return jsonResponse(
        { ok: true, messages, subscribers: subscribers.results, writing },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    if (
      url.pathname === "/internal/daily-summary" &&
      request.method === "POST"
    ) {
      return handleDailySummary(request, env, origin);
    }

    return jsonResponse(
      { ok: false, error: "not_found" },
      { status: 404, origin, env },
    );
  },
  async scheduled(event: ScheduledController, env: Env): Promise<void> {
    await runIntakeJobs(env, event.cron === "0 * * * *");
  },
} satisfies ExportedHandler<Env>;
