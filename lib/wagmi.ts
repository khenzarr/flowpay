// ── Wagmi config — built from chain registry, no duplication ─────────────────
// All chain data (IDs, RPCs, names) comes from lib/chains.ts

import { createConfig, http } from "wagmi";
import { injected, metaMask } from "@wagmi/connectors";
import { defineChain } from "viem";
import { sepolia as viemSepolia, holesky as viemHolesky } from "wagmi/chains";
import { CHAINS } from "./chains";

// ── Build viem chain objects from registry ────────────────────────────────────

export const arcTestnet = defineChain({
  id: CHAINS.arc.id,
  name: CHAINS.arc.name,
  nativeCurrency: CHAINS.arc.nativeCurrency,
  rpcUrls: {
    default: { http: [CHAINS.arc.rpcUrl] },
    public:  { http: [CHAINS.arc.rpcUrl] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: CHAINS.arc.explorerUrl },
  },
  testnet: true,
});

export const lineaSepolia = defineChain({
  id: CHAINS.lineaSepolia.id,
  name: CHAINS.lineaSepolia.name,
  nativeCurrency: CHAINS.lineaSepolia.nativeCurrency,
  rpcUrls: { default: { http: [CHAINS.lineaSepolia.rpcUrl] } },
  blockExplorers: {
    default: { name: "Lineascan", url: CHAINS.lineaSepolia.explorerUrl },
  },
  testnet: true,
});

export const megaEth = defineChain({
  id: CHAINS.megaEth.id,
  name: CHAINS.megaEth.name,
  nativeCurrency: CHAINS.megaEth.nativeCurrency,
  rpcUrls: { default: { http: [CHAINS.megaEth.rpcUrl] } },
  blockExplorers: {
    default: { name: "MegaExplorer", url: CHAINS.megaEth.explorerUrl },
  },
  testnet: true,
});

export const monadTestnet = defineChain({
  id: CHAINS.monad.id,
  name: CHAINS.monad.name,
  nativeCurrency: CHAINS.monad.nativeCurrency,
  rpcUrls: { default: { http: [CHAINS.monad.rpcUrl] } },
  blockExplorers: {
    default: { name: "MonadExplorer", url: CHAINS.monad.explorerUrl },
  },
  testnet: true,
});

// ── Wagmi config — Arc first = default ───────────────────────────────────────

export const wagmiConfig = createConfig({
  chains: [arcTestnet, viemSepolia, viemHolesky, lineaSepolia, megaEth, monadTestnet],
  connectors: [
    injected({ target: "metaMask" }),
    metaMask(),
    injected(),
  ],
  transports: {
    [CHAINS.arc.id]:          http(CHAINS.arc.rpcUrl),
    [CHAINS.sepolia.id]:      http(CHAINS.sepolia.rpcUrl),
    [CHAINS.holesky.id]:      http(CHAINS.holesky.rpcUrl),
    [CHAINS.lineaSepolia.id]: http(CHAINS.lineaSepolia.rpcUrl),
    [CHAINS.megaEth.id]:      http(CHAINS.megaEth.rpcUrl),
    [CHAINS.monad.id]:        http(CHAINS.monad.rpcUrl),
  },
  ssr: true,
});

// Re-export constants from registry (no duplication)
export { ARC_CHAIN_ID, SUPPORTED_CHAIN_IDS } from "./chains";
