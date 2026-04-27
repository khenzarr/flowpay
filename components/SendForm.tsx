"use client";

import { useState, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { determineRoute, calculateFee, amountAfterFee } from "@/lib/flowRouter";
import { RouteDisplay } from "./RouteDisplay";
import { StatusPanel, TxStatus } from "./StatusPanel";
import { UsdcBalance } from "./UsdcBalance";
import { ArcNSResolutionStatus } from "./ArcNSResolutionStatus";
import {
  getUsdcAddress,
  executeSend,
  executeSourceTx,
  executeDestCredit,
  switchChain,
} from "@/lib/txEngine";
import {
  getChainById,
  CHAIN_LIST,
  DEFAULT_SOURCE_CHAIN_ID,
  DEFAULT_DEST_CHAIN_ID,
  ARC_CHAIN_ID,
} from "@/lib/chains";
import { isNativeUsdc } from "@/lib/contracts";
import { useArcNSResolution } from "@/hooks/useArcNSResolution";
import { isArcNSName } from "@/lib/arcnsResolver";

const FEE_RECIPIENT = process.env.NEXT_PUBLIC_FEE_RECIPIENT ?? "";

// Cross-chain state persisted between Step 1 and Step 2
interface PendingCrossChain {
  sourceTxHash: string;
  sourceExplorerUrl: string;
  destChainId: number;
  recipient: string;
  amount: string; // net amount (after fee)
}

export function SendForm() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId(); // read-only — never auto-changed

  // ── User-controlled state (never auto-overridden) ──────────────────────────
  const [sourceChainId, setSourceChainId] = useState(DEFAULT_SOURCE_CHAIN_ID);
  const [destChainId, setDestChainId] = useState(DEFAULT_DEST_CHAIN_ID);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TxStatus>({ type: "idle" });

  // Cross-chain 2-step state
  const [pendingXChain, setPendingXChain] = useState<PendingCrossChain | null>(null);

  // ── Chain selectors — user-controlled only ─────────────────────────────────
  const handleSourceChange = useCallback(
    (id: number) => {
      setSourceChainId(id);
      // Only force a dest swap if dest === source AND it's not Arc → Arc
      if (id === destChainId && id !== ARC_CHAIN_ID) {
        const fallback = CHAIN_LIST.find((c) => c.id !== id);
        if (fallback) setDestChainId(fallback.id);
      }
      setStatus({ type: "idle" });
      setPendingXChain(null);
    },
    [destChainId]
  );

  const handleDestChange = useCallback(
    (id: number) => {
      setDestChainId(id);
      // Only force a source swap if source === dest AND it's not Arc → Arc
      if (id === sourceChainId && id !== ARC_CHAIN_ID) {
        const fallback = CHAIN_LIST.find((c) => c.id !== id);
        if (fallback) setSourceChainId(fallback.id);
      }
      setStatus({ type: "idle" });
      setPendingXChain(null);
    },
    [sourceChainId]
  );

  const handleSwapChains = useCallback(() => {
    setSourceChainId(destChainId);
    setDestChainId(sourceChainId);
    setStatus({ type: "idle" });
    setPendingXChain(null);
  }, [sourceChainId, destChainId]);

  // ── Derived values ─────────────────────────────────────────────────────────
  const sourceChain = getChainById(sourceChainId);
  const destChain = getChainById(destChainId);
  const route = determineRoute(sourceChainId, destChainId);
  const fee = calculateFee(amount);
  const receiveAmount = amountAfterFee(amount);

  // ── ArcNS resolution ───────────────────────────────────────────────────────
  const { state: arcnsState, resolvedAddress } = useArcNSResolution(recipient, destChainId);

  // If the user typed an ArcNS name and it resolved, use the resolved 0x address.
  // Otherwise pass the raw input through unchanged (preserves existing 0x behavior).
  const effectiveRecipient =
    isArcNSName(recipient) && arcnsState === "resolved" && resolvedAddress
      ? resolvedAddress
      : recipient;

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(effectiveRecipient);
  const isValidAmount = parseFloat(amount) > 0;

  // Block send if user typed an ArcNS name but it hasn't resolved yet
  const arcnsBlocking = isArcNSName(recipient) && arcnsState !== "resolved";

  // Wallet must be on source chain — we show an error, never auto-switch
  const walletOnSource = walletChainId === sourceChainId;
  const walletOnDest = walletChainId === destChainId;

  const canSubmitStep1 =
    isConnected &&
    isValidAddress &&
    isValidAmount &&
    !!sourceChain &&
    !!destChain &&
    walletOnSource &&
    !arcnsBlocking;

  // ── STEP 1: Execute source transaction ────────────────────────────────────
  async function handleStep1() {
    if (!address || !sourceChain || !destChain) return;
    setStatus({ type: "loading", message: "Preparing…" });

    try {
      const usdcAddr = await getUsdcAddress(sourceChainId);
      if (!isNativeUsdc(sourceChainId) && !usdcAddr) {
        setStatus({
          type: "error",
          message: `No USDC on ${sourceChain.name}. Click "Get Test USDC" first.`,
        });
        return;
      }

      const netAmount = amountAfterFee(amount);
      const feeAmount = calculateFee(amount);
      const allSteps: Array<{
        name: string; state: string;
        txHash?: string; explorerUrl?: string; message?: string;
      }> = [];

      // Fee transfer (non-fatal, same chain)
      const validFeeRecipient =
        FEE_RECIPIENT &&
        FEE_RECIPIENT !== "0x0000000000000000000000000000000000000000";
      if (parseFloat(feeAmount) > 0 && validFeeRecipient) {
        setStatus({ type: "loading", message: "Sending 0.5% fee — approve the first wallet popup…" });
        try {
          const feeStep = await executeSend(
            usdcAddr,
            FEE_RECIPIENT,
            feeAmount,
            sourceChain.usdcDecimals,
            sourceChain.explorerTxUrl,
            sourceChainId
          );
          allSteps.push({ ...feeStep, name: "Fee (0.5%) — FlowPay fee address" });
        } catch (e: any) {
          console.warn("[fee]", e?.message);
        }
      }

      if (!route.needsBridge) {
        // ── Direct same-chain send ──────────────────────────────────────────
        const sendMsg = sourceChain.isArc
          ? `Sending ${netAmount} USDC on ${sourceChain.name} — approve the wallet popup…`
          : `Sending ${netAmount} USDC on ${sourceChain.name}…`;
        setStatus({ type: "loading", message: sendMsg });
        const sendStep = await executeSend(
          usdcAddr,
          effectiveRecipient,
          netAmount,
          sourceChain.usdcDecimals,
          sourceChain.explorerTxUrl,
          sourceChainId
        );
        const sendStepName = isArcNSName(recipient) && resolvedAddress
          ? `Sent ${netAmount} USDC → ${recipient}`
          : `Sent ${netAmount} USDC → ${effectiveRecipient.slice(0, 8)}…`;
        const arcDisplayNote = sourceChain.isArc
          ? "Explorer may show 0 — Arc native USDC uses 6 decimals"
          : undefined;
        allSteps.push({ ...sendStep, name: sendStepName, message: sendStep.message ?? arcDisplayNote });
        setStatus({ type: "success", steps: allSteps });
      } else {
        // ── Cross-chain Step 1: source tx ───────────────────────────────────
        setStatus({ type: "loading", message: `Sending ${netAmount} USDC on ${sourceChain.name}…` });
        const sourceTx = await executeSourceTx(
          sourceChain,
          usdcAddr,
          effectiveRecipient,
          netAmount
        );
        allSteps.push({ ...sourceTx, name: `Step 1: Sent on ${sourceChain.shortName} ✓` });

        if (sourceTx.state === "error") {
          setStatus({ type: "error", message: "Source transaction failed." });
          return;
        }

        // Save pending state for Step 2
        setPendingXChain({
          sourceTxHash: sourceTx.txHash ?? "",
          sourceExplorerUrl: sourceTx.explorerUrl ?? "",
          destChainId,
          recipient: effectiveRecipient,
          amount: netAmount,
        });

        // Show step-1-complete state with prompt for step 2
        setStatus({
          type: "success",
          steps: allSteps,
          // Signal that step 2 is pending
        });
      }
    } catch (err: any) {
      console.error("[handleStep1]", err);
      setStatus({
        type: "error",
        message: err?.reason ?? err?.message ?? "Transaction failed.",
      });
    }
  }

  // ── STEP 2: Complete destination credit ───────────────────────────────────
  async function handleStep2() {
    if (!pendingXChain || !destChain) return;
    setStatus({ type: "loading", message: `Preparing destination credit on ${destChain.name}…` });

    try {
      const creditStep = await executeDestCredit(
        destChain,
        pendingXChain.recipient,
        pendingXChain.amount,
        (msg) => setStatus({ type: "loading", message: msg })
      );

      setStatus({
        type: "success",
        steps: [
          {
            name: `Step 1: Sent on ${getChainById(sourceChainId)?.shortName ?? "source"} ✓`,
            state: "success",
            txHash: pendingXChain.sourceTxHash,
            explorerUrl: pendingXChain.sourceExplorerUrl,
          },
          creditStep,
        ],
      });
      setPendingXChain(null);
    } catch (err: any) {
      console.error("[handleStep2]", err);
      setStatus({
        type: "error",
        message: err?.reason ?? err?.message ?? "Destination credit failed.",
      });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Balance for selected source chain */}
      <UsdcBalance sourceChainId={sourceChainId} />

      {/* Mode + Arc badge */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">
          {route.mode === "direct" ? "Direct Send" : "Cross-chain Transfer"}
        </span>
        {route.isArcOptimized && (
          <span className="flex items-center gap-1 text-[10px] text-violet-400/70">
            <span>⚡</span> Arc Optimized
          </span>
        )}
      </div>

      {/* FROM ↔ TO — user-controlled, no auto-override */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-white/40 font-semibold uppercase tracking-widest">
          Route
        </label>
        <div className="flex items-center gap-2">
          {/* Source */}
          <div className="flex-1 relative">
            <select
              value={sourceChainId}
              onChange={(e) => handleSourceChange(Number(e.target.value))}
              disabled={!!pendingXChain}
              className="input-glow w-full bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all appearance-none cursor-pointer pr-7 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {CHAIN_LIST.map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.shortName}{chain.isArc ? " ⚡" : ""}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/25">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>

          {/* Swap chains */}
          <button
            onClick={handleSwapChains}
            disabled={!!pendingXChain}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/70 transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
            title="Swap chains"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>

          {/* Destination */}
          <div className="flex-1 relative">
            <select
              value={destChainId}
              onChange={(e) => handleDestChange(Number(e.target.value))}
              disabled={!!pendingXChain}
              className="input-glow w-full bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all appearance-none cursor-pointer pr-7 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {CHAIN_LIST.filter((c) => c.id !== sourceChainId || c.id === ARC_CHAIN_ID).map((chain) => (
                <option key={chain.id} value={chain.id}>
                  {chain.shortName}{chain.isArc ? " ⚡" : ""}
                </option>
              ))}
            </select>
            <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-white/25">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        </div>

        {/* Wallet mismatch warning — shown instead of auto-switching */}
        {isConnected && !walletOnSource && (
          <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
            <p className="text-xs text-amber-300">
              Wallet is on <span className="font-semibold">{getChainById(walletChainId)?.shortName ?? `chain ${walletChainId}`}</span>
              {" "}— switch to <span className="font-semibold">{sourceChain?.shortName}</span> to send
            </p>
            <button
              onClick={() => switchChain(sourceChainId)}
              className="text-xs text-amber-200 underline ml-2 flex-shrink-0 hover:text-amber-100"
            >
              Switch
            </button>
          </div>
        )}
      </div>

      {/* Recipient */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-white/40 font-semibold uppercase tracking-widest">
          Recipient
        </label>
        <input
          type="text"
          placeholder="0x... or name.arc"
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          disabled={!!pendingXChain}
          className={`input-glow w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-white/15 outline-none transition-all disabled:opacity-50 ${
            recipient && !isValidAddress && !isArcNSName(recipient)
              ? "border-red-500/40"
              : "border-white/[0.08] focus:border-violet-500/50"
          }`}
        />
        {/* Show ArcNS resolution status when input is an ArcNS name */}
        {isArcNSName(recipient) ? (
          <ArcNSResolutionStatus
            state={arcnsState}
            resolvedAddress={resolvedAddress}
            enteredName={recipient}
          />
        ) : (
          recipient && !isValidAddress && (
            <p className="text-xs text-red-400/80 flex items-center gap-1">
              <span>⚠</span> Invalid address
            </p>
          )
        )}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-white/40 font-semibold uppercase tracking-widest">
          Amount
        </label>
        <div className="relative">
          <input
            type="number"
            placeholder="0.00"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={!!pendingXChain}
            className="input-glow w-full bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-white/15 outline-none transition-all pr-20 disabled:opacity-50"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 pointer-events-none">
            <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-[8px] font-bold text-white">$</span>
            </div>
            <span className="text-sm text-white/50 font-medium">USDC</span>
          </div>
        </div>

        {isValidAmount && (
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5 space-y-1.5">
            <div className="flex justify-between text-xs">
              <span className="text-white/35">
                You send on <span className="text-white/50">{sourceChain?.shortName}</span>
              </span>
              <span className="text-white/70 font-medium">{amount} USDC</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-white/35">Fee (0.5%)</span>
              <span className="text-amber-400/80">− {fee} USDC</span>
            </div>
            <div className="border-t border-white/[0.06] pt-1.5 flex justify-between text-xs">
              <span className="text-white/35">
                They receive on <span className="text-white/50">{destChain?.shortName}</span>
              </span>
              <span className="text-emerald-400 font-semibold">≈ {receiveAmount} USDC</span>
            </div>
          </div>
        )}
      </div>

      {/* Route preview */}
      {isValidAmount && sourceChain && destChain && (
        <RouteDisplay
          route={route.steps}
          sourceChain={sourceChain.shortName}
          destChain={destChain.shortName}
          amount={amount}
          receiveAmount={receiveAmount}
          isArcOptimized={route.isArcOptimized}
          routeLabel={route.label}
        />
      )}

      {/* ── Arc send notice — shown before the user clicks Send ──────────── */}
      {isValidAmount && isValidAddress && sourceChain?.isArc && !pendingXChain && (
        <div className="rounded-lg bg-violet-500/5 border border-violet-500/15 px-3 py-2.5 space-y-1.5">
          <p className="text-[11px] font-semibold text-violet-300/70 uppercase tracking-widest">
            Wallet popups for this send
          </p>
          {/* Fee tx — only shown when a valid fee recipient is configured */}
          {parseFloat(fee) > 0 && FEE_RECIPIENT && FEE_RECIPIENT !== "0x0000000000000000000000000000000000000000" && (
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-white/30 font-mono mt-0.5 flex-shrink-0">1.</span>
              <p className="text-[11px] text-white/40">
                <span className="text-amber-400/80">{fee} USDC</span> fee transfer to the FlowPay fee address — approve this first.
              </p>
            </div>
          )}
          {/* Main send tx */}
          <div className="flex items-start gap-2">
            <span className="text-[10px] text-white/30 font-mono mt-0.5 flex-shrink-0">
              {parseFloat(fee) > 0 && FEE_RECIPIENT && FEE_RECIPIENT !== "0x0000000000000000000000000000000000000000" ? "2." : "1."}
            </span>
            <div className="text-[11px] text-white/40 space-y-0.5">
              <p>
                <span className="text-emerald-400/80">{receiveAmount} USDC</span> sent to{" "}
                {isArcNSName(recipient) && resolvedAddress ? (
                  <span>
                    <span className="text-white/60">{recipient}</span>
                    {" "}→{" "}
                    <span className="font-mono text-white/40 break-all">{resolvedAddress}</span>
                  </span>
                ) : (
                  <span className="font-mono text-white/50 break-all">{effectiveRecipient}</span>
                )}
              </p>
            </div>
          </div>
          {/* Arc native display note */}
          <p className="text-[10px] text-white/20 pt-0.5 border-t border-white/[0.05]">
            Arc USDC is the native gas token (18 decimals for value transfers). MetaMask and the explorer may display amounts differently — the actual amount is correct on-chain.
          </p>
        </div>
      )}

      {/* ── STEP 1 button ─────────────────────────────────────────────────── */}
      {!pendingXChain && (
        <button
          onClick={handleStep1}
          disabled={!canSubmitStep1 || status.type === "loading"}
          className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:from-white/8 disabled:to-white/8 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-violet-900/30 active:scale-[0.99]"
        >
          {status.type === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Processing…
            </span>
          ) : !isConnected ? (
            "Connect wallet to continue"
          ) : !walletOnSource ? (
            `Switch to ${sourceChain?.shortName} to send`
          ) : route.needsBridge ? (
            `Step 1: Send on ${sourceChain?.shortName} →`
          ) : (
            `Send USDC → ${destChain?.shortName ?? ""}`
          )}
        </button>
      )}

      {/* ── STEP 2 panel (cross-chain only) ──────────────────────────────── */}
      {pendingXChain && (
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 space-y-3">
          {/* Step 1 confirmed */}
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-emerald-400">
                Step 1 complete — USDC sent on {getChainById(sourceChainId)?.shortName}
              </p>
              {pendingXChain.sourceExplorerUrl && (
                <a
                  href={pendingXChain.sourceExplorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-violet-400 underline"
                >
                  View tx ↗
                </a>
              )}
            </div>
          </div>

          {/* Step 2 instruction */}
          <div className="rounded-lg bg-white/[0.04] border border-white/[0.07] px-3 py-2.5 space-y-1">
            <p className="text-xs font-semibold text-white/70">Step 2: Complete on {destChain?.name}</p>
            <p className="text-[11px] text-white/35">
              Switch your wallet to <span className="text-white/60 font-medium">{destChain?.shortName}</span>,
              then click below to credit {pendingXChain.amount} USDC to the recipient.
            </p>
            {/* Show ArcNS name + resolved address when the send was initiated via ArcNS */}
            {recipient && isArcNSName(recipient) && pendingXChain.recipient !== recipient && (
              <div className="pt-1 border-t border-white/[0.06] space-y-0.5">
                <p className="text-[10px] text-white/30">ArcNS name</p>
                <p className="text-[10px] text-white/50 font-mono">{recipient}</p>
                <p className="text-[10px] text-emerald-400/70 font-mono break-all">{pendingXChain.recipient}</p>
              </div>
            )}
          </div>

          {/* Wallet on dest check */}
          {!walletOnDest && (
            <div className="flex items-center justify-between rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <p className="text-xs text-amber-300">
                Switch wallet to <span className="font-semibold">{destChain?.shortName}</span> first
              </p>
              <button
                onClick={() => switchChain(destChainId)}
                className="text-xs text-amber-200 underline ml-2 flex-shrink-0"
              >
                Switch
              </button>
            </div>
          )}

          {/* Step 2 button */}
          <button
            onClick={handleStep2}
            disabled={!walletOnDest || status.type === "loading"}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 disabled:from-white/8 disabled:to-white/8 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-all text-sm active:scale-[0.99]"
          >
            {status.type === "loading" ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Crediting…
              </span>
            ) : !walletOnDest ? (
              `Switch to ${destChain?.shortName} first`
            ) : (
              `Step 2: Credit on ${destChain?.shortName} →`
            )}
          </button>

          {/* Cancel */}
          <button
            onClick={() => {
              setPendingXChain(null);
              setStatus({ type: "idle" });
            }}
            className="w-full text-xs text-white/25 hover:text-white/50 transition-colors py-1"
          >
            Cancel (source tx already sent)
          </button>
        </div>
      )}

      {/* Status panel */}
      <StatusPanel
        status={status}
        onReset={() => {
          if (!pendingXChain) setStatus({ type: "idle" });
        }}
      />
    </div>
  );
}
