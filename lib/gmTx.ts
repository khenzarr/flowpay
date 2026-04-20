// GM transaction layer — calls GMCore.sol on Arc Testnet
// Contracts: GMCore (streak) + GMNFT (milestone rewards)

import { BrowserProvider, Contract, Interface } from "ethers";
import { ARC_CHAIN_ID } from "./chains";
import { getCurrentChainId, assertChain } from "./network";
import { GM_CORE_ABI } from "./gmCoreAbi";
import { GM_NFT_ABI }  from "./gmNftAbi";
import { getGMCoreAddress, getGMNFTAddress } from "./contractRegistry";

export { ARC_CHAIN_ID };
export { getCurrentChainId };

export const ARC_EXPLORER_TX = "https://testnet.arcscan.app/tx/";

// ── Error types ───────────────────────────────────────────────────────────────

export class GMContractNotDeployedError extends Error {
  code = "CONTRACT_NOT_DEPLOYED" as const;
  constructor() {
    super("GM contracts not deployed yet");
    this.name = "GMContractNotDeployedError";
  }
}

export class GMAlreadyTodayError extends Error {
  code = "ALREADY_GM_TODAY" as const;
  constructor() {
    super("Already GM'd today (UTC). Come back tomorrow!");
    this.name = "GMAlreadyTodayError";
  }
}

export class GMNFTAlreadyClaimedError extends Error {
  code = "ALREADY_CLAIMED" as const;
  constructor(public milestone: number) {
    super(`${milestone}-day badge already claimed`);
    this.name = "GMNFTAlreadyClaimedError";
  }
}

export class GMNFTStreakTooLowError extends Error {
  code = "STREAK_TOO_LOW" as const;
  constructor(public required: number, public current: number) {
    super(`Need ${required}-day streak to claim (current: ${current})`);
    this.name = "GMNFTStreakTooLowError";
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface GMTxResult {
  txHash: string;
  explorerUrl: string;
  streak?: number;
}

export interface GMClaimResult {
  txHash: string;
  explorerUrl: string;
  tokenId?: number;
  milestone: number;
}

export interface GMOnchainState {
  streak: number;
  lastGMDay: number;
  totalGMs: number;
  canGMToday: boolean;
}

export interface NFTClaimState {
  eligible7:  boolean;
  eligible30: boolean;
  eligible90: boolean;
  claimed7:   boolean;
  claimed30:  boolean;
  claimed90:  boolean;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getEth() {
  if (typeof window === "undefined") throw new Error("Not in browser");
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("MetaMask not found");
  return eth;
}

export function hasGMContracts(): boolean {
  return !!getGMCoreAddress();
}

// ── On-chain state readers ────────────────────────────────────────────────────

export async function getGMOnchainState(
  userAddress: string
): Promise<GMOnchainState | null> {
  const coreAddr = getGMCoreAddress();
  if (!coreAddr) return null;
  try {
    const provider = new BrowserProvider(getEth());
    const contract = new Contract(coreAddr, GM_CORE_ABI, provider);
    const [streak, lastDay, total, canGM] =
      await contract.getUserState(userAddress);
    return {
      streak:     Number(streak),
      lastGMDay:  Number(lastDay),
      totalGMs:   Number(total),
      canGMToday: Boolean(canGM),
    };
  } catch (e) {
    console.warn("[gmTx] getGMOnchainState failed:", e);
    return null;
  }
}

export async function getNFTClaimState(
  userAddress: string
): Promise<NFTClaimState | null> {
  const nftAddr = getGMNFTAddress();
  if (!nftAddr) return null;
  try {
    const provider = new BrowserProvider(getEth());
    const contract = new Contract(nftAddr, GM_NFT_ABI, provider);
    const [e7, e30, e90, c7, c30, c90] =
      await contract.getClaimState(userAddress);
    return {
      eligible7:  Boolean(e7),
      eligible30: Boolean(e30),
      eligible90: Boolean(e90),
      claimed7:   Boolean(c7),
      claimed30:  Boolean(c30),
      claimed90:  Boolean(c90),
    };
  } catch (e) {
    console.warn("[gmTx] getNFTClaimState failed:", e);
    return null;
  }
}

// ── Send GM ───────────────────────────────────────────────────────────────────

export async function sendGMTransaction(
  _userAddress: string
): Promise<GMTxResult> {
  const eth = getEth();
  const coreAddr = getGMCoreAddress();
  if (!coreAddr) throw new GMContractNotDeployedError();

  await assertChain(ARC_CHAIN_ID);

  const provider = new BrowserProvider(eth);
  const signer   = await provider.getSigner();
  const contract = new Contract(coreAddr, GM_CORE_ABI, signer);

  // Pre-flight: check canGMToday on-chain
  try {
    const signerAddr = await signer.getAddress();
    const can: boolean = await contract.canGMToday(signerAddr);
    if (!can) throw new GMAlreadyTodayError();
  } catch (e) {
    if (e instanceof GMAlreadyTodayError) throw e;
    console.warn("[gmTx] pre-flight check failed, proceeding:", e);
  }

  console.log("[gmTx] Calling GMCore.gm() on:", coreAddr);

  let tx: any;
  try {
    tx = await contract.gm({ gasLimit: 300_000 });
  } catch (e: any) {
    throw _parseCoreError(e, contract.interface);
  }

  let receipt: any;
  try {
    receipt = await tx.wait();
  } catch (e: any) {
    throw _parseCoreError(e, contract.interface);
  }

  if (!receipt || receipt.status !== 1) {
    throw new Error("GM transaction reverted on-chain");
  }

  // Parse streak from GM event
  let streak: number | undefined;
  for (const log of receipt.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "GM") {
        streak = Number(parsed.args[1]);
        break;
      }
    } catch {}
  }

  console.log("[gmTx] GM confirmed:", tx.hash, "streak:", streak);
  return { txHash: tx.hash, explorerUrl: ARC_EXPLORER_TX + tx.hash, streak };
}

// ── Claim NFT ─────────────────────────────────────────────────────────────────

export async function claimGMNFT(milestone: 7 | 30 | 90): Promise<GMClaimResult> {
  const eth = getEth();
  const nftAddr = getGMNFTAddress();
  if (!nftAddr) throw new GMContractNotDeployedError();

  await assertChain(ARC_CHAIN_ID);

  const provider = new BrowserProvider(eth);
  const signer   = await provider.getSigner();
  const contract = new Contract(nftAddr, GM_NFT_ABI, signer);

  console.log("[gmTx] Claiming GMNFT milestone:", milestone);

  let tx: any;
  try {
    tx = await contract.claim(milestone, { gasLimit: 300_000 });
  } catch (e: any) {
    throw _parseNFTError(e, contract.interface, milestone);
  }

  let receipt: any;
  try {
    receipt = await tx.wait();
  } catch (e: any) {
    throw _parseNFTError(e, contract.interface, milestone);
  }

  if (!receipt || receipt.status !== 1) {
    throw new Error("NFT claim reverted on-chain");
  }

  // Parse tokenId from NFTClaimed event
  let tokenId: number | undefined;
  for (const log of receipt.logs ?? []) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed?.name === "NFTClaimed") {
        tokenId = Number(parsed.args[2]);
        break;
      }
    } catch {}
  }

  console.log("[gmTx] NFT claimed:", tx.hash, "tokenId:", tokenId);
  return {
    txHash:      tx.hash,
    explorerUrl: ARC_EXPLORER_TX + tx.hash,
    tokenId,
    milestone,
  };
}

// ── Error parsers ─────────────────────────────────────────────────────────────

function _parseCoreError(raw: any, iface: Interface): Error {
  try {
    const data = raw?.data ?? raw?.error?.data;
    if (data && data !== "0x" && data.length >= 10) {
      const decoded = iface.parseError(data);
      if (decoded?.name === "AlreadyGMToday") return new GMAlreadyTodayError();
    }
  } catch {}
  if (raw?.code === 4001 || raw?.code === "ACTION_REJECTED")
    return new Error("Transaction rejected by user.");
  return new Error(raw?.reason ?? raw?.message ?? "GM transaction failed");
}

function _parseNFTError(raw: any, iface: Interface, milestone: number): Error {
  try {
    const data = raw?.data ?? raw?.error?.data;
    if (data && data !== "0x" && data.length >= 10) {
      const decoded = iface.parseError(data);
      if (decoded?.name === "AlreadyClaimed")
        return new GMNFTAlreadyClaimedError(milestone);
      if (decoded?.name === "StreakTooLow")
        return new GMNFTStreakTooLowError(Number(decoded.args[0]), Number(decoded.args[1]));
    }
  } catch {}
  if (raw?.code === 4001 || raw?.code === "ACTION_REJECTED")
    return new Error("Transaction rejected by user.");
  return new Error(raw?.reason ?? raw?.message ?? "NFT claim failed");
}
