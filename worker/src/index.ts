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
 *   - Per-IP KV rate limit (RATE_LIMIT_MAX per RATE_LIMIT_WINDOW_SECONDS)
 *
 * No request body is logged. Email content is sent only to CONTACT_TO_EMAIL.
 */

export interface Env {
  // KV
  RATE_LIMIT: KVNamespace;
  NEWSLETTER: KVNamespace;
  // vars
  ALLOWED_ORIGINS: string;
  CONTACT_FROM_EMAIL: string;
  RATE_LIMIT_MAX: string;
  RATE_LIMIT_WINDOW_SECONDS: string;
  // secrets
  RESEND_API_KEY: string;
  CONTACT_TO_EMAIL: string;
  TURNSTILE_SECRET: string;
  INTERNAL_TOKEN: string;
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function parseAllowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean);
}

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = parseAllowedOrigins(env);
  const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0] ?? "*";
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

function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ||
    "unknown"
  );
}

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------

async function checkRateLimit(
  env: Env,
  bucket: string,
  ip: string,
): Promise<{ ok: true } | { ok: false; retryAfter: number }> {
  const max = Number(env.RATE_LIMIT_MAX) || 5;
  const windowSeconds = Number(env.RATE_LIMIT_WINDOW_SECONDS) || 3600;
  const key = `rl:${bucket}:${ip}`;
  const raw = await env.RATE_LIMIT.get(key);
  const count = raw ? Number(raw) : 0;
  if (count >= max) {
    return { ok: false, retryAfter: windowSeconds };
  }
  await env.RATE_LIMIT.put(key, String(count + 1), { expirationTtl: windowSeconds });
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Turnstile verification
// ---------------------------------------------------------------------------

async function verifyTurnstile(env: Env, token: string, ip: string): Promise<boolean> {
  if (!token) return false;
  if (!env.TURNSTILE_SECRET) {
    // Fail closed in production. If the secret is missing the deployment is misconfigured.
    return false;
  }
  const form = new FormData();
  form.set("secret", env.TURNSTILE_SECRET);
  form.set("response", token);
  form.set("remoteip", ip);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      body: form,
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { success?: boolean };
    return data.success === true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateContactPayload(body: unknown): {
  ok: true;
  data: { name: string; email: string; message: string; hp: string; turnstileToken: string };
} | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const b = body as Record<string, unknown>;
  const name = typeof b.name === "string" ? b.name.trim() : "";
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const message = typeof b.message === "string" ? b.message.trim() : "";
  const hp = typeof b.hp === "string" ? b.hp : "";
  const turnstileToken = typeof b.turnstileToken === "string" ? b.turnstileToken : "";
  if (!name || name.length > 200) return { ok: false, error: "invalid_name" };
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return { ok: false, error: "invalid_email" };
  }
  if (!message || message.length < 5 || message.length > 5000) {
    return { ok: false, error: "invalid_message" };
  }
  return { ok: true, data: { name, email, message, hp, turnstileToken } };
}

function validateNewsletterPayload(body: unknown): {
  ok: true;
  data: { email: string; hp: string; turnstileToken: string };
} | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid_body" };
  const b = body as Record<string, unknown>;
  const email = typeof b.email === "string" ? b.email.trim() : "";
  const hp = typeof b.hp === "string" ? b.hp : "";
  const turnstileToken = typeof b.turnstileToken === "string" ? b.turnstileToken : "";
  if (!email || !EMAIL_RE.test(email) || email.length > 320) {
    return { ok: false, error: "invalid_email" };
  }
  return { ok: true, data: { email, hp, turnstileToken } };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---------------------------------------------------------------------------
// Resend email
// ---------------------------------------------------------------------------

async function sendEmail(
  env: Env,
  payload: { to: string; subject: string; html: string; text: string; replyTo?: string },
): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

async function handleContact(request: Request, env: Env, origin: string | null): Promise<Response> {
  const ip = clientIp(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400, origin, env });
  }
  const parsed = validateContactPayload(body);
  if (!parsed.ok) {
    return jsonResponse({ ok: false, error: parsed.error }, { status: 400, origin, env });
  }
  // Honeypot — always 200 to bots, but skip work.
  if (parsed.data.hp) {
    return jsonResponse({ ok: true, status: "received" }, { status: 200, origin, env });
  }
  const rl = await checkRateLimit(env, "contact", ip);
  if (!rl.ok) {
    return jsonResponse(
      { ok: false, error: "rate_limited", retryAfter: rl.retryAfter },
      { status: 429, origin, env, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  const human = await verifyTurnstile(env, parsed.data.turnstileToken, ip);
  if (!human) {
    return jsonResponse({ ok: false, error: "turnstile_failed" }, { status: 400, origin, env });
  }
  const { name, email, message } = parsed.data;
  const subject = `Contact form — ${name}`;
  const html = `<p><strong>From:</strong> ${escapeHtml(name)} &lt;${escapeHtml(email)}&gt;</p>
<p><strong>Message:</strong></p>
<pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(message)}</pre>`;
  const text = `From: ${name} <${email}>\n\n${message}`;
  const sent = await sendEmail(env, {
    to: env.CONTACT_TO_EMAIL,
    subject,
    html,
    text,
    replyTo: email,
  });
  if (!sent) {
    return jsonResponse({ ok: false, error: "send_failed" }, { status: 502, origin, env });
  }
  return jsonResponse({ ok: true, status: "sent" }, { status: 200, origin, env });
}

async function handleNewsletter(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const ip = clientIp(request);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400, origin, env });
  }
  const parsed = validateNewsletterPayload(body);
  if (!parsed.ok) {
    return jsonResponse({ ok: false, error: parsed.error }, { status: 400, origin, env });
  }
  if (parsed.data.hp) {
    return jsonResponse({ ok: true, status: "received" }, { status: 200, origin, env });
  }
  const rl = await checkRateLimit(env, "newsletter", ip);
  if (!rl.ok) {
    return jsonResponse(
      { ok: false, error: "rate_limited", retryAfter: rl.retryAfter },
      { status: 429, origin, env, headers: { "Retry-After": String(rl.retryAfter) } },
    );
  }
  const human = await verifyTurnstile(env, parsed.data.turnstileToken, ip);
  if (!human) {
    return jsonResponse({ ok: false, error: "turnstile_failed" }, { status: 400, origin, env });
  }
  const key = `email:${parsed.data.email.toLowerCase()}`;
  const existing = await env.NEWSLETTER.get(key);
  if (!existing) {
    await env.NEWSLETTER.put(
      key,
      JSON.stringify({ email: parsed.data.email, addedAt: new Date().toISOString(), ip }),
    );
  }
  return jsonResponse({ ok: true, status: "subscribed" }, { status: 200, origin, env });
}

async function handleDailySummary(
  request: Request,
  env: Env,
  origin: string | null,
): Promise<Response> {
  const auth = request.headers.get("Authorization") || "";
  const expected = `Bearer ${env.INTERNAL_TOKEN}`;
  if (!env.INTERNAL_TOKEN || auth !== expected) {
    return jsonResponse({ ok: false, error: "unauthorized" }, { status: 401, origin, env });
  }
  let body: { subject?: string; html?: string; text?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json" }, { status: 400, origin, env });
  }
  const subject = (body.subject || "Daily analytics summary").slice(0, 300);
  const html = body.html || "";
  const text = body.text || "";
  if (!html && !text) {
    return jsonResponse({ ok: false, error: "empty_body" }, { status: 400, origin, env });
  }
  const sent = await sendEmail(env, {
    to: env.CONTACT_TO_EMAIL,
    subject,
    html: html || `<pre>${escapeHtml(text)}</pre>`,
    text: text || subject,
  });
  if (!sent) {
    return jsonResponse({ ok: false, error: "send_failed" }, { status: 502, origin, env });
  }
  return jsonResponse({ ok: true, status: "sent" }, { status: 200, origin, env });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin");

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(origin, env) });
    }

    if (url.pathname === "/health" && request.method === "GET") {
      return jsonResponse({ ok: true, status: "alive" }, { origin, env });
    }

    // Origin allow-list (skip for /internal which uses bearer auth from server-to-server)
    if (!url.pathname.startsWith("/internal/")) {
      const allowed = parseAllowedOrigins(env);
      if (origin && !allowed.includes(origin)) {
        return jsonResponse({ ok: false, error: "origin_not_allowed" }, { status: 403, env });
      }
    }

    if (url.pathname === "/contact" && request.method === "POST") {
      return handleContact(request, env, origin);
    }
    if (url.pathname === "/newsletter-interest" && request.method === "POST") {
      return handleNewsletter(request, env, origin);
    }
    if (url.pathname === "/internal/daily-summary" && request.method === "POST") {
      return handleDailySummary(request, env, origin);
    }

    return jsonResponse({ ok: false, error: "not_found" }, { status: 404, origin, env });
  },
} satisfies ExportedHandler<Env>;
