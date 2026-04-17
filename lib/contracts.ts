// Contract address registry
// Mock USDC addresses stored in localStorage per chain after deployment.
// Arc uses native USDC — no ERC-20 needed.

import { ARC_CHAIN_ID } from "./chains"; // single source

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
  } catch {}
}

// Known real USDC ERC-20 addresses — sourced from chain registry
export const KNOWN_USDC: Record<number, string> = {
  11155111: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", // Sepolia (Circle official)
};

// Arc: USDC is the native gas token — no ERC-20
export { ARC_CHAIN_ID };

export function isNativeUsdc(chainId: number): boolean {
  return chainId === ARC_CHAIN_ID;
}
