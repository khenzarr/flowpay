// GM transaction — calls GM.sol contract on Arc Testnet
// Contract: contracts/GM.sol  |  ABI: lib/gmAbi.ts
// Address resolution: env → localStorage (no crash if missing)

import { BrowserProvider, Contract, Interface } from "ethers";
import { ARC_CHAIN_ID } from "./chains";
import { getCurrentChainId, assertChain } from "./network";
import { GM_ABI } from "./gmAbi";
import { resolveGMAddress } from "./getGMContract";

export { ARC_CHAIN_ID };
export { getCurrentChainId };

export const ARC_EXPLORER_TX = "https://testnet.arcscan.app/tx/";

// ── Error types ───────────────────────────────────────────────────────────────

export class GMContractNotDeployedError extends Error {
  code = "CONTRACT_NOT_DEPLOYED" as const;
  constructor() {
    super("GM contract not deployed yet");
    this.name = "GMContractNotDeployedError";
  }
}

export class GMCooldownError extends Error {
  code = "COOLDOWN_ACTIVE" as const;
  constructor(public remainingSeconds: number) {
    const h = Math.floor(remainingSeconds / 3600);
    const m = Math.floor((remainingSeconds % 3600) / 60);
    super(
      `Cooldown active — ${h}h ${m}m remaining. Come back later!`
    );
    this.name = "GMCooldownError";
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GMTxResult {
  txHash: string;
  explorerUrl: string;
  streak?: number;
}

export interface GMOnchainState {
  lastGM: number;       // unix timestamp, 0 = never
  streak: number;
  totalGMs: number;
  cooldownSecs: number; // 0 = can GM now
}

// ── On-chain state reader ─────────────────────────────────────────────────────

export async function getGMOnchainState(
  userAddress: string
): Promise<GMOnchainState | null> {
  if (typeof window === "undefined") return null;
  const address = resolveGMAddress();
  if (!address) return null;

  try {
    const eth = (window as any).ethereum;
    if (!eth) return null;
    const provider = new BrowserProvider(eth);
    const contract = new Contract(address, GM_ABI, provider);
    const [last, streak, total, remaining] =
      await contract.getUserState(userAddress);
    return {
      lastGM: Number(last),
      streak: Number(streak),
      totalGMs: Number(total),
      cooldownSecs: Number(remaining),
    };
  } catch (e) {
    console.warn("[gmTx] getGMOnchainState failed:", e);
    return null;
  }
}

// ── Send GM ───────────────────────────────────────────────────────────────────

export async function sendGMTransaction(
  _userAddress: string
): Promise<GMTxResult> {
  if (typeof window === "undefined") throw new Error("Not in browser");

  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found");

  const contractAddress = resolveGMAddress();
  if (!contractAddress) throw new GMContractNotDeployedError();

  // Chain validation via eth_chainId
  await assertChain(ARC_CHAIN_ID);

  const provider = new BrowserProvider(eth);
  const signer = await provider.getSigner();
  const contract = new Contract(contractAddress, GM_ABI, signer);

  // ── Pre-flight: check cooldown on-chain before sending ────────────────────
  // Prevents wasted gas on a guaranteed revert
  try {
    const signerAddress = await signer.getAddress();
    const remaining: bigint = await contract.cooldownRemaining(signerAddress);
    if (remaining > 0n) {
      throw new GMCooldownError(Number(remaining));
    }
  } catch (e) {
    if (e instanceof GMCooldownError) throw e;
    // If the read fails (e.g. RPC error), proceed anyway — let the tx fail gracefully
    console.warn("[gmTx] cooldown pre-check failed, proceeding:", e);
  }

  console.log("[gmTx] Calling gm() on:", contractAddress);

  let tx: any;
  try {
    // Higher gas limit — Arc gas costs differ from Ethereum mainnet
    tx = await contract.gm({ gasLimit: 300_000 });
  } catch (e: any) {
    // MetaMask rejected or pre-execution revert (estimateGas failed)
    throw _parseGMError(e, contract.interface);
  }

  let receipt: any;
  try {
    receipt = await tx.wait();
  } catch (e: any) {
    // Transaction mined but reverted — parse custom error from receipt
    throw _parseGMError(e, contract.interface);
  }

  if (!receipt || receipt.status !== 1) {
    throw new Error("GM transaction reverted on-chain");
  }

  // Parse streak from GMSent event
  let streak: number | undefined;
  for (const log of receipt.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "GMSent") {
        streak = Number(parsed.args[2]);
        break;
      }
    } catch {}
  }

  console.log("[gmTx] GM confirmed:", tx.hash, "streak:", streak);
  return {
    txHash: tx.hash,
    explorerUrl: ARC_EXPLORER_TX + tx.hash,
    streak,
  };
}

// ── Error parser — decodes CooldownActive custom error ────────────────────────

function _parseGMError(raw: any, iface: Interface): Error {
  // Try to decode the CooldownActive(uint256) custom error
  try {
    const data: string | undefined =
      raw?.data ??
      raw?.error?.data ??
      raw?.transaction?.data ??
      raw?.receipt?.data;

    if (data && data !== "0x" && data.length >= 10) {
      const decoded = iface.parseError(data);
      if (decoded?.name === "CooldownActive") {
        return new GMCooldownError(Number(decoded.args[0]));
      }
    }
  } catch {
    // decoding failed — fall through
  }

  // User rejected
  if (raw?.code === 4001 || raw?.code === "ACTION_REJECTED") {
    return new Error("Transaction rejected by user.");
  }

  // Generic fallback with original message
  const msg: string = raw?.reason ?? raw?.message ?? "GM transaction failed";
  return new Error(msg);
}
