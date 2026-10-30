/** Visible area relative to the smaller of the element and viewport.
 * A long article can qualify without ever fitting wholly on screen.
 */
export function meaningfullyVisible(rect, width, height) {
  if (rect.width <= 0 || rect.height <= 0 || width <= 0 || height <= 0) return false;
  const visibleWidth = Math.max(0, Math.min(rect.right, width) - Math.max(rect.left, 0));
  const visibleHeight = Math.max(0, Math.min(rect.bottom, height) - Math.max(rect.top, 0));
  return visibleWidth * visibleHeight / (Math.min(rect.width, width) * Math.min(rect.height, height)) >= 0.35;
}

export class AttentionClock {
  accumulatedMs = 0;
  since = null;
  buckets = new Set();
  update(now, active) {
    if (this.since !== null) this.accumulatedMs += Math.max(0, now - this.since);
    this.since = active ? now : null;
    const reached = [];
    for (const seconds of [5, 15, 30, 60]) {
      if (this.accumulatedMs >= seconds * 1000 && !this.buckets.has(seconds)) {
        this.buckets.add(seconds);
        reached.push(seconds);
      }
    }
    return reached;
  }
}
