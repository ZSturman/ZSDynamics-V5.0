"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  trackContactSubmit,
  trackNewsletterInterest,
} from "@/lib/firebase-analytics";

const CONTACT_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

type Variant = "contact" | "newsletter";

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success" }
  | { kind: "error"; message: string }
  | { kind: "rate_limited" };

declare global {
  interface Window {
    turnstile?: {
      render: (
        target: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
        },
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

let turnstileScriptPromise: Promise<void> | null = null;
function loadTurnstileScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (turnstileScriptPromise) return turnstileScriptPromise;
  turnstileScriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-turnstile="true"]',
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("turnstile_load_failed")));
      return;
    }
    const s = document.createElement("script");
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js";
    s.async = true;
    s.defer = true;
    s.dataset.turnstile = "true";
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("turnstile_load_failed")));
    document.head.appendChild(s);
  });
  return turnstileScriptPromise;
}

function errorMessageFor(code: string): string {
  switch (code) {
    case "invalid_email":
      return "That email address doesn't look right.";
    case "invalid_name":
      return "Please include your name.";
    case "invalid_message":
      return "Please write a slightly longer message (5+ characters).";
    case "turnstile_failed":
      return "Verification failed. Try again.";
    case "send_failed":
      return "Email delivery failed. Please try again later.";
    case "origin_not_allowed":
      return "Submission blocked. Refresh the page and try again.";
    default:
      return "Something went wrong. Please try again.";
  }
}

export function ContactForm({ variant = "contact" }: { variant?: Variant }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [hp, setHp] = useState("");
  const [token, setToken] = useState("");
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const widgetRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);

  const isNewsletter = variant === "newsletter";

  useEffect(() => {
    let cancelled = false;
    if (!TURNSTILE_SITE_KEY) return;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !widgetRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(widgetRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          callback: (t) => setToken(t),
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
          theme: "auto",
        });
      })
      .catch(() => {
        // Silent — submission will fail at server with turnstile_failed.
      });
    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try {
          window.turnstile.remove(widgetIdRef.current);
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  function resetTurnstile() {
    setToken("");
    if (widgetIdRef.current && typeof window !== "undefined" && window.turnstile) {
      try {
        window.turnstile.reset(widgetIdRef.current);
      } catch {
        /* noop */
      }
    }
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (state.kind === "submitting") return;
    if (!CONTACT_API_BASE_URL) {
      setState({ kind: "error", message: "Contact endpoint is not configured." });
      return;
    }
    setState({ kind: "submitting" });
    const endpoint = isNewsletter ? "/newsletter-interest" : "/contact";
    const payload = isNewsletter
      ? { email, hp, turnstileToken: token }
      : { name, email, message, hp, turnstileToken: token };
    try {
      const res = await fetch(`${CONTACT_API_BASE_URL}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
      };
      if (res.status === 429) {
        setState({ kind: "rate_limited" });
        if (isNewsletter) trackNewsletterInterest("rate_limited");
        else trackContactSubmit("rate_limited", "rate_limited");
        return;
      }
      if (!res.ok || !data.ok) {
        const code = data.error || "unknown";
        setState({ kind: "error", message: errorMessageFor(code) });
        if (isNewsletter) trackNewsletterInterest("error");
        else trackContactSubmit("error", code);
        resetTurnstile();
        return;
      }
      setState({ kind: "success" });
      if (isNewsletter) {
        trackNewsletterInterest("success");
        setEmail("");
      } else {
        trackContactSubmit("success");
        setName("");
        setEmail("");
        setMessage("");
      }
      setHp("");
      resetTurnstile();
    } catch {
      setState({ kind: "error", message: errorMessageFor("network") });
      if (isNewsletter) trackNewsletterInterest("error");
      else trackContactSubmit("error", "network");
      resetTurnstile();
    }
  }

  const submitting = state.kind === "submitting";

  return (
    <form
      onSubmit={onSubmit}
      data-analytics-section={isNewsletter ? "newsletter_form" : "contact_form"}
      className="space-y-4"
      noValidate
    >
      {!isNewsletter && (
        <div className="space-y-1.5">
          <label htmlFor="contact-name" className="text-sm font-medium text-foreground">
            Name
          </label>
          <Input
            id="contact-name"
            name="name"
            type="text"
            autoComplete="name"
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            data-testid="contact-form-name"
          />
        </div>
      )}
      <div className="space-y-1.5">
        <label htmlFor="contact-email" className="text-sm font-medium text-foreground">
          Email
        </label>
        <Input
          id="contact-email"
          name="email"
          type="email"
          autoComplete="email"
          required
          maxLength={320}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          data-testid={isNewsletter ? "newsletter-form-email" : "contact-form-email"}
        />
      </div>
      {!isNewsletter && (
        <div className="space-y-1.5">
          <label htmlFor="contact-message" className="text-sm font-medium text-foreground">
            Message
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={5}
            maxLength={5000}
            rows={6}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            disabled={submitting}
            data-testid="contact-form-message"
            className="border-input dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 flex w-full min-w-0 rounded-md border bg-transparent px-3 py-2 text-base shadow-xs outline-none transition-[color,box-shadow] focus-visible:ring-[3px] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          />
        </div>
      )}

      {/* Honeypot — visually hidden, also aria-hidden so AT skip it. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-auto h-px w-px overflow-hidden">
        <label htmlFor="contact-hp">Leave this field empty</label>
        <input
          id="contact-hp"
          name="hp"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
      </div>

      {TURNSTILE_SITE_KEY ? (
        <div ref={widgetRef} data-testid="contact-form-turnstile" className="min-h-[65px]" />
      ) : (
        <p className="text-xs text-muted-foreground">
          Spam protection is currently disabled in this environment.
        </p>
      )}

      <div className="flex items-center gap-3">
        <Button
          type="submit"
          disabled={submitting || (Boolean(TURNSTILE_SITE_KEY) && !token)}
          data-testid={isNewsletter ? "newsletter-form-submit" : "contact-form-submit"}
          data-analytics-skip="true"
        >
          {submitting
            ? "Sending…"
            : isNewsletter
              ? "Notify me"
              : "Send message"}
        </Button>

        {state.kind === "success" && (
          <p className="text-sm text-foreground/80" role="status">
            {isNewsletter
              ? "Thanks — you're on the list."
              : "Thanks — your message is on its way."}
          </p>
        )}
        {state.kind === "rate_limited" && (
          <p className="text-sm text-amber-600 dark:text-amber-400" role="alert">
            Too many submissions. Try again in a bit.
          </p>
        )}
        {state.kind === "error" && (
          <p className="text-sm text-destructive" role="alert">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}
