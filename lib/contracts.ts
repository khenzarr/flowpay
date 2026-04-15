// Contract addresses per chain
// Arc Testnet: USDC is the native gas token — no ERC-20 contract needed for native transfers
// Other chains: mock ERC-20 deployed on demand, stored in localStorage

const STORAGE_KEY = "flowpay_mock_usdc_v2";

export function getMockUsdcAddress(chainId: number): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return null;
    const map: Record<number, string> = JSON.parse(stored);
    return map[chainId] ?? null;
  } catch {
    return null;
  }
}

export function setMockUsdcAddress(chainId: number, address: string): void {
  if (typeof window === "undefined") return;
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const map: Record<number, string> = stored ? JSON.parse(stored) : {};
    map[chainId] = address;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // ignore
  }
}

// Known real USDC ERC-20 addresses per chain
export const KNOWN_USDC: Record<number, string> = {
  // Ethereum Sepolia — Circle official testnet USDC
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  // Arc Testnet: USDC is native — no ERC-20 address here
  // Other chains: mock deployed on demand
};

// Arc Testnet chain ID — USDC is native gas token
export const ARC_CHAIN_ID = 5042002;

// Returns true if the chain uses USDC as native gas (Arc)
export function isNativeUsdc(chainId: number): boolean {
  return chainId === ARC_CHAIN_ID;
}
