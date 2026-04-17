"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";
import { useNetworkSwitch } from "@/hooks/useNetworkSwitch";
import { getChainById, ARC_CHAIN_ID } from "@/lib/chains";

export function ConnectWallet() {
  const { address, isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { chainId, isSupported, switching, switchTo } = useNetworkSwitch();

  const currentChain = getChainById(chainId);

  // Pick best connector: prefer MetaMask by name, fall back to first injected
  const connector =
    connectors.find((c) => c.name === "MetaMask") ||
    connectors.find((c) => c.type === "injected") ||
    connectors[0];

  if (isConnected && address) {
    return (
      <div className="flex items-center gap-2 flex-wrap justify-end">
        {!isSupported ? (
          <div className="flex items-center gap-1.5 bg-red-500/20 border border-red-500/30 rounded-full px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs text-red-300 font-medium">Wrong Network</span>
            <button
              onClick={() => switchTo(ARC_CHAIN_ID)}
              disabled={switching}
              className="text-xs text-red-200 underline ml-1 disabled:opacity-50"
            >
              {switching ? "Switching…" : "→ Arc Testnet"}
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-3 py-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            <span className="text-xs text-emerald-300 font-medium">
              {currentChain?.shortName ?? "Testnet"}
            </span>
          </div>
        )}

        <div className="flex items-center gap-2 bg-white/8 border border-white/10 rounded-full px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-mono text-white/80">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        </div>

        <button
          onClick={() => disconnect()}
          className="text-xs text-white/30 hover:text-white/60 transition-colors px-2"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => connector && connect({ connector })}
      disabled={isPending || isConnecting || !connector}
      className="relative bg-violet-600 hover:bg-violet-500 active:scale-95 disabled:opacity-50 text-white font-semibold px-5 py-2 rounded-full transition-all text-sm flex items-center gap-2"
    >
      {(isPending || isConnecting) && (
        <div className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
      )}
      {isPending || isConnecting ? "Connecting…" : "Connect Wallet"}
    </button>
  );
}
