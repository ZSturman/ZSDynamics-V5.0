import type { Env } from "./index";

export function escapeHtml(s: string): string {
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

export async function sendEmail(
  env: Env,
  payload: {
    to: string;
    subject: string;
    html: string;
    text: string;
    replyTo?: string;
    attachments?: Array<{ filename: string; content: string }>;
    idempotencyKey?: string;
    headers?: Record<string, string>;
  },
): Promise<boolean> {
  if (!env.RESEND_API_KEY) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
        ...(payload.idempotencyKey
          ? { "Idempotency-Key": payload.idempotencyKey }
          : {}),
      },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({
        from: env.CONTACT_FROM_EMAIL,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
        reply_to: payload.replyTo,
        headers: payload.headers,
        ...(payload.attachments?.length
          ? { attachments: payload.attachments }
          : {}),
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}
