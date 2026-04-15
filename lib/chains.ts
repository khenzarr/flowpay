// Real testnet chain configurations
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
  isArc?: boolean; // Arc Network flag — USDC is native gas token
}

export const TESTNET_CHAINS: Record<string, ChainConfig> = {
  // ── Arc Testnet — PRIMARY / DEFAULT ──────────────────────────────────────
  // Source: https://docs.arc.network/arc/references/connect-to-arc
  // Chain ID: 5042002 | Native currency: USDC (not ETH!)
  arc: {
    id: 5042002,
    name: "Arc Testnet",
    shortName: "Arc",
    rpcUrl: "https://rpc.testnet.arc.network",
    explorerUrl: "https://testnet.arcscan.app",
    explorerTxUrl: "https://testnet.arcscan.app/tx/",
    nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 6 },
    // On Arc, USDC is the native token — no separate ERC-20 contract needed
    // We use a well-known testnet USDC address for ERC-20 transfers
    usdcAddress: null, // mock deployed on first use (Arc uses USDC as gas)
    usdcDecimals: 6,
    isTestnet: true,
    isArc: true,
  },

  // ── Ethereum Sepolia ──────────────────────────────────────────────────────
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
    isTestnet: true,
  },

  // ── Holesky ───────────────────────────────────────────────────────────────
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
    isTestnet: true,
  },

  // ── Linea Sepolia ─────────────────────────────────────────────────────────
  // Source: docs.linea.build
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
    isTestnet: true,
  },

  // ── MegaETH Testnet ───────────────────────────────────────────────────────
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
    isTestnet: true,
  },

  // ── Monad Testnet ─────────────────────────────────────────────────────────
  // Source: monad-docs.vercel.app
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
    isTestnet: true,
  },
};

// Arc is first — it's the default
export const CHAIN_LIST = [
  TESTNET_CHAINS.arc,
  TESTNET_CHAINS.sepolia,
  TESTNET_CHAINS.holesky,
  TESTNET_CHAINS.lineaSepolia,
  TESTNET_CHAINS.megaEth,
  TESTNET_CHAINS.monad,
];

export const ARC_CHAIN_ID = 5042002;
export const DEFAULT_SOURCE_CHAIN_ID = 5042002; // Arc Testnet
export const DEFAULT_DEST_CHAIN_ID = 11155111;  // Ethereum Sepolia

export function getChainById(id: number): ChainConfig | undefined {
  return CHAIN_LIST.find((c) => c.id === id);
}

export function getChainByName(name: string): ChainConfig | undefined {
  return CHAIN_LIST.find((c) => c.shortName === name || c.name === name);
}

export function isArcChain(chainId: number): boolean {
  return chainId === ARC_CHAIN_ID;
}
