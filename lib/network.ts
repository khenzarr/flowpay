// ── Unified network utilities ─────────────────────────────────────────────────
// ALL chain detection and switching goes through here.
// Uses eth_chainId directly — never provider.getNetwork() (which caches).

import { getChainById, isSupportedChain, ARC_CHAIN_ID } from "./chains";

// ── Error codes ───────────────────────────────────────────────────────────────

export type NetworkErrorCode =
  | "WRONG_CHAIN"
  | "UNSUPPORTED_CHAIN"
  | "SWITCH_FAILED"
  | "SWITCH_REJECTED"
  | "NO_PROVIDER";

export class NetworkError extends Error {
  constructor(
    public code: NetworkErrorCode,
    message: string,
    public currentChainId?: number,
    public expectedChainId?: number
  ) {
    super(message);
    this.name = "NetworkError";
  }
}

// ── eth_chainId — the ONLY reliable way to get current chain from MetaMask ────

export async function getCurrentChainId(): Promise<number> {
  if (typeof window === "undefined")
    throw new NetworkError("NO_PROVIDER", "Not in browser");

  const eth = (window as any).ethereum;
  if (!eth)
    throw new NetworkError("NO_PROVIDER", "MetaMask not found. Please install MetaMask.");

  const hex: string = await eth.request({ method: "eth_chainId" });
  const id = parseInt(hex, 16);
  console.log("[Network] Current chainId:", id);
  return id;
}

// ── Validate wallet is on expected chain ──────────────────────────────────────

export async function assertChain(expectedChainId: number): Promise<void> {
  const current = await getCurrentChainId();
  console.log("[Network] assertChain — current:", current, "expected:", expectedChainId);

  if (current !== expectedChainId) {
    const currentName = getChainById(current)?.name ?? `chain ${current}`;
    const expectedName = getChainById(expectedChainId)?.name ?? `chain ${expectedChainId}`;
    throw new NetworkError(
      "WRONG_CHAIN",
      `Wallet is on ${currentName}. Please switch to ${expectedName} first.`,
      current,
      expectedChainId
    );
  }
}

// ── Switch chain (user-initiated only) ───────────────────────────────────────
// Tries wallet_switchEthereumChain first.
// Falls back to wallet_addEthereumChain if chain not in MetaMask.

export async function switchToChain(chainId: number): Promise<void> {
  if (typeof window === "undefined") return;

  const eth = (window as any).ethereum;
  if (!eth) throw new NetworkError("NO_PROVIDER", "MetaMask not found");

  const chain = getChainById(chainId);
  if (!chain)
    throw new NetworkError(
      "UNSUPPORTED_CHAIN",
      `Chain ${chainId} is not in the registry`
    );

  const hexId = "0x" + chainId.toString(16);
  console.log("[Network] Switching to", chain.name, `(${hexId})`);

  try {
    await eth.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: hexId }],
    });
    console.log("[Network] Switched to", chain.name);
  } catch (err: any) {
    // 4902 = chain not added yet; -32603 = some wallets use this instead
    if (err.code === 4902 || err.code === -32603) {
      console.log("[Network] Chain not found in wallet, adding:", chain.name);
      await eth.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: hexId,
            chainName: chain.name,
            nativeCurrency: chain.nativeCurrency,
            rpcUrls: [chain.rpcUrl],
            blockExplorerUrls: [chain.explorerUrl],
          },
        ],
      });
    } else if (err.code === 4001) {
      throw new NetworkError(
        "SWITCH_REJECTED",
        "Network switch rejected by user."
      );
    } else {
      throw new NetworkError("SWITCH_FAILED", err?.message ?? "Switch failed");
    }
  }
}
