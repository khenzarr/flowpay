"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAccount, useChainId } from "wagmi";
import { useGMStreak, MILESTONES, BONUS_POINTS } from "@/hooks/useGMStreak";
import { sendGMTransaction, ARC_CHAIN_ID, GMContractNotDeployedError, GMCooldownError } from "@/lib/gmTx";
import { switchChain } from "@/lib/txEngine";
import { deployGMContract } from "@/lib/deployGM";
import { hasGMContract } from "@/lib/getGMContract";

// ── Milestone config ──────────────────────────────────────────────────────────
const MILESTONE_LABELS: Record<number, { emoji: string; label: string }> = {
  7:   { emoji: "🔥", label: "Week Warrior" },
  14:  { emoji: "⚡", label: "Two Weeks Strong" },
  30:  { emoji: "💎", label: "Month Legend" },
  60:  { emoji: "🏆", label: "60-Day Chad" },
  90:  { emoji: "🌟", label: "90-Day OG" },
  180: { emoji: "👑", label: "Half-Year King" },
};

// ── Countdown ─────────────────────────────────────────────────────────────────
function useCountdown(ms: number): string {
  const [remaining, setRemaining] = useState(ms);
  useEffect(() => {
    setRemaining(ms);
    const id = setInterval(() => setRemaining((r) => Math.max(0, r - 1000)), 1000);
    return () => clearInterval(id);
  }, [ms]);
  const h = Math.floor(remaining / 3_600_000);
  const m = Math.floor((remaining % 3_600_000) / 60_000);
  const s = Math.floor((remaining % 60_000) / 1000);
  return `${h}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`;
}

function StreakFlame({ count }: { count: number }) {
  if (count === 0) return <span className="text-2xl">☀️</span>;
  if (count < 7)   return <span className="text-2xl">🔥</span>;
  if (count < 30)  return <span className="text-2xl">⚡</span>;
  return <span className="text-2xl">👑</span>;
}

// ── Portal modal ──────────────────────────────────────────────────────────────
// Renders into document.body — escapes ALL stacking contexts

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
}

function ModalPortal({ onClose, children }: ModalProps) {
  // Lock body scroll while open
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  // ESC key to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    // z-[9999] ensures it's above everything, including backdrop-blur parents
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      // Backdrop click closes modal
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop — separate layer so click target is unambiguous */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Modal panel — stopPropagation prevents backdrop click leaking through */}
      <div
        className="relative z-10 w-full max-w-sm"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function GMStreak() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { data, recordCheckIn, hydrated } = useGMStreak();
  const countdown = useCountdown(data.nextResetMs);

  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [deployResult, setDeployResult] = useState<{ address: string; url: string } | null>(null);
  const [txResult, setTxResult] = useState<{ hash: string; url: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [justEarned, setJustEarned] = useState<{ points: number; bonus: boolean } | null>(null);
  const [contractReady, setContractReady] = useState(false);

  // Check contract status on open
  useEffect(() => {
    if (open) setContractReady(hasGMContract());
  }, [open]);

  const onArc = walletChainId === ARC_CHAIN_ID;

  const handleClose = useCallback(() => {
    setOpen(false);
  }, []);

  const handleOpen = useCallback(() => {
    setTxResult(null);
    setError(null);
    setJustEarned(null);
    setDeployResult(null);
    setContractReady(hasGMContract());
    setOpen(true);
  }, []);

  async function handleGM() {
    if (!isConnected || !address || data.checkedInToday || sending) return;
    setSending(true);
    setError(null);
    setTxResult(null);
    setJustEarned(null);

    try {
      const result = await sendGMTransaction(address);
      const earnedPoints = data.pointsForNext;
      const wasBonus = data.isBonus;
      recordCheckIn(Date.now());
      setTxResult({ hash: result.txHash, url: result.explorerUrl });
      setJustEarned({ points: earnedPoints, bonus: wasBonus });
    } catch (e: any) {
      if (e?.code === "CONTRACT_NOT_DEPLOYED") {
        setContractReady(false);
      } else if (e?.code === "COOLDOWN_ACTIVE") {
        // Contract says cooldown is active — sync localStorage to match
        // so the UI shows "already checked in" state
        recordCheckIn(Date.now() - 1000); // mark as done without adding points
        setError(e.message);
      } else {
        setError(e?.message ?? "Transaction failed");
      }
    } finally {
      setSending(false);
    }
  }

  async function handleDeploy() {
    if (!isConnected || !onArc || deploying) return;
    setDeploying(true);
    setError(null);

    try {
      const result = await deployGMContract();
      setDeployResult({ address: result.address, url: result.explorerUrl });
      setContractReady(true);
      console.log("[GMStreak] GM contract deployed:", result.address);
    } catch (e: any) {
      setError(e?.message ?? "Deployment failed");
    } finally {
      setDeploying(false);
    }
  }

  // Don't render until localStorage is hydrated (avoids SSR mismatch)
  if (!hydrated) return null;

  // Current earned milestone
  const milestone = MILESTONES.filter((m) => m <= data.streakCount).pop() ?? null;
  const milestoneBadge = milestone ? MILESTONE_LABELS[milestone] : null;

  return (
    <>
      {/* ── Trigger button — stays in normal document flow ── */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full px-3 py-1.5 transition-all group"
        title="GM Streak"
      >
        <span className="text-base leading-none">
          {data.streakCount > 0 ? "🔥" : "☀️"}
        </span>
        <span className="text-xs font-semibold text-white/60 group-hover:text-white/80 transition-colors">
          {data.streakCount > 0 ? `${data.streakCount}d` : "GM"}
        </span>
        {data.checkedInToday && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
        )}
      </button>

      {/* ── Modal — rendered via portal directly into document.body ── */}
      {open && (
        <ModalPortal onClose={handleClose}>
          <div className="bg-[#0e0e1a] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <StreakFlame count={data.streakCount} />
                <div>
                  <p className="text-sm font-bold text-white">GM Streak</p>
                  <p className="text-[10px] text-white/35">Daily check-in on Arc Testnet</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="text-white/30 hover:text-white/70 transition-colors w-7 h-7 flex items-center justify-center rounded-lg hover:bg-white/5"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 px-5 pb-4">
              {[
                { value: data.streakCount, label: "Day Streak", color: "text-white" },
                { value: data.totalPoints, label: "Total Points", color: "text-amber-400" },
                {
                  value: data.checkedInToday ? "✓" : `+${data.pointsForNext}`,
                  label: data.checkedInToday ? "Today" : "Next GM",
                  color: data.checkedInToday ? "text-emerald-400" : "text-white/60",
                },
              ].map(({ value, label, color }) => (
                <div key={label} className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3 text-center">
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                  <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
                </div>
              ))}
            </div>

            {/* Milestone badge */}
            {milestoneBadge && (
              <div className="mx-5 mb-3 rounded-xl bg-violet-500/10 border border-violet-500/20 px-3 py-2 flex items-center gap-2">
                <span className="text-lg">{milestoneBadge.emoji}</span>
                <div>
                  <p className="text-xs font-semibold text-violet-300">{milestoneBadge.label}</p>
                  <p className="text-[10px] text-white/30">{milestone}-day milestone</p>
                </div>
              </div>
            )}

            {/* Bonus preview */}
            {!data.checkedInToday && data.isBonus && (
              <div className="mx-5 mb-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-center gap-2">
                <span className="text-lg">🎁</span>
                <p className="text-xs text-amber-300 font-medium">
                  7-day bonus! +{BONUS_POINTS} extra points on this GM
                </p>
              </div>
            )}

            {/* Last check-in + countdown */}
            {data.lastCheckIn && (
              <div className="mx-5 mb-3 flex items-center justify-between text-[11px] text-white/30">
                <span>
                  Last GM:{" "}
                  {new Date(data.lastCheckIn).toLocaleString("en-US", {
                    month: "short", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                    timeZone: "UTC", timeZoneName: "short",
                  })}
                </span>
                {data.checkedInToday && (
                  <span className="text-white/20 tabular-nums">Resets in {countdown}</span>
                )}
              </div>
            )}

            <div className="border-t border-white/[0.06] mx-5" />

            {/* Actions */}
            <div className="p-5 space-y-3">

              {/* Not connected */}
              {!isConnected && (
                <p className="text-center text-sm text-white/40 py-2">
                  Connect wallet to send GM
                </p>
              )}

              {/* Wrong network */}
              {isConnected && !onArc && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 px-4 py-3 flex items-center justify-between">
                  <p className="text-xs text-amber-300">Switch to Arc Testnet to send GM</p>
                  <button
                    onClick={() => switchChain(ARC_CHAIN_ID)}
                    className="text-xs text-amber-200 underline ml-2 hover:text-amber-100"
                  >
                    Switch
                  </button>
                </div>
              )}

              {/* Contract not deployed — deploy prompt */}
              {isConnected && onArc && !contractReady && !deployResult && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">🚀</span>
                    <div>
                      <p className="text-sm font-semibold text-white">Deploy GM contract</p>
                      <p className="text-[11px] text-white/40 mt-0.5">
                        One-time setup. Deploys the GM contract on Arc Testnet so you can send daily GMs on-chain.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleDeploy}
                    disabled={deploying}
                    className="w-full bg-violet-600 hover:bg-violet-500 disabled:bg-white/10 disabled:cursor-not-allowed text-white font-semibold py-2.5 rounded-xl transition-all text-sm"
                  >
                    {deploying ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Deploying on Arc…
                      </span>
                    ) : (
                      "Deploy GM Contract"
                    )}
                  </button>
                </div>
              )}

              {/* Deploy success */}
              {deployResult && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 space-y-1.5">
                  <p className="text-xs font-semibold text-emerald-400">✓ Contract deployed</p>
                  <a
                    href={deployResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[11px] font-mono text-violet-400 hover:text-violet-300 underline truncate"
                  >
                    {deployResult.address}
                  </a>
                  <p className="text-[10px] text-white/30">You can now send GM every day.</p>
                </div>
              )}

              {/* Already checked in today */}
              {isConnected && onArc && contractReady && data.checkedInToday && !txResult && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-center space-y-1">
                  <p className="text-sm font-semibold text-emerald-400">✓ GM sent today</p>
                  <p className="text-[11px] text-white/30">
                    Come back after 00:00 UTC · Resets in {countdown}
                  </p>
                </div>
              )}

              {/* Send GM button */}
              {isConnected && onArc && contractReady && !data.checkedInToday && (
                <button
                  onClick={handleGM}
                  disabled={sending}
                  className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 disabled:from-white/10 disabled:to-white/10 disabled:cursor-not-allowed text-white font-bold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-amber-900/30 active:scale-[0.99]"
                >
                  {sending ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Sending GM on Arc…
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <span>☀️</span>
                      Send GM · +{data.pointsForNext} pts
                      {data.isBonus && (
                        <span className="text-xs bg-white/20 rounded-full px-1.5 py-0.5">BONUS</span>
                      )}
                    </span>
                  )}
                </button>
              )}

              {/* Success */}
              {txResult && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-emerald-400">
                      GM sent on Arc!
                      {justEarned && (
                        <span className="ml-2 text-amber-400">
                          +{justEarned.points} pts{justEarned.bonus ? " 🎁" : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <a
                    href={txResult.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block text-[11px] font-mono text-violet-400 hover:text-violet-300 underline truncate"
                  >
                    {txResult.hash}
                  </a>
                  {data.milestoneReached && MILESTONE_LABELS[data.milestoneReached] && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-base">{MILESTONE_LABELS[data.milestoneReached].emoji}</span>
                      <p className="text-xs font-semibold text-violet-300">
                        {MILESTONE_LABELS[data.milestoneReached].label} unlocked!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Error */}
              {error && (
                <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 flex items-start gap-2">
                  <span className="text-red-400 mt-0.5 flex-shrink-0">⚠</span>
                  <p className="text-xs text-red-400 break-words">{error}</p>
                </div>
              )}

              {/* Milestones */}
              <div className="pt-1">
                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">Milestones</p>
                <div className="flex gap-1.5 flex-wrap">
                  {[7, 14, 30, 60, 90, 180].map((m) => {
                    const reached = data.streakCount >= m;
                    const badge = MILESTONE_LABELS[m];
                    return (
                      <div
                        key={m}
                        title={badge.label}
                        className={`flex items-center gap-1 rounded-full px-2 py-0.5 border text-[10px] font-medium transition-all ${
                          reached
                            ? "bg-violet-500/15 border-violet-500/30 text-violet-300"
                            : "bg-white/[0.03] border-white/[0.07] text-white/25"
                        }`}
                      >
                        <span>{reached ? badge.emoji : "○"}</span>
                        <span>{m}d</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
