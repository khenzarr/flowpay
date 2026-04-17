// ── SINGLE SOURCE OF TRUTH for all chain configurations ──────────────────────
// All other files import from here. Nothing is duplicated elsewhere.
// Sources: official docs, chainlist.org — verified 2025

export interface ChainConfig {
  id: number;
  name: string;
  shortName: string;
  rpcUrl: string;
  explorerUrl: string;
  explorerTxUrl: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
  usdcAddress: string | null; // null = deploy mock on demand
  usdcDecimals: number;
  isTestnet: true;
  isArc?: boolean; // true = USDC is the native gas token
}

// ── Chain definitions ─────────────────────────────────────────────────────────

export const CHAINS = {
  // Arc Testnet — PRIMARY
  // Source: https://docs.arc.network/arc/references/connect-to-arc
  // ChainId: 5042002 | Native gas token: USDC (6 decimals, NOT ETH)
  arc: {
    id: 5042002,
    name: "Arc Testnet",
    shortName: "Arc",
    rpcUrl: "https://rpc.testnet.arc.network",
    explorerUrl: "https://testnet.arcscan.app",
    explorerTxUrl: "https://testnet.arcscan.app/tx/",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    usdcAddress: null,
    usdcDecimals: 6,
    isTestnet: true as const,
    isArc: true,
  },

  // Ethereum Sepolia
  // USDC: Circle official testnet (faucet.circle.com)
  sepolia: {
    id: 11155111,
    name: "Ethereum Sepolia",
    shortName: "Sepolia",
    rpcUrl: "https://rpc.sepolia.org",
    explorerUrl: "https://sepolia.etherscan.io",
    explorerTxUrl: "https://sepolia.etherscan.io/tx/",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
    usdcDecimals: 6,
    isTestnet: true as const,
  },

  // Holesky
  holesky: {
    id: 17000,
    name: "Holesky",
    shortName: "Holesky",
    rpcUrl: "https://ethereum-holesky.publicnode.com",
    explorerUrl: "https://holesky.beaconcha.in",
    explorerTxUrl: "https://holesky.etherscan.io/tx/",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: null,
    usdcDecimals: 6,
    isTestnet: true as const,
  },

  // Linea Sepolia
  // Source: docs.linea.build — chainId 59141
  lineaSepolia: {
    id: 59141,
    name: "Linea Sepolia",
    shortName: "Linea Sep.",
    rpcUrl: "https://rpc.sepolia.linea.build",
    explorerUrl: "https://sepolia.lineascan.build",
    explorerTxUrl: "https://sepolia.lineascan.build/tx/",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: null,
    usdcDecimals: 6,
    isTestnet: true as const,
  },

  // MegaETH Testnet
  // Source: chainlist.org/chain/6342
  megaEth: {
    id: 6342,
    name: "MegaETH Testnet",
    shortName: "MegaETH",
    rpcUrl: "https://carrot.megaeth.com/rpc",
    explorerUrl: "https://www.megaexplorer.xyz",
    explorerTxUrl: "https://www.megaexplorer.xyz/tx/",
    nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
    usdcAddress: null,
    usdcDecimals: 6,
    isTestnet: true as const,
  },

  // Monad Testnet
  // Source: monad-docs.vercel.app — chainId 10143
  monad: {
    id: 10143,
    name: "Monad Testnet",
    shortName: "Monad",
    rpcUrl: "https://testnet-rpc.monad.xyz",
    explorerUrl: "https://testnet.monadexplorer.com",
    explorerTxUrl: "https://testnet.monadexplorer.com/tx/",
    nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
    usdcAddress: null,
    usdcDecimals: 6,
    isTestnet: true as const,
  },
} satisfies Record<string, ChainConfig>;

// ── Ordered list (Arc first = default) ───────────────────────────────────────

export const CHAIN_LIST: ChainConfig[] = [
  CHAINS.arc,
  CHAINS.sepolia,
  CHAINS.holesky,
  CHAINS.lineaSepolia,
  CHAINS.megaEth,
  CHAINS.monad,
];

// ── Constants derived from registry (one place only) ─────────────────────────

export const ARC_CHAIN_ID          = CHAINS.arc.id;          // 5042002
export const DEFAULT_SOURCE_CHAIN_ID = CHAINS.arc.id;        // Arc
export const DEFAULT_DEST_CHAIN_ID   = CHAINS.sepolia.id;    // Sepolia
export const SUPPORTED_CHAIN_IDS     = CHAIN_LIST.map((c) => c.id);

// ── Lookup helpers ────────────────────────────────────────────────────────────

export function getChainById(id: number): ChainConfig | undefined {
  return CHAIN_LIST.find((c) => c.id === id);
}

export function getChainByName(name: string): ChainConfig | undefined {
  return CHAIN_LIST.find((c) => c.shortName === name || c.name === name);
}

export function isArcChain(chainId: number): boolean {
  return chainId === ARC_CHAIN_ID;
}

export function isSupportedChain(chainId: number): boolean {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
}

// Keep legacy export name for files that import TESTNET_CHAINS
export const TESTNET_CHAINS = CHAINS;
