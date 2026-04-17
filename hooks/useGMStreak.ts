"use client";

import { useState, useEffect, useCallback } from "react";

// ── Storage key ───────────────────────────────────────────────────────────────
const STORAGE_KEY = "flowpay_gm_streak";

// ── Types ─────────────────────────────────────────────────────────────────────
export interface GMStreakState {
  lastCheckIn: number | null;  // UTC timestamp (ms)
  streakCount: number;
  totalPoints: number;
}

export interface GMStreakData extends GMStreakState {
  checkedInToday: boolean;
  nextResetMs: number;          // ms until 00:00 UTC tomorrow
  pointsForNext: number;        // points the next check-in will award
  isBonus: boolean;             // true if next check-in is a 7-day multiple
  milestoneReached: number | null; // milestone just crossed, or null
}

// ── Constants ─────────────────────────────────────────────────────────────────
export const POINTS_PER_GM = 10;
export const BONUS_POINTS = 50;
export const MILESTONES = [7, 14, 30, 60, 90, 180];

// ── UTC helpers ───────────────────────────────────────────────────────────────

/** Returns "YYYY-MM-DD" in UTC */
function utcDateString(ts: number): string {
  return new Date(ts).toISOString().slice(0, 10);
}

/** Returns true if ts was yesterday (UTC) relative to now */
function wasYesterday(ts: number, now: number): boolean {
  const d1 = utcDateString(ts);
  const d2 = utcDateString(now - 86_400_000); // subtract 1 day
  return d1 === d2;
}

/** Returns true if ts is today (UTC) */
function isToday(ts: number, now: number): boolean {
  return utcDateString(ts) === utcDateString(now);
}

/** ms until next 00:00 UTC */
function msUntilMidnightUTC(now: number): number {
  const date = new Date(now);
  const midnight = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1 // next day
  );
  return midnight - now;
}

// ── localStorage helpers ──────────────────────────────────────────────────────

function load(): GMStreakState {
  if (typeof window === "undefined")
    return { lastCheckIn: null, streakCount: 0, totalPoints: 0 };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { lastCheckIn: null, streakCount: 0, totalPoints: 0 };
    return JSON.parse(raw) as GMStreakState;
  } catch {
    return { lastCheckIn: null, streakCount: 0, totalPoints: 0 };
  }
}

function save(state: GMStreakState): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {}
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useGMStreak() {
  const [state, setState] = useState<GMStreakState>({
    lastCheckIn: null,
    streakCount: 0,
    totalPoints: 0,
  });
  const [hydrated, setHydrated] = useState(false);

  // Load from localStorage on mount (client only)
  useEffect(() => {
    setState(load());
    setHydrated(true);
  }, []);

  // Compute derived values
  const now = Date.now();
  const checkedInToday = state.lastCheckIn !== null && isToday(state.lastCheckIn, now);
  const nextStreakCount = checkedInToday
    ? state.streakCount
    : state.lastCheckIn !== null && wasYesterday(state.lastCheckIn, now)
    ? state.streakCount + 1
    : 1;

  const isBonus = !checkedInToday && nextStreakCount % 7 === 0;
  const pointsForNext = checkedInToday ? 0 : POINTS_PER_GM + (isBonus ? BONUS_POINTS : 0);
  const nextResetMs = msUntilMidnightUTC(now);

  const milestoneReached =
    !checkedInToday && MILESTONES.includes(nextStreakCount) ? nextStreakCount : null;

  /** Called after a successful onchain GM tx — updates streak state */
  const recordCheckIn = useCallback((timestamp: number = Date.now()) => {
    setState((prev) => {
      const isNew = prev.lastCheckIn === null || !isToday(prev.lastCheckIn, timestamp);
      if (!isNew) return prev; // already checked in today — no-op

      const wasYest =
        prev.lastCheckIn !== null && wasYesterday(prev.lastCheckIn, timestamp);
      const newStreak = wasYest ? prev.streakCount + 1 : 1;
      const bonus = newStreak % 7 === 0 ? BONUS_POINTS : 0;
      const newPoints = prev.totalPoints + POINTS_PER_GM + bonus;

      const next: GMStreakState = {
        lastCheckIn: timestamp,
        streakCount: newStreak,
        totalPoints: newPoints,
      };
      save(next);
      return next;
    });
  }, []);

  const data: GMStreakData = {
    ...state,
    checkedInToday,
    nextResetMs,
    pointsForNext,
    isBonus,
    milestoneReached,
  };

  return { data, recordCheckIn, hydrated };
}
