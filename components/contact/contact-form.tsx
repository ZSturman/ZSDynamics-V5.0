"use client";

import contactConfig from "@/lib/contact-config.json";

import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  LoaderCircle,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  trackContactSubmit,
  trackNewsletterInterest,
} from "@/lib/firebase-analytics";

const API = (
  process.env.NEXT_PUBLIC_API_BASE_URL || contactConfig.apiBaseUrl
).replace(/\/+$/, "");
const SITE_KEY =
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || contactConfig.turnstileSiteKey;
type Variant = "contact" | "newsletter";
type State =
  | { kind: "idle" | "submitting" }
  | { kind: "success"; reference?: string }
  | { kind: "error"; message: string };
type Verification = "loading" | "ready" | "verified" | "failed";
declare global {
  interface Window {
    turnstile?: {
      render: (
        target: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback": () => void;
          "error-callback": () => void;
          theme: "auto";
          action: string;
          size: "flexible";
        },
      ) => string;
      reset: (id: string) => void;
      remove: (id: string) => void;
    };
  }
}
let scriptPromise: Promise<void> | null = null;
function loadTurnstile() {
  if (window.turnstile) return Promise.resolve();
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise<void>((resolve, reject) => {
    document.querySelector('script[data-turnstile="true"]')?.remove();
    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.dataset.turnstile = "true";
    const timeout = window.setTimeout(() => {
      script.remove();
      reject(new Error("verification_timeout"));
    }, 15000);
    script.onload = () => {
      window.clearTimeout(timeout);
      resolve();
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error("verification_failed"));
    };
    document.head.appendChild(script);
  }).catch((error) => {
    scriptPromise = null;
    throw error;
  });
  return scriptPromise;
}
function errorMessage(code: string) {
  switch (code) {
    case "invalid_email":
      return "Please enter a valid email address.";
    case "invalid_name":
      return "Please include your name.";
    case "invalid_message":
      return "Please write a message between 5 and 5,000 characters.";
    case "turnstile_failed":
      return "Verification expired. Please verify again and resend.";
    case "rate_limited":
      return "You've sent several requests. Please try again in an hour, or email me directly.";
    case "service_unavailable":
      return "The form is temporarily unavailable. Your message is still here; please try again later or email me directly.";
    default:
      return "We couldn't submit this. Your details are still here; please try again or email me directly.";
  }
}
export function ContactForm({ variant = "contact" }: { variant?: Variant }) {
  const id = useId(),
    newsletter = variant === "newsletter";
  const [name, setName] = useState(""),
    [email, setEmail] = useState(""),
    [message, setMessage] = useState(""),
    [topic, setTopic] = useState("Project or collaboration"),
    [hp, setHp] = useState("");
  const [consent, setConsent] = useState(false),
    [token, setToken] = useState("");
  const [state, setState] = useState<State>({ kind: "idle" });
  const [verification, setVerification] = useState<Verification>("loading"),
    [retry, setRetry] = useState(0);
  const widget = useRef<HTMLDivElement>(null),
    widgetId = useRef<string | null>(null),
    requestId = useRef("");
  const feedback = useRef<HTMLDivElement>(null);
  const succeeded = state.kind === "success";
  useEffect(() => {
    let cancelled = false;
    if (!SITE_KEY || succeeded) return;
    loadTurnstile()
      .then(() => {
        if (cancelled || !widget.current || !window.turnstile) return;
        setVerification("ready");
        widgetId.current = window.turnstile.render(widget.current, {
          sitekey: SITE_KEY,
          theme: "auto",
          size: "flexible",
          action: variant,
          callback: (t) => {
            setToken(t);
            setVerification("verified");
          },
          "expired-callback": () => {
            setToken("");
            setVerification("ready");
          },
          "error-callback": () => {
            setToken("");
            setVerification("failed");
          },
        });
      })
      .catch(() => {
        if (!cancelled) setVerification("failed");
      });
    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, [variant, retry, succeeded]);
  useEffect(() => {
    if (state.kind === "success" || state.kind === "error")
      feedback.current?.focus();
  }, [state]);
  function resetVerification() {
    setToken("");
    setVerification("ready");
    if (widgetId.current) window.turnstile?.reset(widgetId.current);
  }
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state.kind === "submitting" || !token || !SITE_KEY) return;
    setState({ kind: "submitting" });
    if (!requestId.current) requestId.current = crypto.randomUUID();
    const payload = newsletter
      ? { email, consent, hp, turnstileToken: token }
      : {
          name,
          email,
          message,
          topic,
          hp,
          turnstileToken: token,
          requestId: requestId.current,
        };
    try {
      const res = await fetch(
        `${API}/${newsletter ? "newsletter-interest" : "contact"}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(20000),
        },
      );
      const data = (await res.json()) as {
        ok?: boolean;
        error?: string;
        reference?: string;
      };
      if (!res.ok || !data.ok) {
        const code =
          res.status === 429 ? "rate_limited" : data.error || "unknown";
        setState({ kind: "error", message: errorMessage(code) });
        if (newsletter)
          trackNewsletterInterest(
            res.status === 429 ? "rate_limited" : "error",
          );
        else
          trackContactSubmit(
            res.status === 429 ? "rate_limited" : "error",
            code,
          );
        if (code === "request_conflict") requestId.current = "";
        resetVerification();
        return;
      }
      setState({ kind: "success", reference: data.reference });
      if (newsletter) trackNewsletterInterest("success");
      else trackContactSubmit("success");
      setName("");
      setEmail("");
      setMessage("");
      setHp("");
      setConsent(false);
      requestId.current = "";
      resetVerification();
    } catch {
      setState({ kind: "error", message: errorMessage("network") });
      if (newsletter) trackNewsletterInterest("error");
      else trackContactSubmit("error", "network");
      resetVerification();
    }
  }
  const busy = state.kind === "submitting";
  const fieldClass = "h-12 rounded-lg bg-background text-base shadow-none";
  if (state.kind === "success")
    return (
      <div
        ref={feedback}
        tabIndex={-1}
        role="status"
        className="rounded-xl border border-emerald-600/25 bg-emerald-600/5 p-5 outline-none"
      >
        <CheckCircle2
          aria-hidden="true"
          className="mb-3 size-6 text-emerald-700 dark:text-emerald-400"
        />
        <h3 className="font-semibold">
          {newsletter ? "Check your inbox." : "Thanks for reaching out."}
        </h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          {newsletter
            ? "If this address isn't already subscribed, you'll receive a confirmation link shortly. Click it to start receiving new writing. Check spam, too; delivery can take a few minutes."
            : "Your message has been saved. I'll reply to the email address you provided."}
        </p>
        {!newsletter && state.reference && (
          <p className="mt-3 break-all font-mono text-xs text-muted-foreground">
            Reference: {state.reference}
          </p>
        )}
        <Button
          type="button"
          variant="ghost"
          className="mt-4"
          onClick={() => setState({ kind: "idle" })}
        >
          {newsletter ? "Use another email" : "Send another message"}
          <ArrowRight aria-hidden="true" className="size-4" />
        </Button>
      </div>
    );
  return (
    <form
      onSubmit={submit}
      data-analytics-section={newsletter ? "newsletter_form" : "contact_form"}
      className="space-y-5"
      aria-busy={busy}
    >
      {!newsletter && (
        <div className="space-y-2">
          <label htmlFor={`${id}-name`} className="text-sm font-medium">
            Your name
          </label>
          <Input
            id={`${id}-name`}
            name="name"
            autoComplete="name"
            placeholder="Alex Morgan"
            required
            maxLength={200}
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              requestId.current = "";
            }}
            disabled={busy}
            data-testid="contact-form-name"
            className={fieldClass}
          />
        </div>
      )}
      <div className="space-y-2">
        <label htmlFor={`${id}-email`} className="text-sm font-medium">
          Email address
        </label>
        <Input
          id={`${id}-email`}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          required
          maxLength={254}
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            requestId.current = "";
          }}
          disabled={busy}
          data-testid={
            newsletter ? "newsletter-form-email" : "contact-form-email"
          }
          className={fieldClass}
        />
      </div>
      {!newsletter && (
        <>
          <div className="space-y-2">
            <label htmlFor={`${id}-topic`} className="text-sm font-medium">
              What&apos;s on your mind?
            </label>
            <select
              id={`${id}-topic`}
              name="topic"
              value={topic}
              onChange={(e) => {
                setTopic(e.target.value);
                requestId.current = "";
              }}
              disabled={busy}
              className="h-12 w-full rounded-lg border border-input bg-background px-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option>Project or collaboration</option>
              <option>Role or opportunity</option>
              <option>App support</option>
              <option>Other</option>
            </select>
          </div>
          <div className="space-y-2">
            <label htmlFor={`${id}-message`} className="text-sm font-medium">
              Your message
            </label>
            <textarea
              id={`${id}-message`}
              name="message"
              placeholder="A little context, what you're thinking, and how I can help…"
              required
              minLength={5}
              maxLength={5000}
              rows={6}
              value={message}
              onChange={(e) => {
                setMessage(e.target.value);
                requestId.current = "";
              }}
              disabled={busy}
              data-testid="contact-form-message"
              className="flex min-h-40 w-full rounded-lg border border-input bg-background px-3 py-3 text-base shadow-none outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
            />
          </div>
        </>
      )}
      {newsletter && (
        <label className="flex items-start gap-3 text-xs leading-5 text-muted-foreground">
          <input
            type="checkbox"
            name="consent"
            required
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            disabled={busy}
            className="mt-1 size-4 shrink-0 accent-[#244468]"
          />
          <span>
            I&apos;d like emails about new articles. I&apos;ll confirm my
            address first and can unsubscribe from any update.
          </span>
        </label>
      )}
      <div hidden aria-hidden="true">
        <label htmlFor={`${id}-hp`}>Leave this field empty</label>
        <input
          id={`${id}-hp`}
          name="hp"
          tabIndex={-1}
          autoComplete="off"
          value={hp}
          onChange={(e) => setHp(e.target.value)}
        />
      </div>
      {SITE_KEY ? (
        <div className="space-y-2">
          <div
            ref={widget}
            data-testid={`${variant}-form-turnstile`}
            className="min-h-[65px] min-w-0"
          />
          {verification === "loading" && (
            <p role="status" className="text-xs text-muted-foreground">
              Loading verification…
            </p>
          )}
          {verification === "failed" && (
            <div role="alert" className="text-sm">
              <p>
                Verification couldn&apos;t load. Check your connection or use
                the email link below.
              </p>
              <button
                type="button"
                className="mt-2 inline-flex min-h-10 items-center gap-2 underline"
                onClick={() => {
                  setToken("");
                  setVerification("loading");
                  setRetry((r) => r + 1);
                }}
              >
                <RotateCcw aria-hidden="true" className="size-3" />
                Retry verification
              </button>
            </div>
          )}
        </div>
      ) : (
        <p role="status" className="text-sm leading-6 text-muted-foreground">
          This form is temporarily unavailable. Please{" "}
          <a
            href="mailto:zasturman@gmail.com"
            className="underline underline-offset-4"
          >
            email me directly
          </a>
          {newsletter ? " to request writing updates" : ""}.
        </p>
      )}
      <Button
        type="submit"
        disabled={busy || !SITE_KEY || !token}
        data-testid={
          newsletter ? "newsletter-form-submit" : "contact-form-submit"
        }
        data-analytics-skip="true"
        className="h-12 w-full rounded-lg bg-[#244468] px-5 text-base text-white hover:bg-[#193550] sm:w-auto dark:bg-[#8fc6ff] dark:text-[#14293d] dark:hover:bg-[#b6dbff]"
      >
        {busy ? (
          <>
            <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
            Sending…
          </>
        ) : (
          <>
            {newsletter ? "Get notified" : "Send message"}
            <ArrowRight aria-hidden="true" className="size-4" />
          </>
        )}
      </Button>
      {state.kind === "error" && (
        <div
          ref={feedback}
          tabIndex={-1}
          role="alert"
          className="rounded-lg border border-destructive/25 bg-destructive/5 p-4 text-sm leading-6 outline-none"
        >
          <p>{state.message}</p>
          <a
            href="mailto:zasturman@gmail.com"
            className="underline underline-offset-4"
          >
            Email Zachary directly
          </a>
        </div>
      )}
    </form>
  );
}
