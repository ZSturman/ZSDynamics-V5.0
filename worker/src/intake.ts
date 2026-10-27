import { escapeHtml, sendEmail } from "./mail";
import type { Env } from "./index";

export interface IntakeEnv {
  INTAKE_DB?: D1Database;
  NOTION_API_KEY?: string;
  NOTION_MESSAGES_DATA_SOURCE_ID?: string;
  NOTION_SUBSCRIBERS_DATA_SOURCE_ID?: string;
  NOTION_MESSAGES_DATABASE_ID?: string;
  PUBLIC_SITE_URL?: string;
  PUBLIC_API_URL?: string;
}
const TOPICS = [
  "Project or collaboration",
  "Role or opportunity",
  "App support",
  "Other",
];
const EMAIL_RE = /^[^\s@<>\r\n]+@[^\s@<>\r\n]+\.[^\s@<>\r\n]+$/;
const now = () => new Date().toISOString();
const encoder = new TextEncoder();
const site = (env: Env) => env.PUBLIC_SITE_URL || "https://zacharysturman.com";
const api = (env: Env) =>
  env.PUBLIC_API_URL || "https://api.zacharysturman.com";
const rich = (content: string) => [{ type: "text", text: { content } }];
const date = (value: string | null) => ({
  date: value ? { start: value } : null,
});

function response(
  body: unknown,
  status: number,
  origin: string | null,
  env: Env,
  headers = {},
) {
  return Response.json(body, {
    status,
    headers: {
      "Access-Control-Allow-Origin":
        origin &&
        env.ALLOWED_ORIGINS.split(",")
          .map((s) => s.trim())
          .includes(origin)
          ? origin
          : "https://zacharysturman.com",
      "Cache-Control": "no-store",
      Vary: "Origin",
      ...headers,
    },
  });
}
async function digest(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}
async function limited(
  db: D1Database,
  key: string,
  max: number,
  seconds: number,
) {
  const time = Math.floor(Date.now() / 1000);
  const row = await db
    .prepare(
      `INSERT INTO rate_limits(key,count,expires_at) VALUES (?,1,?)
    ON CONFLICT(key) DO UPDATE SET count=CASE WHEN expires_at<=? THEN 1 ELSE count+1 END,
    expires_at=CASE WHEN expires_at<=? THEN excluded.expires_at ELSE expires_at END RETURNING count`,
    )
    .bind(key, time + seconds, time, time)
    .first<{ count: number }>();
  return (row?.count || 0) > max;
}
async function readBody(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get("Content-Type")?.startsWith("application/json"))
    throw new Error("invalid_body");
  const reader = request.body?.getReader();
  if (!reader) throw new Error("invalid_body");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.length;
    if (length > 16384) {
      await reader.cancel();
      throw new Error("body_too_large");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  const body: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!body || typeof body !== "object" || Array.isArray(body))
    throw new Error("invalid_body");
  return body as Record<string, unknown>;
}
async function human(request: Request, env: Env, token: string, kind: string) {
  const result = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    {
      method: "POST",
      signal: AbortSignal.timeout(10000),
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET!,
        response: token,
      }),
    },
  );
  if (!result.ok) return false;
  const data = (await result.json()) as {
    success?: boolean;
    hostname?: string;
    action?: string;
  };
  const hostname = new URL(request.headers.get("Origin")!).hostname;
  return (
    data.success === true && data.hostname === hostname && data.action === kind
  );
}

export async function handleIntake(
  request: Request,
  env: Env,
  origin: string | null,
  kind: "contact" | "newsletter",
) {
  const fail = (error: string, status = 400) =>
    response({ ok: false, error }, status, origin, env);
  if (
    !origin ||
    !env.ALLOWED_ORIGINS.split(",")
      .map((s) => s.trim())
      .includes(origin)
  )
    return fail("origin_not_allowed", 403);
  // Missing secrets/storage must never produce a false success or bypass verification.
  const db = env.INTAKE_DB;
  if (
    !db ||
    !env.TURNSTILE_SECRET ||
    !env.INTERNAL_TOKEN ||
    !env.RESEND_API_KEY ||
    !env.CONTACT_TO_EMAIL
  )
    return fail("service_unavailable", 503);
  try {
    let body: Record<string, unknown>;
    try {
      body = await readBody(request);
    } catch {
      return fail("invalid_body");
    }
    const str = (key: string) =>
      typeof body[key] === "string" ? (body[key] as string).trim() : "";
    if (str("hp"))
      return response({ ok: true, status: "received" }, 200, origin, env);
    const email = str("email").toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254)
      return fail("invalid_email");
    const name = str("name"),
      message = str("message"),
      topic = str("topic") || "Other";
    if (kind === "contact") {
      if (!name || name.length > 200 || /[\r\n]/.test(name))
        return fail("invalid_name");
      if (message.length < 5 || message.length > 5000)
        return fail("invalid_message");
      if (!TOPICS.includes(topic)) return fail("invalid_topic");
    } else if (body.consent !== true) return fail("consent_required");
    // HMAC-secret-salted hashes expire after a day; no raw IP is persisted.
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";
    const bucket = Math.floor(Date.now() / 3600000);
    const ipKey = await digest(`${env.INTERNAL_TOKEN}:${bucket}:${ip}`);
    const emailKey = await digest(`${env.INTERNAL_TOKEN}:${bucket}:${email}`);
    if (
      (await limited(db, `ip:${ipKey}`, 10, 3600)) ||
      (await limited(db, `email:${kind}:${emailKey}`, 3, 3600))
    ) {
      return response({ ok: false, error: "rate_limited" }, 429, origin, env, {
        "Retry-After": "3600",
      });
    }
    if (
      !str("turnstileToken") ||
      !(await human(request, env, str("turnstileToken"), kind))
    )
      return fail("turnstile_failed");
    if (kind === "contact") {
      const id = /^[0-9a-f-]{36}$/i.test(str("requestId"))
        ? str("requestId")
        : crypto.randomUUID();
      const fingerprint = await digest(
        JSON.stringify([name, email, topic, message]),
      );
      await db
        .prepare(
          "INSERT OR IGNORE INTO messages(id,fingerprint,name,email,topic,message,received_at) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(id, fingerprint, name, email, topic, message, now())
        .run();
      const saved = await db
        .prepare("SELECT fingerprint FROM messages WHERE id=?")
        .bind(id)
        .first<{ fingerprint: string }>();
      if (saved?.fingerprint !== fingerprint)
        return fail("request_conflict", 409);
      return response(
        { ok: true, status: "received", reference: id },
        200,
        origin,
        env,
      );
    }
    // Repeated requests never reveal whether an email already has an active subscription.
    const old = await db
      .prepare("SELECT * FROM subscribers WHERE email=?")
      .bind(email)
      .first<Subscriber>();
    if (!old) {
      await db
        .prepare(
          "INSERT OR IGNORE INTO subscribers(id,email,status,requested_at) VALUES (?,?,'Pending',?)",
        )
        .bind(crypto.randomUUID(), email, now())
        .run();
    } else if (
      old.status === "Unsubscribed" ||
      (old.status === "Pending" &&
        Date.now() - Date.parse(old.requested_at) > 3600000)
    ) {
      await db
        .prepare(
          `UPDATE subscribers SET status='Pending',generation=generation+1,requested_at=?,
        confirmation_sent_at=NULL,confirmed_at=NULL,owner_notified_at=NULL,notion_state=NULL,notion_next_attempt=0,confirmation_attempts=0,confirmation_next_attempt=0,owner_attempts=0,owner_next_attempt=0 WHERE id=? AND generation=?`,
        )
        .bind(now(), old.id, old.generation)
        .run();
    }
    return response({ ok: true, status: "pending" }, 200, origin, env);
  } catch {
    // Never log request contents, email addresses, or tokens.
    return fail("service_unavailable", 503);
  }
}

type Subscriber = {
  id: string;
  email: string;
  status: string;
  generation: number;
  requested_at: string;
  confirmed_at: string | null;
  unsubscribed_at: string | null;
  confirmation_sent_at: string | null;
  owner_notified_at: string | null;
  notion_page_id: string | null;
  notion_state: string | null;
  confirmation_attempts: number;
  confirmation_next_attempt: number;
  owner_attempts: number;
  owner_next_attempt: number;
};
type Message = {
  id: string;
  name: string;
  email: string;
  topic: string;
  message: string;
  received_at: string;
  email_sent_at: string | null;
  email_attempts: number;
  email_next_attempt: number;
  notion_page_id: string | null;
};

function b64(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
function unb64(value: string) {
  return Uint8Array.from(
    atob(
      value
        .replace(/-/g, "+")
        .replace(/_/g, "/")
        .padEnd(Math.ceil(value.length / 4) * 4, "="),
    ),
    (c) => c.charCodeAt(0),
  );
}
async function signingKey(env: Env) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`writing-links:${env.INTERNAL_TOKEN}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}
export async function subscriptionToken(
  env: Env,
  sub: Subscriber,
  action: string,
) {
  const payload = b64(
    encoder.encode(
      JSON.stringify({
        id: sub.id,
        generation: sub.generation,
        action,
        exp:
          action === "confirm"
            ? Date.parse(sub.requested_at) + 48 * 3600000
            : null,
      }),
    ),
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    await signingKey(env),
    encoder.encode(payload),
  );
  return `${payload}.${b64(new Uint8Array(sig))}`;
}
async function tokenData(env: Env, token: string, action: string) {
  try {
    const [payload, sig, extra] = token.split(".");
    if (
      extra ||
      !(await crypto.subtle.verify(
        "HMAC",
        await signingKey(env),
        unb64(sig),
        encoder.encode(payload),
      ))
    )
      return null;
    const data = JSON.parse(new TextDecoder().decode(unb64(payload)));
    return data.action === action &&
      typeof data.id === "string" &&
      (!data.exp || data.exp > Date.now())
      ? (data as { id: string; generation: number })
      : null;
  } catch {
    return null;
  }
}
function linkPage(title: string, copy: string, action?: string) {
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title} · Zachary Sturman</title><style>body{font:18px/1.6 system-ui;background:#faf9f6;color:#172c41;margin:0;padding:64px 24px}main{max-width:540px;margin:auto}h1{line-height:1.15}button,a{color:inherit}button{background:#172c41;color:white;border:0;border-radius:8px;padding:14px 20px;font:inherit;cursor:pointer}p{color:#4c5a66}</style><main><a href="https://zacharysturman.com">Zachary Sturman</a><h1>${title}</h1><p>${copy}</p>${action ? `<form method="post"><button type="submit">${action}</button></form>` : '<a href="https://zacharysturman.com/articles">Read the latest writing →</a>'}</main></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        // no-referrer makes browser form POSTs send an opaque ("null") Origin.
        // Keep same-origin POSTs verifiable without leaking signed links off-site.
        "Referrer-Policy": "same-origin",
        "X-Robots-Tag": "noindex, nofollow",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
      },
    },
  );
}
export async function handleSubscriptionLink(request: Request, env: Env) {
  const url = new URL(request.url),
    action = url.pathname.slice(1);
  if (!env.INTAKE_DB || !env.INTERNAL_TOKEN)
    return new Response("Temporarily unavailable. Please try again later.", {
      status: 503,
    });
  const data = await tokenData(
    env,
    url.searchParams.get("token") || "",
    action,
  );
  if (!data)
    return linkPage(
      "This link has expired",
      'Please request a fresh link from the <a href="https://zacharysturman.com/contact">contact page</a>.',
    );
  const sub = await env.INTAKE_DB.prepare(
    "SELECT * FROM subscribers WHERE id=?",
  )
    .bind(data.id)
    .first<Subscriber>();
  if (!sub || (action === "confirm" && sub.generation !== data.generation))
    return linkPage(
      "This link has expired",
      "Please request a new confirmation email.",
    );
  // A GET never changes consent: email security scanners can safely preview links.
  if (request.method === "GET")
    return linkPage(
      action === "confirm"
        ? "A little more writing in your inbox."
        : "Leave the writing list?",
      action === "confirm"
        ? "Confirm that you want an email when I publish a new article."
        : "You can unsubscribe below. You can always join again later.",
      action === "confirm" ? "Confirm subscription" : "Unsubscribe",
    );
  if (action === "confirm") {
    await env.INTAKE_DB.prepare(
      "UPDATE subscribers SET status='Active',confirmed_at=?,unsubscribed_at=NULL,notion_state=NULL,notion_next_attempt=0 WHERE id=? AND generation=? AND status='Pending'",
    )
      .bind(now(), sub.id, data.generation)
      .run();
    const current = await env.INTAKE_DB.prepare(
      "SELECT status FROM subscribers WHERE id=?",
    )
      .bind(sub.id)
      .first<{ status: string }>();
    return current?.status === "Active"
      ? linkPage(
          "You're on the list.",
          "I'll email you when I publish new writing. Every update includes a link to unsubscribe.",
        )
      : linkPage(
          "This link has expired",
          "Please request a new confirmation email.",
        );
  }
  // Old unsubscribe links remain valid after rejoining, so leaving is always easy.
  await env.INTAKE_DB.prepare(
    "UPDATE subscribers SET status='Unsubscribed',unsubscribed_at=?,notion_state=NULL,notion_next_attempt=0 WHERE id=?",
  )
    .bind(now(), sub.id)
    .run();
  return linkPage(
    "You're unsubscribed.",
    "You won't receive any more writing updates.",
  );
}

async function notion(env: Env, path: string, body: unknown, method = "POST") {
  const res = await fetch(`https://api.notion.com/v1/${path}`, {
    method,
    signal: AbortSignal.timeout(10000),
    headers: {
      Authorization: `Bearer ${env.NOTION_API_KEY}`,
      "Notion-Version": "2025-09-03",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`notion_${res.status}`);
  return (await res.json()) as { id: string; results?: { id: string }[] };
}
async function syncNotion(
  env: Env,
  record: Message | Subscriber,
  isSub = false,
) {
  const ds = isSub
    ? env.NOTION_SUBSCRIBERS_DATA_SOURCE_ID
    : env.NOTION_MESSAGES_DATA_SOURCE_ID;
  if (!env.NOTION_API_KEY || !ds) return;
  const idProp = isSub ? "Subscriber ID" : "Request ID";
  let pageId = record.notion_page_id;
  if (!pageId) {
    const existing = await notion(env, `data_sources/${ds}/query`, {
      filter: { property: idProp, rich_text: { equals: record.id } },
      page_size: 1,
    });
    pageId = existing.results?.[0]?.id || null;
  }
  const sub = record as Subscriber,
    message = record as Message;
  const properties = isSub
    ? {
        Name: { title: rich(record.email) },
        Email: { email: record.email },
        Consent: { select: { name: sub.status } },
        Requested: date(sub.requested_at),
        Confirmed: date(sub.confirmed_at),
        Unsubscribed: date(sub.unsubscribed_at),
        [idProp]: { rich_text: rich(record.id) },
      }
    : {
        Name: { title: rich(message.name) },
        Email: { email: record.email },
        Topic: { select: { name: message.topic } },
        Status: { select: { name: "New" } },
        Received: date(message.received_at),
        [idProp]: { rich_text: rich(record.id) },
      };
  if (pageId && isSub)
    await notion(env, `pages/${pageId}`, { properties }, "PATCH");
  if (!pageId) {
    const chunks = isSub
      ? []
      : (message.message.match(/[\s\S]{1,1800}/g) || []).map((content) => ({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: rich(content) },
        }));
    const created = await notion(env, "pages", {
      parent: { type: "data_source_id", data_source_id: ds },
      properties,
      children: chunks,
    });
    pageId = created.id;
  }
  if (isSub)
    await env
      .INTAKE_DB!.prepare(
        "UPDATE subscribers SET notion_page_id=?,notion_state=? WHERE id=? AND generation=? AND status=?",
      )
      .bind(
        pageId,
        `${sub.generation}:${sub.status}`,
        sub.id,
        sub.generation,
        sub.status,
      )
      .run();
  else
    await env
      .INTAKE_DB!.prepare("UPDATE messages SET notion_page_id=? WHERE id=?")
      .bind(pageId, record.id)
      .run();
}

async function discoverArticles(env: Env) {
  const db = env.INTAKE_DB!;
  const res = await fetch(`${site(env)}/articles/articles.json`, {
    signal: AbortSignal.timeout(10000),
    headers: { "Cache-Control": "no-cache" },
  });
  if (!res.ok) throw new Error("articles_unavailable");
  const raw: unknown = await res.json();
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > 5000)
    throw new Error("invalid_articles");
  const articles = raw
    .map((a: { slug?: unknown; title?: unknown; publishedAt?: unknown }) => {
      if (
        typeof a.slug !== "string" ||
        !/^[a-z0-9-]+$/.test(a.slug) ||
        typeof a.title !== "string" ||
        a.title.length > 500 ||
        typeof a.publishedAt !== "string" ||
        !Number.isFinite(Date.parse(a.publishedAt))
      )
        throw new Error("invalid_article");
      return { slug: a.slug, title: a.title, publishedAt: a.publishedAt };
    })
    .filter((a) => Date.parse(a.publishedAt) <= Date.now());
  const initialized = await db
    .prepare("SELECT value FROM intake_state WHERE key='articles_initialized'")
    .first();
  const known = await db
    .prepare("SELECT slug FROM articles_seen")
    .all<{ slug: string }>();
  const slugs = new Set(known.results.map((a) => a.slug));
  const unseen = articles.filter((a) => !slugs.has(a.slug));
  for (const a of unseen.slice(0, 15)) {
    const discovered = now();
    // The insert and fan-out commit atomically; interrupted runs cannot lose an article's deliveries.
    await db.batch([
      db
        .prepare("INSERT OR IGNORE INTO articles_seen VALUES (?,?,?,?)")
        .bind(a.slug, a.title, a.publishedAt, discovered),
      db
        .prepare(
          `INSERT OR IGNORE INTO article_deliveries(article_slug,subscriber_id,generation)
        SELECT ?,id,generation FROM subscribers WHERE status='Active' AND confirmed_at<=? AND ?=1`,
        )
        .bind(a.slug, discovered, initialized ? 1 : 0),
    ]);
  }
  if (unseen.length <= 15)
    await db
      .prepare(
        "INSERT OR IGNORE INTO intake_state VALUES ('articles_initialized','1')",
      )
      .run();
}

export async function runIntakeJobs(env: Env, discover = false) {
  const db = env.INTAKE_DB;
  if (!db) return;
  const time = Date.now();
  // Keep this small portfolio's sequential sends below Resend's default API rate.
  let lastMailAt = 0;
  async function queuedEmail(payload: Parameters<typeof sendEmail>[1]) {
    const delay = 600 - (Date.now() - lastMailAt);
    if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
    const sent = await sendEmail(env, payload);
    lastMailAt = Date.now();
    return sent;
  }
  const lock = await db
    .prepare(
      "UPDATE intake_state SET value=? WHERE key='job_lock' AND CAST(value AS INTEGER)<? RETURNING value",
    )
    .bind(String(time + 240000), time)
    .first();
  if (!lock) return;
  try {
    if (discover) {
      try {
        await discoverArticles(env);
      } catch {
        console.error("intake: article discovery failed");
      }
      return; // Keep hourly discovery within free-plan subrequest/query limits.
    }
    const notionEnabled = Boolean(
      env.NOTION_API_KEY &&
        env.NOTION_MESSAGES_DATA_SOURCE_ID &&
        env.NOTION_SUBSCRIBERS_DATA_SOURCE_ID,
    );
    const messages = await db
      .prepare(
        `SELECT * FROM messages WHERE (email_sent_at IS NULL AND email_attempts<8 AND email_next_attempt<=?) OR (?=1 AND notion_page_id IS NULL AND notion_next_attempt<=?) ORDER BY received_at LIMIT 2`,
      )
      .bind(time, notionEnabled ? 1 : 0, time)
      .all<Message>();
    for (const m of messages.results) {
      if (Date.now() - time > 90000) break;
      if (!m.notion_page_id && notionEnabled) {
        try {
          await syncNotion(env, m);
        } catch {
          await db
            .prepare("UPDATE messages SET notion_next_attempt=? WHERE id=?")
            .bind(time + 3600000, m.id)
            .run();
          console.error("intake: message Notion sync failed");
        }
      }
      if (
        !m.email_sent_at &&
        m.email_attempts < 8 &&
        m.email_next_attempt <= time
      ) {
        const inbox = `https://www.notion.so/${(env.NOTION_MESSAGES_DATABASE_ID || "72ce9e577255443a85a9abda87af675b").replace(/-/g, "")}`;
        const sent = await queuedEmail({
          to: env.CONTACT_TO_EMAIL,
          subject: `[Website · ${m.topic}] ${m.name}`,
          replyTo: m.email,
          idempotencyKey: `contact:${m.id}`,
          text: `From: ${m.name} <${m.email}>\nTopic: ${m.topic}\nReceived: ${m.received_at}\nReference: ${m.id}\n\n${m.message}\n\nTracker: ${inbox}`,
          html: `<p><strong>${escapeHtml(m.name)}</strong> &lt;${escapeHtml(m.email)}&gt; · ${escapeHtml(m.topic)}</p><p>${escapeHtml(m.received_at)} · ${m.id}</p><pre style="white-space:pre-wrap;font-family:inherit">${escapeHtml(m.message)}</pre><p><a href="${inbox}">Open Notion tracker</a></p>`,
        });
        await db
          .prepare(
            "UPDATE messages SET email_sent_at=?,email_attempts=email_attempts+1,email_next_attempt=? WHERE id=?",
          )
          .bind(
            sent ? now() : null,
            time + Math.min(3600000, 300000 * 2 ** m.email_attempts),
            m.id,
          )
          .run();
      }
    }
    const subs = await db
      .prepare(
        `SELECT * FROM subscribers WHERE (?=1 AND (notion_state IS NULL OR notion_state!=CAST(generation AS TEXT)||':'||status) AND notion_next_attempt<=?) OR (status='Pending' AND confirmation_sent_at IS NULL AND confirmation_attempts<8 AND confirmation_next_attempt<=? AND requested_at>?) OR (status='Active' AND owner_notified_at IS NULL AND owner_attempts<8 AND owner_next_attempt<=?) ORDER BY requested_at LIMIT 2`,
      )
      .bind(
        notionEnabled ? 1 : 0,
        time,
        time,
        new Date(time - 48 * 3600000).toISOString(),
        time,
      )
      .all<Subscriber>();
    for (const s of subs.results) {
      if (Date.now() - time > 90000) break;
      try {
        if (notionEnabled && s.notion_state !== `${s.generation}:${s.status}`)
          await syncNotion(env, s, true);
      } catch {
        await db
          .prepare("UPDATE subscribers SET notion_next_attempt=? WHERE id=?")
          .bind(time + 3600000, s.id)
          .run();
        console.error("intake: subscriber Notion sync failed");
      }
      if (
        s.status === "Pending" &&
        !s.confirmation_sent_at &&
        s.confirmation_attempts < 8 &&
        s.confirmation_next_attempt <= time &&
        Date.parse(s.requested_at) > time - 48 * 3600000
      ) {
        const link = `${api(env)}/confirm?token=${await subscriptionToken(env, s, "confirm")}`;
        const sent = await queuedEmail({
          to: s.email,
          subject: "Confirm writing updates from Zachary Sturman",
          idempotencyKey: `confirm:${s.id}:${s.generation}`,
          text: `You requested writing updates at ${site(env)}. Confirm your subscription: ${link}\n\nThis link expires in 48 hours. If you didn't request this, ignore this email.`,
          html: `<p>You requested an email when I publish new writing.</p><p><a href="${link}">Confirm subscription</a></p><p>This link expires in 48 hours. If you didn't request this, ignore this email.</p>`,
        });
        await db
          .prepare(
            "UPDATE subscribers SET confirmation_sent_at=?,confirmation_attempts=confirmation_attempts+1,confirmation_next_attempt=? WHERE id=? AND generation=?",
          )
          .bind(
            sent ? now() : null,
            time + Math.min(3600000, 300000 * 2 ** s.confirmation_attempts),
            s.id,
            s.generation,
          )
          .run();
      }
      if (
        s.status === "Active" &&
        !s.owner_notified_at &&
        s.owner_attempts < 8 &&
        s.owner_next_attempt <= time
      ) {
        const sent = await queuedEmail({
          to: env.CONTACT_TO_EMAIL,
          subject: "[Website] New confirmed writing subscriber",
          idempotencyKey: `subscriber:${s.id}:${s.generation}`,
          text: `${s.email} confirmed writing updates.\nConfirmed: ${s.confirmed_at}\nSubscriber: ${s.id}`,
          html: `<p>${escapeHtml(s.email)} confirmed writing updates.</p>`,
        });
        await db
          .prepare(
            "UPDATE subscribers SET owner_notified_at=?,owner_attempts=owner_attempts+1,owner_next_attempt=? WHERE id=? AND generation=?",
          )
          .bind(
            sent ? now() : null,
            time + Math.min(3600000, 300000 * 2 ** s.owner_attempts),
            s.id,
            s.generation,
          )
          .run();
      }
    }
    const deliveries = await db
      .prepare(
        `SELECT d.*,s.email,s.status,s.requested_at,a.title FROM article_deliveries d JOIN subscribers s ON s.id=d.subscriber_id JOIN articles_seen a ON a.slug=d.article_slug WHERE d.sent_at IS NULL AND d.attempts<8 AND d.next_attempt<=? AND s.status='Active' AND s.generation=d.generation ORDER BY a.discovered_at LIMIT 5`,
      )
      .bind(time)
      .all<{
        article_slug: string;
        subscriber_id: string;
        generation: number;
        email: string;
        requested_at: string;
        title: string;
        attempts: number;
      }>();
    for (const d of deliveries.results) {
      if (Date.now() - time > 90000) break;
      // Re-check consent just before sending (the query above may precede an unsubscribe).
      const active = await db
        .prepare(
          "SELECT id FROM subscribers WHERE id=? AND status='Active' AND generation=?",
        )
        .bind(d.subscriber_id, d.generation)
        .first();
      if (!active) continue;
      const unsubscribe = `${api(env)}/unsubscribe?token=${await subscriptionToken(env, { id: d.subscriber_id, generation: d.generation, requested_at: d.requested_at } as Subscriber, "unsubscribe")}`;
      const url = `${site(env)}/articles/${d.article_slug}`;
      const sent = await queuedEmail({
        to: d.email,
        subject: `New writing: ${d.title}`,
        idempotencyKey: `article:${d.article_slug}:${d.subscriber_id}`,
        headers: { "List-Unsubscribe": `<${unsubscribe}>` },
        text: `${d.title}\n\nRead: ${url}\n\nYou're receiving this because you confirmed writing updates from Zachary Sturman.\nUnsubscribe: ${unsubscribe}`,
        html: `<p>New writing from Zachary Sturman</p><h1>${escapeHtml(d.title)}</h1><p><a href="${url}">Read the article →</a></p><p>You confirmed writing updates. <a href="${unsubscribe}">Unsubscribe</a></p>`,
      });
      await db
        .prepare(
          "UPDATE article_deliveries SET sent_at=?,attempts=attempts+1,next_attempt=? WHERE article_slug=? AND subscriber_id=?",
        )
        .bind(
          sent ? now() : null,
          time + Math.min(3600000, 300000 * 2 ** d.attempts),
          d.article_slug,
          d.subscriber_id,
        )
        .run();
    }
    await db
      .prepare("DELETE FROM rate_limits WHERE expires_at<?")
      .bind(Math.floor(time / 1000) - 86400)
      .run();
  } finally {
    await db
      .prepare(
        "UPDATE intake_state SET value='0' WHERE key='job_lock' AND value=?",
      )
      .bind(String(time + 240000))
      .run();
  }
}
