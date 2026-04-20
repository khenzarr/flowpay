// ── UTC time utilities ────────────────────────────────────────────────────────
// All streak logic uses UTC days, never local time.

/** Returns "YYYY-MM-DD" for a given timestamp (or now) in UTC */
export function getUTCDayString(ts: number = Date.now()): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Returns today's UTC day string */
export function todayUTC(): string {
  return getUTCDayString(Date.now());
}

/** Returns yesterday's UTC day string */
export function yesterdayUTC(): string {
  return getUTCDayString(Date.now() - 86_400_000);
}

/** ms until next 00:00 UTC */
export function msUntilUTCMidnight(): number {
  const now = Date.now();
  const d = new Date(now);
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
  return midnight - now;
}

/** Seconds until next 00:00 UTC */
export function secondsUntilUTCMidnight(): number {
  return Math.floor(msUntilUTCMidnight() / 1000);
}

/** Format seconds as "Xh MMm SSs" */
export function formatCountdown(totalSeconds: number): string {
  const s = Math.max(0, totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${String(m).padStart(2, "0")}m ${String(sec).padStart(2, "0")}s`;
}
