// ── Contract Registry ─────────────────────────────────────────────────────────
// Stores and retrieves deployed contract addresses.
// Priority: env var → localStorage → null
// Per-chain storage so the same app can work across networks.

const STORAGE_PREFIX = "flowpay_contract_";

function storageKey(chainId: number, name: string): string {
  return `${STORAGE_PREFIX}${name}_${chainId}`;
}

function isValidAddress(addr: unknown): addr is string {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

// ── Get ───────────────────────────────────────────────────────────────────────

export function getContractAddress(
  chainId: number,
  name: string
): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(storageKey(chainId, name));
    return isValidAddress(stored) ? stored : null;
  } catch {
    return null;
  }
}

// ── Set ───────────────────────────────────────────────────────────────────────

export function setContractAddress(
  chainId: number,
  name: string,
  address: string
): void {
  if (typeof window === "undefined") return;
  if (!isValidAddress(address)) {
    console.error("[contractRegistry] Invalid address:", address);
    return;
  }
  try {
    localStorage.setItem(storageKey(chainId, name), address);
    console.log(`[contractRegistry] Saved ${name} on chain ${chainId}:`, address);
  } catch {
    // ignore storage errors
  }
}

// ── Clear ─────────────────────────────────────────────────────────────────────

export function clearContractAddress(chainId: number, name: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(storageKey(chainId, name));
  } catch {}
}

// ── GM-specific helpers ───────────────────────────────────────────────────────

const GM_CONTRACT_NAME = "GM";
const ARC_CHAIN_ID_LOCAL = 5042002;

export function getGMAddress(): string | null {
  // 1. Environment variable (set after manual deploy)
  const envAddr = process.env.NEXT_PUBLIC_GM_CONTRACT_ADDRESS;
  if (isValidAddress(envAddr)) return envAddr;

  // 2. localStorage (set after in-app deploy)
  return getContractAddress(ARC_CHAIN_ID_LOCAL, GM_CONTRACT_NAME);
}

export function saveGMAddress(address: string): void {
  setContractAddress(ARC_CHAIN_ID_LOCAL, GM_CONTRACT_NAME, address);
}
