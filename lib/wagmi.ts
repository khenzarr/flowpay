import { createConfig, http } from "wagmi";
import { sepolia, holesky } from "wagmi/chains";
import { injected, metaMask } from "@wagmi/connectors";
import { defineChain } from "viem";

// ── Arc Testnet ───────────────────────────────────────────────────────────────
// Source: https://docs.arc.network/arc/references/connect-to-arc
// Chain ID: 5042002 | Native gas token: USDC
export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.network"] },
    public:  { http: ["https://rpc.testnet.arc.network"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

// ── Other custom chains ───────────────────────────────────────────────────────

export const lineaSepolia = defineChain({
  id: 59141,
  name: "Linea Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.sepolia.linea.build"] } },
  blockExplorers: {
    default: { name: "Lineascan", url: "https://sepolia.lineascan.build" },
  },
  testnet: true,
});

export const megaEth = defineChain({
  id: 6342,
  name: "MegaETH Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://carrot.megaeth.com/rpc"] } },
  blockExplorers: {
    default: { name: "MegaExplorer", url: "https://www.megaexplorer.xyz" },
  },
  testnet: true,
});

export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: { default: { http: ["https://testnet-rpc.monad.xyz"] } },
  blockExplorers: {
    default: { name: "MonadExplorer", url: "https://testnet.monadexplorer.com" },
  },
  testnet: true,
});

// ── Wagmi config — Arc Testnet is FIRST (default) ─────────────────────────────

export const wagmiConfig = createConfig({
  chains: [arcTestnet, sepolia, holesky, lineaSepolia, megaEth, monadTestnet],
  connectors: [
    injected({ target: "metaMask" }),
    metaMask(),
    injected(),
  ],
  transports: {
    [arcTestnet.id]:    http("https://rpc.testnet.arc.network"),
    [sepolia.id]:       http("https://rpc.sepolia.org"),
    [holesky.id]:       http("https://ethereum-holesky.publicnode.com"),
    [lineaSepolia.id]:  http("https://rpc.sepolia.linea.build"),
    [megaEth.id]:       http("https://carrot.megaeth.com/rpc"),
    [monadTestnet.id]:  http("https://testnet-rpc.monad.xyz"),
  },
  ssr: true,
});

// ── Helpers ───────────────────────────────────────────────────────────────────

export const chainIdToName: Record<number, string> = {
  5042002: "Arc",
  11155111: "Sepolia",
  17000: "Holesky",
  59141: "Linea Sep.",
  6342: "MegaETH",
  10143: "Monad",
};

export const SUPPORTED_CHAIN_IDS = [5042002, 11155111, 17000, 59141, 6342, 10143];

export const ARC_CHAIN_ID = 5042002;
