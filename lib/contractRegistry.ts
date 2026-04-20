// ── Contract Registry ─────────────────────────────────────────────────────────
// Per-chain, per-name address storage.
// Priority: env var → localStorage → null

const STORAGE_PREFIX = "flowpay_contract_";
const ARC_CHAIN_ID = 5042002;

function storageKey(chainId: number, name: string): string {
  return `${STORAGE_PREFIX}${name}_${chainId}`;
}

export function isValidAddress(addr: unknown): addr is string {
  return typeof addr === "string" && /^0x[0-9a-fA-F]{40}$/.test(addr);
}

export function getContractAddress(chainId: number, name: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const stored = localStorage.getItem(storageKey(chainId, name));
    return isValidAddress(stored) ? stored : null;
  } catch {
    return null;
  }
}

export function setContractAddress(chainId: number, name: string, address: string): void {
  if (typeof window === "undefined") return;
  if (!isValidAddress(address)) return;
  try {
    localStorage.setItem(storageKey(chainId, name), address);
    console.log(`[registry] ${name} on chain ${chainId}:`, address);
  } catch {}
}

export function clearContractAddress(chainId: number, name: string): void {
  if (typeof window === "undefined") return;
  try { localStorage.removeItem(storageKey(chainId, name)); } catch {}
}

// ── GMCore ────────────────────────────────────────────────────────────────────

export function getGMCoreAddress(): string | null {
  const env = process.env.NEXT_PUBLIC_GM_CORE_ADDRESS;
  if (isValidAddress(env)) return env;
  return getContractAddress(ARC_CHAIN_ID, "GMCore");
}

export function saveGMCoreAddress(address: string): void {
  setContractAddress(ARC_CHAIN_ID, "GMCore", address);
}

// ── GMNFT ─────────────────────────────────────────────────────────────────────

export function getGMNFTAddress(): string | null {
  const env = process.env.NEXT_PUBLIC_GM_NFT_ADDRESS;
  if (isValidAddress(env)) return env;
  return getContractAddress(ARC_CHAIN_ID, "GMNFT");
}

export function saveGMNFTAddress(address: string): void {
  setContractAddress(ARC_CHAIN_ID, "GMNFT", address);
}

// ── Legacy GM (old single contract) — kept for backward compat ───────────────

export function getGMAddress(): string | null {
  // New system: GMCore takes precedence
  const core = getGMCoreAddress();
  if (core) return core;
  // Fallback: old single-contract env var
  const legacy = process.env.NEXT_PUBLIC_GM_CONTRACT_ADDRESS;
  if (isValidAddress(legacy)) return legacy;
  return getContractAddress(ARC_CHAIN_ID, "GM");
}

export function saveGMAddress(address: string): void {
  setContractAddress(ARC_CHAIN_ID, "GM", address);
}
