/**
 * Foreground vs. active time for one page instance.
 *
 *  - Foreground time: the document was visible (page visibility API). A
 *    background tab never accrues time.
 *  - Active time: foreground time that falls within ACTIVE_AFTER_INPUT_MS of an
 *    input (scroll, wheel, pointer, key, touch) or within ACTIVE_AFTER_SHOW_MS
 *    of the page becoming visible. A tab left open without input stops being
 *    "active" quickly even though it stays in the foreground.
 *
 * Neither measure proves reading; reports call them "observed foreground" and
 * "active" time. Input counts are tallies of coarse activity windows, never
 * coordinates, key values or targets.
 */

export const ACTIVE_AFTER_SHOW_MS = 10_000;
export const ACTIVE_AFTER_INPUT_MS = 30_000;
const POINTER_WINDOW_MS = 1_000;
const SCROLL_WINDOW_MS = 500;

export class PageActivityClock {
  constructor(now = 0, visible = true) {
    this.lastAt = now;
    this.visible = Boolean(visible);
    this.activeUntil = this.visible ? now + ACTIVE_AFTER_SHOW_MS : 0;
    this.foregroundMs = 0;
    this.activeMs = 0;
    this.hiddenCount = 0;
    this.counts = { pointer: 0, keys: 0, scrolls: 0, touches: 0 };
    this.lastPointerWindow = -1;
    this.lastScrollWindow = -1;
    this.firstInputAt = null;
    this.startedAt = now;
  }

  advance(now) {
    const from = this.lastAt;
    if (now <= from) return this;
    if (this.visible) {
      this.foregroundMs += now - from;
      this.activeMs += Math.max(0, Math.min(now, this.activeUntil) - from);
    }
    this.lastAt = now;
    return this;
  }

  setVisible(now, visible) {
    this.advance(now);
    const next = Boolean(visible);
    if (next === this.visible) return this;
    this.visible = next;
    if (next) this.activeUntil = Math.max(this.activeUntil, now + ACTIVE_AFTER_SHOW_MS);
    else { this.activeUntil = 0; this.hiddenCount += 1; }
    return this;
  }

  /** kind: "pointer" | "key" | "scroll" | "touch" */
  input(now, kind) {
    this.advance(now);
    if (!this.visible) return this;
    if (kind === "pointer") {
      const window = Math.floor(now / POINTER_WINDOW_MS);
      if (window === this.lastPointerWindow) return this.extend(now);
      this.lastPointerWindow = window;
      this.counts.pointer += 1;
    } else if (kind === "scroll") {
      const window = Math.floor(now / SCROLL_WINDOW_MS);
      if (window === this.lastScrollWindow) return this.extend(now);
      this.lastScrollWindow = window;
      this.counts.scrolls += 1;
    } else if (kind === "key") this.counts.keys += 1;
    else if (kind === "touch") this.counts.touches += 1;
    else return this;
    if (this.firstInputAt === null) this.firstInputAt = now;
    return this.extend(now);
  }

  extend(now) {
    this.activeUntil = Math.max(this.activeUntil, now + ACTIVE_AFTER_INPUT_MS);
    return this;
  }

  snapshot(now) {
    this.advance(now);
    return {
      fg_ms: Math.round(this.foregroundMs),
      active_ms: Math.round(this.activeMs),
      pointer: this.counts.pointer,
      keys: this.counts.keys,
      scrolls: this.counts.scrolls,
      touches: this.counts.touches,
      hidden_count: this.hiddenCount,
    };
  }
}

/** Session id lifecycle: rotate after inactivity; never persist a visitor id. */
export const SESSION_INACTIVITY_MS = 30 * 60 * 1000;

export function nextSessionState(stored, now, createId, inactivityMs = SESSION_INACTIVITY_MS) {
  const valid = stored && typeof stored.id === "string" && /^[a-z0-9-]{16,40}$/i.test(stored.id) &&
    Number.isFinite(stored.lastAt) && now - stored.lastAt < inactivityMs && now >= stored.lastAt - 60_000;
  if (valid) return { id: stored.id, startedAt: stored.startedAt, lastAt: now, isNew: false };
  return { id: createId(), startedAt: now, lastAt: now, isNew: true };
}
