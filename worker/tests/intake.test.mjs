import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import { Miniflare, Response } from "miniflare";
import { chromium } from "@playwright/test";

let mf, db;
let verification = {
  success: true,
  hostname: "zacharysturman.com",
  action: "contact",
};
let mailStatus = 200,
  notionStatus = 200,
  mail = [],
  notionPages = [];
let articles = [
  {
    slug: "existing-article",
    title: "Existing article",
    publishedAt: "2026-01-01",
  },
];
const bindings = {
  ALLOWED_ORIGINS: "https://zacharysturman.com",
  CONTACT_FROM_EMAIL: "contact@example.com",
  CONTACT_TO_EMAIL: "owner@example.com",
  RESEND_API_KEY: "test-key",
  TURNSTILE_SECRET: "test-secret",
  INTERNAL_TOKEN: "test-internal-token",
  NOTION_API_KEY: "test-notion",
  NOTION_MESSAGES_DATA_SOURCE_ID: "messages-ds",
  NOTION_SUBSCRIBERS_DATA_SOURCE_ID: "subscribers-ds",
};
const origin = "https://zacharysturman.com";
const payload = () => ({
  name: "Test Visitor",
  email: "visitor@example.com",
  message: "This is a test message.",
  topic: "App support",
  turnstileToken: "test-token",
  requestId: crypto.randomUUID(),
});
function post(path, body, headers = {}) {
  return mf.dispatchFetch(`https://api.example.com${path}`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}
async function jobs(discover = false) {
  const r = await mf.dispatchFetch(
    `http://localhost/__test/jobs?cron=${encodeURIComponent(discover ? "0 * * * *" : "*/5 * * * *")}`,
  );
  assert.equal(r.status, 200, await r.text());
}
before(async () => {
  const bundle = await build({
    stdin: {
      contents: `import worker from './src/index.ts'; export default {async fetch(request,env){if(new URL(request.url).pathname==='/__test/jobs'){await worker.scheduled({cron:new URL(request.url).searchParams.get('cron')},env);return new Response('ok');}return worker.fetch(request,env);}};`,
      resolveDir: process.cwd(),
    },
    bundle: true,
    write: false,
    format: "esm",
    target: "es2022",
  });
  mf = new Miniflare({
    modules: true,
    script: bundle.outputFiles[0].text,
    compatibilityDate: "2024-11-01",
    d1Databases: ["INTAKE_DB"],
    bindings,
    outboundService: async (request) => {
      const url = new URL(request.url);
      if (url.hostname === "challenges.cloudflare.com")
        return Response.json(verification);
      if (url.hostname === "api.resend.com") {
        const body = await request.json();
        mail.push({ body, key: request.headers.get("Idempotency-Key") });
        return Response.json({ id: "email-id" }, { status: mailStatus });
      }
      if (url.hostname === "api.notion.com") {
        const body = await request.json();
        if (notionStatus !== 200)
          return Response.json(
            { error: "unavailable" },
            { status: notionStatus },
          );
        if (url.pathname.endsWith("/query"))
          return Response.json({ results: [] });
        notionPages.push(body);
        return Response.json({ id: "00000000-0000-4000-8000-000000000001" });
      }
      if (url.pathname === "/articles/articles.json")
        return Response.json(articles);
      throw new Error(`Unexpected external request: ${url}`);
    },
  });
  db = await mf.getD1Database("INTAKE_DB");
  // D1 exec expects one statement per line.
  const schema =
    readFileSync("migrations/0001_intake.sql", "utf8")
      .split(";")
      .map((s) => s.trim().replace(/\n/g, " "))
      .filter(Boolean)
      .join(";\n") + ";";
  await db.exec(schema);
});
after(async () => {
  await mf?.dispose();
});
beforeEach(async () => {
  for (const table of [
    "article_deliveries",
    "articles_seen",
    "messages",
    "subscribers",
    "rate_limits",
  ])
    await db.prepare(`DELETE FROM ${table}`).run();
  await db.prepare("DELETE FROM intake_state WHERE key!='job_lock'").run();
  await db
    .prepare("UPDATE intake_state SET value='0' WHERE key='job_lock'")
    .run();
  verification = {
    success: true,
    hostname: "zacharysturman.com",
    action: "contact",
  };
  mailStatus = 200;
  notionStatus = 200;
  mail = [];
  notionPages = [];
  articles = [
    {
      slug: "existing-article",
      title: "Existing article",
      publishedAt: "2026-01-01",
    },
  ];
});
test("contact is saved once, then independently synced and emailed with reply-to", async () => {
  const body = payload();
  for (let i = 0; i < 2; i++) {
    const r = await post("/contact", body);
    assert.equal(r.status, 200);
    assert.equal((await r.json()).reference, body.requestId);
  }
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM messages").first()).n,
    1,
  );
  assert.equal(mail.length, 0);
  await jobs();
  assert.equal(mail.length, 1);
  assert.equal(mail[0].body.reply_to, body.email);
  assert.equal(mail[0].key, `contact:${body.requestId}`);
  assert.equal(notionPages.length, 1);
  assert.equal(notionPages[0].properties.Topic.select.name, "App support");
  assert.equal(
    notionPages[0].children[0].paragraph.rich_text[0].text.content,
    body.message,
  );
  await jobs();
  assert.equal(mail.length, 1);
  assert.equal(notionPages.length, 1);
});
test("mail and Notion outages preserve accepted content and allow retry without duplicate submission", async () => {
  notionStatus = 503;
  mailStatus = 503;
  assert.equal((await post("/contact", payload())).status, 200);
  await jobs();
  let row = await db.prepare("SELECT * FROM messages").first();
  assert.equal(row.email_sent_at, null);
  assert.equal(row.email_attempts, 1);
  assert.equal(row.notion_page_id, null);
  notionStatus = 200;
  mailStatus = 200;
  await db
    .prepare("UPDATE messages SET email_next_attempt=0,notion_next_attempt=0")
    .run();
  await jobs();
  row = await db.prepare("SELECT * FROM messages").first();
  assert.ok(row.email_sent_at);
  assert.ok(row.notion_page_id);
  assert.equal(mail[0].key, mail[1].key);
});
test("spam, invalid input, wrong hostname/action and missing origin cannot enter storage", async () => {
  assert.equal(
    (await post("/contact", { ...payload(), hp: "spam" })).status,
    200,
  );
  assert.equal(
    (await post("/contact", { ...payload(), email: "bad-email" })).status,
    400,
  );
  assert.equal(
    (await post("/contact", payload(), { Origin: "https://evil.example" }))
      .status,
    403,
  );
  assert.equal((await post("/contact", payload(), { Origin: "" })).status, 403);
  verification.hostname = "evil.example";
  assert.equal((await post("/contact", payload())).status, 400);
  verification.hostname = "zacharysturman.com";
  verification.action = "newsletter";
  assert.equal((await post("/contact", payload())).status, 400);
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM messages").first()).n,
    0,
  );
});
test("oversized bodies are rejected and rate limits are atomic without retaining raw IP", async () => {
  assert.equal(
    (await post("/contact", { ...payload(), message: "x".repeat(17000) }))
      .status,
    400,
  );
  const statuses = await Promise.all(
    Array.from(
      { length: 8 },
      async () =>
        (await post("/contact", payload(), { "CF-Connecting-IP": "192.0.2.5" }))
          .status,
    ),
  );
  assert.equal(statuses.filter((x) => x === 200).length, 3);
  assert.equal(statuses.filter((x) => x === 429).length, 5);
  const keys = await db.prepare("SELECT key FROM rate_limits").all();
  assert.ok(
    keys.results.every(
      (r) =>
        !r.key.includes("192.0.2.5") && !r.key.includes("visitor@example.com"),
    ),
  );
});
test("subscription requires consent, confirms with POST, deduplicates and stops after unsubscribe", async () => {
  verification.action = "newsletter";
  const body = {
    email: "reader@example.com",
    turnstileToken: "token",
    consent: true,
  };
  assert.equal(
    (await post("/newsletter-interest", { ...body, consent: false })).status,
    400,
  );
  assert.equal((await post("/newsletter-interest", body)).status, 200);
  await jobs(true); // baseline only
  await jobs(); // confirmation
  assert.equal(mail.length, 1);
  assert.match(mail[0].body.subject, /Confirm/);
  const link = mail[0].body.text.match(
    /https:\/\/[^\s]+\/confirm\?token=[^\s]+/,
  )[0];
  assert.equal((await mf.dispatchFetch(link)).status, 200);
  let sub = await db.prepare("SELECT * FROM subscribers").first();
  assert.equal(sub.status, "Pending");
  assert.equal(
    (
      await mf.dispatchFetch(link, {
        method: "POST",
        headers: { Origin: new URL(link).origin },
      })
    ).status,
    200,
  );
  sub = await db.prepare("SELECT * FROM subscribers").first();
  assert.equal(sub.status, "Active");
  await jobs();
  assert.match(mail.at(-1).body.subject, /New confirmed/);
  articles.push({
    slug: "new-article",
    title: "A new article",
    publishedAt: "2026-10-01",
  });
  await jobs(true);
  await jobs();
  const update = mail.find(
    (m) => m.body.subject === "New writing: A new article",
  );
  assert.ok(update);
  assert.match(update.body.text, /Unsubscribe:/);
  await jobs(true);
  await jobs();
  assert.equal(
    mail.filter((m) => m.body.subject.startsWith("New writing:")).length,
    1,
  );
  const unsubscribe = update.body.text.match(/Unsubscribe: (\S+)/)[1];
  await mf.dispatchFetch(unsubscribe);
  assert.equal(
    (await db.prepare("SELECT status FROM subscribers").first()).status,
    "Active",
  );
  await mf.dispatchFetch(unsubscribe, {
    method: "POST",
    headers: { Origin: new URL(unsubscribe).origin },
  });
  assert.equal(
    (await db.prepare("SELECT status FROM subscribers").first()).status,
    "Unsubscribed",
  );
  articles.push({
    slug: "later-article",
    title: "Later article",
    publishedAt: "2026-10-02",
  });
  await jobs(true);
  await jobs();
  assert.equal(
    mail.filter((m) => m.body.subject.startsWith("New writing:")).length,
    1,
  );
  await mf.dispatchFetch(link, {
    method: "POST",
    headers: { Origin: new URL(link).origin },
  });
  assert.equal(
    (await db.prepare("SELECT status FROM subscribers").first()).status,
    "Unsubscribed",
  );
});
test("existing articles never send during initial baseline; bad tokens cannot change consent", async () => {
  await db
    .prepare(
      "INSERT INTO subscribers(id,email,status,requested_at,confirmed_at) VALUES ('reader','reader@example.com','Active',?,?)",
    )
    .bind(new Date().toISOString(), new Date().toISOString())
    .run();
  await jobs(true);
  assert.equal(
    (await db.prepare("SELECT count(*) n FROM article_deliveries").first()).n,
    0,
  );
  await mf.dispatchFetch("https://api.example.com/unsubscribe?token=invalid", {
    method: "POST",
  });
  assert.equal(
    (await db.prepare("SELECT status FROM subscribers").first()).status,
    "Active",
  );
});
test("real browser confirmation and unsubscribe forms preserve their API origin", async () => {
  verification.action = "newsletter";
  await post("/newsletter-interest", { email: "browser@example.com", consent: true, turnstileToken: "token" });
  await jobs();
  const emailedLink = new URL(mail[0].body.text.match(/https:\/\/[^\s]+\/confirm\?token=[^\s]+/)[0]);
  const localOrigin = await mf.ready;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    const response = await page.goto(new URL(emailedLink.pathname + emailedLink.search, localOrigin).href);
    assert.equal(response.headers()["referrer-policy"], "same-origin");
    assert.equal((await db.prepare("SELECT status FROM subscribers").first()).status, "Pending");
    await Promise.all([
      page.waitForURL((url) => url.pathname === "/confirm", { waitUntil: "load" }),
      page.getByRole("button", { name: "Confirm subscription" }).click(),
    ]);
    await page.getByRole("heading", { name: "You're on the list." }).waitFor();
    assert.equal((await db.prepare("SELECT status FROM subscribers").first()).status, "Active");
    await jobs(true); // existing articles are never mailed
    articles.push({ slug: "browser-article", title: "Browser article", publishedAt: "2026-10-01" });
    await jobs(true);
    await jobs();
    const update = mail.find((m) => m.body.subject === "New writing: Browser article");
    const unsubscribe = new URL(update.body.text.match(/Unsubscribe: (\S+)/)[1]);
    await page.goto(new URL(unsubscribe.pathname + unsubscribe.search, localOrigin).href);
    await page.getByRole("button", { name: "Unsubscribe", exact: true }).click();
    await page.getByRole("heading", { name: "You're unsubscribed." }).waitFor();
    assert.equal((await db.prepare("SELECT status FROM subscribers").first()).status, "Unsubscribed");
  } finally {
    await browser.close();
  }
});
test("signed forms still reject foreign and opaque POST origins", async () => {
  for (const path of ["/confirm", "/unsubscribe"]) {
    for (const Origin of ["https://evil.example", "null", origin]) {
      const response = await mf.dispatchFetch(`https://api.example.com${path}?token=invalid`, {
        method: "POST", headers: { Origin },
      });
      assert.equal(response.status, 403);
    }
  }
});
test("article delivery retries safely, excludes pending readers, and suppresses queued mail after leaving or rejoining", async () => {
  const timestamp = new Date().toISOString();
  for (const [id, status] of [["active", "Active"], ["pending", "Pending"], ["left", "Unsubscribed"]]) {
    await db.prepare("INSERT INTO subscribers(id,email,status,requested_at,confirmed_at,owner_notified_at,confirmation_sent_at) VALUES (?,?,?,?,?,?,?)")
      .bind(id, `${id}@example.com`, status, timestamp, status === "Active" ? timestamp : null, timestamp, timestamp).run();
  }
  await jobs(true);
  articles.push({ slug: "new-release", title: "A release", publishedAt: "2026-10-01" });
  await jobs(true);
  assert.equal((await db.prepare("SELECT count(*) n FROM article_deliveries").first()).n, 1);
  mailStatus = 503;
  await jobs();
  const firstAttempt = mail.find((m) => m.body.subject === "New writing: A release");
  assert.ok(firstAttempt);
  assert.equal((await db.prepare("SELECT sent_at FROM article_deliveries").first()).sent_at, null);
  mailStatus = 200;
  await db.prepare("UPDATE article_deliveries SET next_attempt=0").run();
  await jobs();
  const attempts = mail.filter((m) => m.body.subject === "New writing: A release");
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].key, attempts[1].key);
  assert.deepEqual(attempts[1].body.to, ["active@example.com"]);
  articles[1].title = "An edited release";
  await jobs(true);
  await jobs();
  assert.equal(mail.filter((m) => m.body.subject.startsWith("New writing:")).length, 2);
  articles.push({ slug: "queued-release", title: "Queued release", publishedAt: "2026-10-01" });
  await jobs(true);
  await db.prepare("UPDATE subscribers SET status='Unsubscribed' WHERE id='active'").run();
  await jobs();
  assert.equal(mail.filter((m) => m.body.subject === "New writing: Queued release").length, 0);
  await db.prepare("UPDATE subscribers SET status='Active', generation=generation+1 WHERE id='active'").run();
  await jobs();
  assert.equal(mail.filter((m) => m.body.subject === "New writing: Queued release").length, 0);
});
test("daily summary authorization and attachments survive the intake change", async () => {
  assert.equal(
    (
      await post("/internal/daily-summary", {
        subject: "Report",
        text: "hello",
      })
    ).status,
    401,
  );
  const r = await post(
    "/internal/daily-summary",
    {
      subject: "Report",
      text: "hello",
      attachments: [{ filename: "preview.png", content: btoa("fake-png") }],
      idempotencyKey: "report:test",
    },
    { Authorization: "Bearer test-internal-token" },
  );
  assert.equal(r.status, 200);
  assert.equal(mail[0].body.attachments.length, 1);
});

test("Notion outages do not let older records starve a later contact", async () => {
  notionStatus = 503;
  for (let i = 0; i < 3; i++) {
    const body = { ...payload(), email: `visitor${i}@example.com` };
    assert.equal((await post("/contact", body)).status, 200);
  }
  await jobs();
  assert.equal(mail.length, 2);
  await jobs();
  assert.equal(mail.length, 3);
  assert.equal(
    (
      await db
        .prepare(
          "SELECT count(*) n FROM messages WHERE email_sent_at IS NOT NULL",
        )
        .first()
    ).n,
    3,
  );
});

test("confirmation mail retries and renewed consent invalidate old links without activating the reader", async () => {
  verification.action = "newsletter";
  const body = { email: "retry-reader@example.com", consent: true, turnstileToken: "token" };
  await post("/newsletter-interest", body);
  mailStatus = 503;
  await jobs();
  let sub = await db.prepare("SELECT * FROM subscribers").first();
  assert.equal(sub.status, "Pending");
  assert.equal(sub.confirmation_sent_at, null);
  assert.equal(sub.confirmation_attempts, 1);
  const firstKey = mail[0].key;
  mailStatus = 200;
  await db.prepare("UPDATE subscribers SET confirmation_next_attempt=0").run();
  await jobs();
  sub = await db.prepare("SELECT * FROM subscribers").first();
  assert.ok(sub.confirmation_sent_at);
  assert.equal(sub.confirmation_attempts, 2);
  assert.equal(mail.at(-1).key, firstKey);
  const oldLink = mail.at(-1).body.text.match(/https:\/\/[^\s]+\/confirm\?token=[^\s]+/)[0];
  await db.prepare("UPDATE subscribers SET requested_at=?").bind(new Date(Date.now() - 49 * 3600000).toISOString()).run();
  await post("/newsletter-interest", body);
  await mf.dispatchFetch(oldLink, { method: "POST", headers: { Origin: new URL(oldLink).origin } });
  sub = await db.prepare("SELECT * FROM subscribers").first();
  assert.equal(sub.status, "Pending");
  assert.equal(sub.generation, 2);
  await jobs();
  const newLink = mail.at(-1).body.text.match(/https:\/\/[^\s]+\/confirm\?token=[^\s]+/)[0];
  assert.notEqual(newLink, oldLink);
  await mf.dispatchFetch(newLink, { method: "POST", headers: { Origin: "https://evil.example" } });
  assert.equal((await db.prepare("SELECT status FROM subscribers").first()).status, "Pending");
  await mf.dispatchFetch(newLink, { method: "POST", headers: { Origin: new URL(newLink).origin } });
  assert.equal((await db.prepare("SELECT status FROM subscribers").first()).status, "Active");
});
