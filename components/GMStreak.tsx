"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useAccount, useChainId } from "wagmi";
import { useStreak, MILESTONES, BONUS_POINTS, StreakView } from "@/hooks/useStreak";
import { formatCountdown, msUntilUTCMidnight } from "@/lib/time";
import {
  sendGMTransaction,
  claimGMNFT,
  getNFTClaimState,
  NFTClaimState,
  ARC_CHAIN_ID,
  GMContractNotDeployedError,
  GMAlreadyTodayError,
} from "@/lib/gmTx";
import { switchToChain } from "@/lib/network";
import { deployGMEngine } from "@/lib/deployGMEngine";
import { hasGMContract, hasBothContracts } from "@/lib/getGMContract";

// ── Milestone config ──────────────────────────────────────────────────────────

const MILESTONE_LABELS: Record<number, { emoji: string; label: string }> = {
  7:   { emoji: "🔥", label: "Week Warrior" },
  14:  { emoji: "⚡", label: "Two Weeks Strong" },
  30:  { emoji: "💎", label: "Month Legend" },
  60:  { emoji: "🏆", label: "60-Day Chad" },
  90:  { emoji: "🌟", label: "90-Day OG" },
  180: { emoji: "👑", label: "Half-Year King" },
};

// ── Countdown hook ────────────────────────────────────────────────────────────

function useCountdown(): string {
  const [secs, setSecs] = useState(() =>
    Math.floor(msUntilUTCMidnight() / 1000)
  );
  useEffect(() => {
    const id = setInterval(
      () => setSecs(Math.floor(msUntilUTCMidnight() / 1000)),
      1000
    );
    return () => clearInterval(id);
  }, []);
  return formatCountdown(secs);
}

// ── Portal ────────────────────────────────────────────────────────────────────

function ModalPortal({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
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

// ── Streak flame icon ─────────────────────────────────────────────────────────

function StreakIcon({ streak }: { streak: number }) {
  if (streak === 0) return <>☀️</>;
  if (streak < 7)   return <>🔥</>;
  if (streak < 30)  return <>⚡</>;
  return <>👑</>;
}

// ── Main component ────────────────────────────────────────────────────────────

export function GMStreak() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();

  // Wallet-scoped streak — passes address so different wallets get different data
  const { view, recordGM, hydrated } = useStreak(
    isConnected ? address : undefined
  );

  const countdown = useCountdown();
  const onArc = walletChainId === ARC_CHAIN_ID;

  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [deploying, setDeploying] = useState(false);
  const [contractReady, setContractReady] = useState(false);
  const [deployResult, setDeployResult] = useState<{ gmCore: string; gmNft: string } | null>(null);
  const [txResult, setTxResult] = useState<{ hash: string; url: string; streak?: number } | null>(null);
  const [justEarned, setJustEarned] = useState<{ points: number; bonus: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [nftState, setNftState] = useState<NFTClaimState | null>(null);
  const [claiming, setClaiming] = useState<number | null>(null); // milestone being claimed
  const [claimResult, setClaimResult] = useState<{ milestone: number; tokenId?: number; url: string } | null>(null);

  const handleOpen = useCallback(() => {
    setTxResult(null);
    setError(null);
    setJustEarned(null);
    setDeployResult(null);
    setClaimResult(null);
    setContractReady(hasGMContract());
    setOpen(true);
    // Load NFT claim state in background
    if (address && isConnected) {
      getNFTClaimState(address).then(setNftState).catch(() => {});
    }
  }, [address, isConnected]);

  const handleClose = useCallback(() => setOpen(false), []);

  // ── Send GM ─────────────────────────────────────────────────────────────────

  async function handleGM() {
    if (!isConnected || !address || !view?.canGMToday || sending) return;
    setSending(true);
    setError(null);
    setTxResult(null);
    setJustEarned(null);

    try {
      const pointsBefore = view.pointsForNext;
      const bonusBefore = view.isBonus;

      const result = await sendGMTransaction(address);
      recordGM(Date.now());
      setTxResult({ hash: result.txHash, url: result.explorerUrl, streak: result.streak });
      setJustEarned({ points: pointsBefore, bonus: bonusBefore });
      // Refresh NFT claim state after GM
      getNFTClaimState(address).then(setNftState).catch(() => {});
    } catch (e: any) {
      if (e?.code === "CONTRACT_NOT_DEPLOYED") {
        setContractReady(false);
      } else if (e?.code === "ALREADY_GM_TODAY") {
        recordGM(Date.now());
        setError(e.message);
      } else {
        setError(e?.message ?? "Transaction failed");
      }
    } finally {
      setSending(false);
    }
  }

  // ── Deploy contract ──────────────────────────────────────────────────────────

  async function handleDeploy() {
    if (!isConnected || !onArc || deploying) return;
    setDeploying(true);
    setError(null);
    try {
      const result = await deployGMEngine();
      setDeployResult({ gmCore: result.gmCore.address, gmNft: result.gmNft.address });
      setContractReady(true);
    } catch (e: any) {
      setError(e?.message ?? "Deployment failed");
    } finally {
      setDeploying(false);
    }
  }

  async function handleClaim(milestone: 7 | 30 | 90) {
    if (!isConnected || !onArc || claiming) return;
    setClaiming(milestone);
    setError(null);
    setClaimResult(null);
    try {
      const result = await claimGMNFT(milestone);
      setClaimResult({ milestone, tokenId: result.tokenId, url: result.explorerUrl });
      if (address) getNFTClaimState(address).then(setNftState).catch(() => {});
    } catch (e: any) {
      setError(e?.message ?? "Claim failed");
    } finally {
      setClaiming(null);
    }
  }

  // Don't render until hydrated (avoids SSR mismatch)
  if (!hydrated) return null;

  // Streak display values — null-safe for disconnected state
  const streak = view?.currentStreak ?? 0;
  const totalPoints = view?.totalPoints ?? 0;
  const canGM = view?.canGMToday ?? false;
  const pointsForNext = view?.pointsForNext ?? BONUS_POINTS;
  const isBonus = view?.isBonus ?? false;
  const lastGMTime = view?.lastGMTime ?? 0;
  const milestoneNext = view?.milestoneNext ?? null;

  // Highest milestone reached
  const milestoneReached =
    MILESTONES.filter((m) => m <= streak).pop() ?? null;
  const milestoneBadge = milestoneReached
    ? MILESTONE_LABELS[milestoneReached]
    : null;

  return (
    <>
      {/* ── Trigger button ── */}
      <button
        onClick={handleOpen}
        className="flex items-center gap-1.5 bg-white/[0.05] hover:bg-white/[0.09] border border-white/[0.08] rounded-full px-3 py-1.5 transition-all group"
        title="GM Streak"
      >
        <span className="text-base leading-none">
          <StreakIcon streak={streak} />
        </span>
        <span className="text-xs font-semibold text-white/60 group-hover:text-white/80 transition-colors">
          {isConnected && streak > 0 ? `${streak}d` : "GM"}
        </span>
        {/* Green dot = already GM'd today */}
        {isConnected && !canGM && (
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
        )}
      </button>

      {/* ── Modal ── */}
      {open && (
        <ModalPortal onClose={handleClose}>
          <div className="bg-[#0e0e1a] border border-white/[0.1] rounded-2xl shadow-2xl shadow-black/80 overflow-hidden">

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-5 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl"><StreakIcon streak={streak} /></span>
                <div>
                  <p className="text-sm font-bold text-white">GM Streak</p>
                  <p className="text-[10px] text-white/35">
                    {isConnected
                      ? `${address?.slice(0, 6)}…${address?.slice(-4)} · Arc Testnet`
                      : "Connect wallet to start"}
                  </p>
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

            {/* Stats — only shown when connected */}
            {isConnected && (
              <div className="grid grid-cols-3 gap-2 px-5 pb-4">
                {[
                  { value: streak, label: "Day Streak", color: "text-white" },
                  { value: totalPoints, label: "Total Points", color: "text-amber-400" },
                  {
                    value: !canGM ? "✓" : `+${pointsForNext}`,
                    label: !canGM ? "Today" : "Next GM",
                    color: !canGM ? "text-emerald-400" : "text-white/60",
                  },
                ].map(({ value, label, color }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-white/[0.04] border border-white/[0.07] p-3 text-center"
                  >
                    <p className={`text-xl font-bold ${color}`}>{value}</p>
                    <p className="text-[10px] text-white/35 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Milestone badge */}
            {milestoneBadge && (
              <div className="mx-5 mb-3 rounded-xl bg-violet-500/10 border border-violet-500/20 px-3 py-2 flex items-center gap-2">
                <span className="text-lg">{milestoneBadge.emoji}</span>
                <div>
                  <p className="text-xs font-semibold text-violet-300">
                    {milestoneBadge.label}
                  </p>
                  <p className="text-[10px] text-white/30">
                    {milestoneReached}-day milestone
                  </p>
                </div>
              </div>
            )}

            {/* Bonus preview */}
            {isConnected && canGM && isBonus && (
              <div className="mx-5 mb-3 rounded-xl bg-amber-500/10 border border-amber-500/20 px-3 py-2 flex items-center gap-2">
                <span className="text-lg">🎁</span>
                <p className="text-xs text-amber-300 font-medium">
                  7-day bonus! +{BONUS_POINTS} extra points on this GM
                </p>
              </div>
            )}

            {/* Last GM + countdown */}
            {isConnected && lastGMTime > 0 && (
              <div className="mx-5 mb-3 flex items-center justify-between text-[11px] text-white/30">
                <span>
                  Last GM:{" "}
                  {new Date(lastGMTime).toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "UTC",
                    timeZoneName: "short",
                  })}
                </span>
                {!canGM && (
                  <span className="text-white/20 tabular-nums">
                    Resets in {countdown}
                  </span>
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
                  <p className="text-xs text-amber-300">
                    Switch to Arc Testnet to send GM
                  </p>
                  <button
                    onClick={() => switchToChain(ARC_CHAIN_ID)}
                    className="text-xs text-amber-200 underline ml-2 hover:text-amber-100"
                  >
                    Switch
                  </button>
                </div>
              )}

              {/* Contract not deployed */}
              {isConnected && onArc && !contractReady && !deployResult && (
                <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 px-4 py-4 space-y-3">
                  <div className="flex items-start gap-2">
                    <span className="text-lg flex-shrink-0">🚀</span>
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Deploy GM contract
                      </p>
                      <p className="text-[11px] text-white/40 mt-0.5">
                        One-time setup on Arc Testnet. Enables daily on-chain GMs.
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
                  <p className="text-xs font-semibold text-emerald-400">✓ Contracts deployed</p>
                  <p className="text-[10px] text-white/40">GMCore: <span className="font-mono text-white/60">{deployResult.gmCore.slice(0,10)}…</span></p>
                  <p className="text-[10px] text-white/40">GMNFT:  <span className="font-mono text-white/60">{deployResult.gmNft.slice(0,10)}…</span></p>
                  <p className="text-[10px] text-white/30">You can now send GM every day and claim milestone NFTs.</p>
                </div>
              )}

              {/* Already GM'd today */}
              {isConnected && onArc && contractReady && !canGM && !txResult && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-center space-y-1">
                  <p className="text-sm font-semibold text-emerald-400">
                    ✓ GM sent today
                  </p>
                  <p className="text-[11px] text-white/30">
                    Come back after 00:00 UTC · Resets in {countdown}
                  </p>
                </div>
              )}

              {/* Send GM button */}
              {isConnected && onArc && contractReady && canGM && (
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
                      Send GM · +{pointsForNext} pts
                      {isBonus && (
                        <span className="text-xs bg-white/20 rounded-full px-1.5 py-0.5">
                          BONUS
                        </span>
                      )}
                    </span>
                  )}
                </button>
              )}

              {/* TX success */}
              {txResult && (
                <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-3 h-3 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-emerald-400">
                      GM sent on Arc!
                      {justEarned && (
                        <span className="ml-2 text-amber-400">
                          +{justEarned.points} pts
                          {justEarned.bonus ? " 🎁" : ""}
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
                  {/* Milestone unlocked on this GM */}
                  {milestoneNext && MILESTONE_LABELS[milestoneNext] && (
                    <div className="flex items-center gap-2 pt-1">
                      <span className="text-base">
                        {MILESTONE_LABELS[milestoneNext].emoji}
                      </span>
                      <p className="text-xs font-semibold text-violet-300">
                        {MILESTONE_LABELS[milestoneNext].label} unlocked!
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

              {/* Milestones row */}
              <div className="pt-1">
                <p className="text-[10px] text-white/25 uppercase tracking-widest mb-2">
                  Milestones
                </p>
                <div className="flex gap-1.5 flex-wrap">
                  {MILESTONES.map((m) => {
                    const reached = streak >= m;
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

              {/* NFT Claim section */}
              {isConnected && onArc && contractReady && (
                <div className="pt-1 space-y-2">
                  <p className="text-[10px] text-white/25 uppercase tracking-widest">
                    Milestone NFTs
                  </p>
                  {([7, 30, 90] as const).map((m) => {
                    const nftLabels: Record<number, { emoji: string; name: string; color: string }> = {
                      7:  { emoji: "🥉", name: "Bronze GM Badge", color: "from-amber-700/30 to-amber-600/20 border-amber-700/30 text-amber-400" },
                      30: { emoji: "🥈", name: "Silver GM Badge", color: "from-slate-400/20 to-slate-300/10 border-slate-400/30 text-slate-300" },
                      90: { emoji: "🥇", name: "Gold GM Badge",   color: "from-yellow-500/20 to-yellow-400/10 border-yellow-500/30 text-yellow-300" },
                    };
                    const cfg = nftLabels[m];
                    const eligible = nftState ? (m === 7 ? nftState.eligible7 : m === 30 ? nftState.eligible30 : nftState.eligible90) : streak >= m;
                    const alreadyClaimed = nftState ? (m === 7 ? nftState.claimed7 : m === 30 ? nftState.claimed30 : nftState.claimed90) : false;
                    const isClaiming = claiming === m;

                    return (
                      <div
                        key={m}
                        className={`flex items-center justify-between rounded-xl bg-gradient-to-r border px-3 py-2.5 ${cfg.color}`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{cfg.emoji}</span>
                          <div>
                            <p className="text-xs font-semibold text-white/80">{cfg.name}</p>
                            <p className="text-[10px] text-white/35">{m}-day streak required</p>
                          </div>
                        </div>
                        {alreadyClaimed ? (
                          <span className="text-[10px] text-emerald-400 font-semibold">✓ Claimed</span>
                        ) : eligible ? (
                          <button
                            onClick={() => handleClaim(m)}
                            disabled={!!claiming}
                            className="text-xs font-semibold bg-white/10 hover:bg-white/20 disabled:opacity-50 px-3 py-1.5 rounded-lg transition-all"
                          >
                            {isClaiming ? (
                              <span className="flex items-center gap-1">
                                <span className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" />
                                Claiming…
                              </span>
                            ) : "Claim"}
                          </button>
                        ) : (
                          <span className="text-[10px] text-white/25">{m - streak}d left</span>
                        )}
                      </div>
                    );
                  })}

                  {/* Claim success */}
                  {claimResult && (
                    <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5 space-y-1">
                      <p className="text-xs font-semibold text-emerald-400">
                        🎉 NFT #{claimResult.tokenId} claimed!
                      </p>
                      <a
                        href={claimResult.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-violet-400 underline"
                      >
                        View on explorer ↗
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
