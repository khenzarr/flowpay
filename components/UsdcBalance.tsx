"use client";

import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { getUsdcBalance, deployMockUsdc, mintMockUsdc } from "@/lib/txEngine";
import { KNOWN_USDC, isNativeUsdc } from "@/lib/contracts";
import { getChainById } from "@/lib/chains";

interface UsdcBalanceProps {
  sourceChainId: number;
}

export function UsdcBalance({ sourceChainId }: UsdcBalanceProps) {
  const { address, isConnected } = useAccount();
  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(false);
  const [minting, setMinting] = useState(false);
  const [mintMsg, setMintMsg] = useState("");

  const chain = getChainById(sourceChainId);
  const hasRealUsdc = !!KNOWN_USDC[sourceChainId] || isNativeUsdc(sourceChainId);

  const refresh = useCallback(async () => {
    if (!address || !sourceChainId) return;
    setLoading(true);
    try {
      const bal = await getUsdcBalance(sourceChainId, address);
      setBalance(bal);
    } catch (e) {
      console.error("[UsdcBalance refresh]", e);
    } finally {
      setLoading(false);
    }
  }, [address, sourceChainId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (!isConnected || !address) return null;

  async function handleGetTestUsdc() {
    if (!address) return;
    setMinting(true);
    setMintMsg("");
    try {
      let addr: string | null = null;

      // Arc: USDC is native — can't mint ERC-20
      if (isNativeUsdc(sourceChainId)) {
        setMintMsg("Arc uses native USDC. Get from faucet.circle.com");
        return;
      }

      // Check for existing mock
      const { getMockUsdcAddress } = await import("@/lib/contracts");
      addr = getMockUsdcAddress(sourceChainId);

      if (!addr) {
        setMintMsg("Deploying mock USDC contract…");
        addr = await deployMockUsdc(sourceChainId);
      }

      setMintMsg("Minting 1000 USDC…");
      await mintMockUsdc(addr, address, "1000");
      setMintMsg("✓ 1000 USDC minted!");
      await refresh();
      setTimeout(() => setMintMsg(""), 3000);
    } catch (e: any) {
      setMintMsg("Error: " + (e?.message ?? "Unknown"));
      console.error("[handleGetTestUsdc]", e);
    } finally {
      setMinting(false);
    }
  }

  return (
    <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] px-4 py-3 space-y-2.5">
      {/* Balance row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-[10px] font-bold text-white">$</span>
          </div>
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider">
              USDC on {chain?.shortName ?? "…"}
              {isNativeUsdc(sourceChainId) && (
                <span className="ml-1 text-violet-400/60">(native)</span>
              )}
            </p>
            {loading ? (
              <div className="w-16 h-3.5 bg-white/10 rounded animate-pulse mt-0.5" />
            ) : (
              <p className="text-sm font-bold text-white">
                {parseFloat(balance).toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </p>
            )}
          </div>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="text-white/20 hover:text-white/50 transition-colors disabled:opacity-30 p-1"
          title="Refresh balance"
        >
          <svg
            className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      {/* CTA */}
      {!hasRealUsdc ? (
        <div className="space-y-1.5">
          <button
            onClick={handleGetTestUsdc}
            disabled={minting}
            className="w-full text-xs bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 rounded-lg py-2 transition-colors disabled:opacity-50 font-medium"
          >
            {minting ? (
              <span className="flex items-center justify-center gap-1.5">
                <span className="w-3 h-3 border border-blue-300/40 border-t-blue-300 rounded-full animate-spin" />
                {mintMsg || "Working…"}
              </span>
            ) : (
              "+ Get 1000 Test USDC"
            )}
          </button>
          {mintMsg && !minting && (
            <p className="text-xs text-center text-white/30">{mintMsg}</p>
          )}
        </div>
      ) : (
        <p className="text-xs text-white/25 text-center">
          {isNativeUsdc(sourceChainId) ? (
            <>
              Arc uses native USDC.{" "}
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 underline"
              >
                Get from faucet.circle.com
              </a>
            </>
          ) : (
            <>
              Get testnet USDC at{" "}
              <a
                href="https://faucet.circle.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-violet-400 hover:text-violet-300 underline"
              >
                faucet.circle.com
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
