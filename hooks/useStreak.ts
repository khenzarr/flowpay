"use client";

import { useState, useEffect, useCallback } from "react";
import { getUTCDayString, todayUTC, yesterdayUTC, msUntilUTCMidnight } from "@/lib/time";

// ── Constants ─────────────────────────────────────────────────────────────────

export const POINTS_PER_GM = 10;
export const BONUS_POINTS = 50;
export const MILESTONES = [7, 14, 30, 60, 90, 180];
const CHAIN_ID = 5042002; // Arc Testnet

// ── Data model ────────────────────────────────────────────────────────────────

export interface StreakData {
  wallet: string;        // lowercase address this data belongs to
  currentStreak: number;
  lastGMDayUTC: string;  // "YYYY-MM-DD" or "" if never
  lastGMTime: number;    // unix ms timestamp of last GM, 0 if never
  totalPoints: number;
  totalGMs: number;
}

// ── Derived view (computed, never stored) ─────────────────────────────────────

export interface StreakView extends StreakData {
  canGMToday: boolean;       // false if already GM'd today (UTC)
  nextStreakCount: number;    // what streak will be after next GM
  pointsForNext: number;     // points next GM will award
  isBonus: boolean;          // true if next GM hits a 7-day multiple
  milestoneNext: number | null; // milestone that will be reached on next GM
  nextResetMs: number;       // ms until 00:00 UTC
}

// ── Storage ───────────────────────────────────────────────────────────────────

function storageKey(wallet: string): string {
  // Per-wallet, per-chain key — different wallets never share state
  return `gm_streak_${CHAIN_ID}_${wallet.toLowerCase()}`;
}

function loadStreak(wallet: string): StreakData {
  const empty: StreakData = {
    wallet: wallet.toLowerCase(),
    currentStreak: 0,
    lastGMDayUTC: "",
    lastGMTime: 0,
    totalPoints: 0,
    totalGMs: 0,
  };
  if (typeof window === "undefined" || !wallet) return empty;
  try {
    const raw = localStorage.getItem(storageKey(wallet));
    if (!raw) return empty;
    const parsed = JSON.parse(raw) as StreakData;
    // Validate wallet matches (safety check)
    if (parsed.wallet?.toLowerCase() !== wallet.toLowerCase()) return empty;
    return parsed;
  } catch {
    return empty;
  }
}

function saveStreak(data: StreakData): void {
  if (typeof window === "undefined" || !data.wallet) return;
  try {
    localStorage.setItem(storageKey(data.wallet), JSON.stringify(data));
  } catch {}
}

// ── Streak logic ──────────────────────────────────────────────────────────────

function computeView(data: StreakData): StreakView {
  const today = todayUTC();
  const yesterday = yesterdayUTC();

  const canGMToday = data.lastGMDayUTC !== today;

  // What streak count will be after the next GM
  let nextStreakCount: number;
  if (!canGMToday) {
    nextStreakCount = data.currentStreak; // already done today
  } else if (data.lastGMDayUTC === yesterday) {
    nextStreakCount = data.currentStreak + 1; // continuing streak
  } else {
    nextStreakCount = 1; // first GM ever, or streak broken
  }

  const isBonus = canGMToday && nextStreakCount % 7 === 0;
  const pointsForNext = canGMToday
    ? POINTS_PER_GM + (isBonus ? BONUS_POINTS : 0)
    : 0;

  const milestoneNext =
    canGMToday && MILESTONES.includes(nextStreakCount) ? nextStreakCount : null;

  return {
    ...data,
    canGMToday,
    nextStreakCount,
    pointsForNext,
    isBonus,
    milestoneNext,
    nextResetMs: msUntilUTCMidnight(),
  };
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useStreak(wallet: string | undefined) {
  const [data, setData] = useState<StreakData | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Load streak for this wallet (or clear if disconnected)
  useEffect(() => {
    if (!wallet) {
      setData(null);
      setHydrated(true);
      return;
    }
    const loaded = loadStreak(wallet);
    setData(loaded);
    setHydrated(true);
  }, [wallet]); // re-runs on wallet change — loads fresh data for new wallet

  /**
   * Call after a confirmed on-chain GM tx.
   * Updates streak based on UTC day — not timestamp.
   */
  const recordGM = useCallback(
    (gmTimestamp: number = Date.now()) => {
      if (!wallet) return;

      setData((prev) => {
        const base = prev ?? loadStreak(wallet);
        const today = todayUTC();
        const yesterday = yesterdayUTC();

        // Idempotent — don't double-count if called twice
        if (base.lastGMDayUTC === today) return base;

        const continuing = base.lastGMDayUTC === yesterday;
        const newStreak = continuing ? base.currentStreak + 1 : 1;
        const bonus = newStreak % 7 === 0 ? BONUS_POINTS : 0;

        const next: StreakData = {
          wallet: wallet.toLowerCase(),
          currentStreak: newStreak,
          lastGMDayUTC: today,
          lastGMTime: gmTimestamp,
          totalPoints: base.totalPoints + POINTS_PER_GM + bonus,
          totalGMs: base.totalGMs + 1,
        };

        saveStreak(next);
        return next;
      });
    },
    [wallet]
  );

  const view: StreakView | null = data ? computeView(data) : null;

  return { view, recordGM, hydrated };
}
