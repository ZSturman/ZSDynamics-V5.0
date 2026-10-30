/** Unknown is distinct from zero; estimates require an explicit source flag. */
export function describeWorkLogDuration(log) {
  if (Number.isFinite(log.durationMinutes) && log.durationMinutes > 0) {
    return { minutes: log.durationMinutes, source: log.durationEstimated ? "Estimated" : "Recorded" };
  }
  const start = Date.parse(log.startTime || log.sessionStart || log.date || "");
  const end = Date.parse(log.endTime || log.sessionEnd || "");
  if (Number.isFinite(start) && Number.isFinite(end) && end > start) {
    return { minutes: Math.max(1, Math.round((end - start) / 60000)), source: "Calculated" };
  }
  return { minutes: null, source: "Unavailable" };
}
