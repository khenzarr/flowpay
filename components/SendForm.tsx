"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { determineRoute, calculateFee, amountAfterFee } from "@/lib/flowRouter";
import { RouteDisplay } from "./RouteDisplay";
import { StatusPanel, TxStatus } from "./StatusPanel";
import { UsdcBalance } from "./UsdcBalance";
import {
  getUsdcAddress,
  executeSend,
  executeCrossChainTransfer,
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

const FEE_RECIPIENT = process.env.NEXT_PUBLIC_FEE_RECIPIENT ?? "";

export function SendForm() {
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();

  const [sourceChainId, setSourceChainId] = useState(DEFAULT_SOURCE_CHAIN_ID);
  const [destChainId, setDestChainId] = useState(DEFAULT_DEST_CHAIN_ID);
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("");
  const [status, setStatus] = useState<TxStatus>({ type: "idle" });

  // Sync source with wallet chain
  useEffect(() => {
    const chain = getChainById(walletChainId);
    if (chain) {
      setSourceChainId(walletChainId);
      if (walletChainId === destChainId) {
        const fallback = CHAIN_LIST.find((c) => c.id !== walletChainId);
        if (fallback) setDestChainId(fallback.id);
      }
    }
  }, [walletChainId]);

  const handleSourceChange = useCallback(
    (id: number) => {
      setSourceChainId(id);
      if (id === destChainId) {
        const fallback = CHAIN_LIST.find((c) => c.id !== id);
        if (fallback) setDestChainId(fallback.id);
      }
      setStatus({ type: "idle" });
    },
    [destChainId]
  );

  const handleDestChange = useCallback(
    (id: number) => {
      setDestChainId(id);
      if (id === sourceChainId) {
        const fallback = CHAIN_LIST.find((c) => c.id !== id);
        if (fallback) setSourceChainId(fallback.id);
      }
      setStatus({ type: "idle" });
    },
    [sourceChainId]
  );

  const handleSwapChains = useCallback(() => {
    setSourceChainId(destChainId);
    setDestChainId(sourceChainId);
    setStatus({ type: "idle" });
  }, [sourceChainId, destChainId]);

  const sourceChain = getChainById(sourceChainId);
  const destChain = getChainById(destChainId);
  const route = determineRoute(sourceChainId, destChainId);
  const fee = calculateFee(amount);
  const receiveAmount = amountAfterFee(amount);

  const isValidAddress = /^0x[a-fA-F0-9]{40}$/.test(recipient);
  const isValidAmount = parseFloat(amount) > 0;
  const canSubmit =
    isConnected && isValidAddress && isValidAmount && !!sourceChain && !!destChain;

  // Mode label
  const isSameChain = sourceChainId === destChainId;
  const modeLabel = isSameChain
    ? sourceChain?.isArc
      ? "Onchain · Arc"
      : "Onchain · Same chain"
    : "Cross-chain transfer";

  async function handleSend() {
    if (!address || !sourceChain || !destChain) return;
    setStatus({ type: "loading", message: "Preparing…" });

    try {
      // Ensure wallet is on source chain
      if (walletChainId !== sourceChainId) {
        setStatus({ type: "loading", message: `Switching to ${sourceChain.name}…` });
        await switchChain(sourceChainId);
        await new Promise((r) => setTimeout(r, 800));
      }

      // Resolve USDC on source
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
        name: string;
        state: string;
        txHash?: string;
        explorerUrl?: string;
        message?: string;
      }> = [];

      // Fee (non-fatal)
      const validFeeRecipient =
        FEE_RECIPIENT &&
        FEE_RECIPIENT !== "0x0000000000000000000000000000000000000000";
      if (parseFloat(feeAmount) > 0 && validFeeRecipient) {
        setStatus({ type: "loading", message: "Sending 0.5% fee…" });
        try {
          const feeStep = await executeSend(
            usdcAddr,
            FEE_RECIPIENT,
            feeAmount,
            sourceChain.usdcDecimals,
            sourceChain.explorerTxUrl,
            sourceChainId
          );
          allSteps.push({ ...feeStep, name: "Fee (0.5%)" });
        } catch (e: any) {
          console.warn("[fee]", e?.message);
        }
      }

      // Main flow
      if (route.needsBridge) {
        // Cross-chain: real source tx + credit on dest
        const xSteps = await executeCrossChainTransfer(
          sourceChain,
          destChain,
          usdcAddr,
          recipient,
          netAmount,
          (msg) => setStatus({ type: "loading", message: msg })
        );
        allSteps.push(...xSteps);
      } else {
        // Same-chain: direct send
        setStatus({ type: "loading", message: `Sending ${netAmount} USDC on ${sourceChain.name}…` });
        const sendStep = await executeSend(
          usdcAddr,
          recipient,
          netAmount,
          sourceChain.usdcDecimals,
          sourceChain.explorerTxUrl,
          sourceChainId
        );
        allSteps.push(sendStep);
      }

      setStatus({ type: "success", steps: allSteps });
    } catch (err: any) {
      console.error("[handleSend]", err);
      setStatus({
        type: "error",
        message: err?.reason ?? err?.message ?? "Transaction failed.",
      });
    }
  }

  return (
    <div className="space-y-4">
      {/* Balance */}
      <UsdcBalance sourceChainId={sourceChainId} />

      {/* Mode badge */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-white/30 uppercase tracking-widest font-semibold">
          {modeLabel}
        </span>
        {route.isArcOptimized && (
          <span className="flex items-center gap-1 text-[10px] text-violet-400/70">
            <span>⚡</span> Arc Optimized
          </span>
        )}
      </div>

      {/* FROM ↔ TO */}
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
              className="input-glow w-full bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all appearance-none cursor-pointer pr-7"
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

          {/* Swap */}
          <button
            onClick={handleSwapChains}
            className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/[0.05] hover:bg-white/[0.1] border border-white/[0.08] flex items-center justify-center text-white/40 hover:text-white/70 transition-all active:scale-90"
            title="Swap chains"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>

          {/* Dest */}
          <div className="flex-1 relative">
            <select
              value={destChainId}
              onChange={(e) => handleDestChange(Number(e.target.value))}
              className="input-glow w-full bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/50 rounded-xl px-3 py-2.5 text-sm text-white outline-none transition-all appearance-none cursor-pointer pr-7"
            >
              {CHAIN_LIST.filter((c) => c.id !== sourceChainId).map((chain) => (
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
      </div>

      {/* Recipient */}
      <div className="space-y-1.5">
        <label className="text-[11px] text-white/40 font-semibold uppercase tracking-widest">
          Recipient
        </label>
        <input
          type="text"
          placeholder="0x..."
          value={recipient}
          onChange={(e) => setRecipient(e.target.value)}
          className={`input-glow w-full bg-white/[0.04] border rounded-xl px-4 py-3 text-sm font-mono text-white placeholder-white/15 outline-none transition-all ${
            recipient && !isValidAddress
              ? "border-red-500/40"
              : "border-white/[0.08] focus:border-violet-500/50"
          }`}
        />
        {recipient && !isValidAddress && (
          <p className="text-xs text-red-400/80 flex items-center gap-1">
            <span>⚠</span> Invalid address
          </p>
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
            className="input-glow w-full bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/50 rounded-xl px-4 py-3 text-sm text-white placeholder-white/15 outline-none transition-all pr-20"
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

      {/* Cross-chain disclaimer */}
      {route.needsBridge && (
        <p className="text-[10px] text-white/25 text-center">
          Source tx is real on-chain · Destination credit simulated on testnet
        </p>
      )}

      {/* Submit */}
      <button
        onClick={handleSend}
        disabled={!canSubmit || status.type === "loading"}
        className="w-full bg-gradient-to-r from-violet-600 to-violet-500 hover:from-violet-500 hover:to-violet-400 disabled:from-white/8 disabled:to-white/8 disabled:cursor-not-allowed text-white font-semibold py-3.5 rounded-xl transition-all text-sm shadow-lg shadow-violet-900/30 active:scale-[0.99]"
      >
        {status.type === "loading" ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processing…
          </span>
        ) : !isConnected ? (
          "Connect wallet to continue"
        ) : (
          `Send USDC → ${destChain?.shortName ?? ""}`
        )}
      </button>

      <StatusPanel status={status} onReset={() => setStatus({ type: "idle" })} />
    </div>
  );
}
