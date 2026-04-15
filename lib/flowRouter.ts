import { ARC_CHAIN_ID } from "./contracts";

export type RouteStep = "send" | "bridge";
export type TransferMode = "direct" | "cross-chain";

export interface FlowRoute {
  steps: RouteStep[];
  needsBridge: boolean;
  isArcOptimized: boolean;
  mode: TransferMode;
  label: string;
}

// Pure function — no side effects, no chain switching
// User controls source/dest; this just describes what will happen
export function determineRoute(
  sourceChainId: number,
  destChainId: number
): FlowRoute {
  const sameChain = sourceChainId === destChainId;
  const arcInvolved =
    sourceChainId === ARC_CHAIN_ID || destChainId === ARC_CHAIN_ID;

  if (sameChain) {
    return {
      steps: ["send"],
      needsBridge: false,
      isArcOptimized: arcInvolved,
      mode: "direct",
      label: arcInvolved ? "Direct send on Arc" : "Direct send",
    };
  }

  return {
    steps: ["bridge", "send"],
    needsBridge: true,
    isArcOptimized: arcInvolved,
    mode: "cross-chain",
    label: arcInvolved ? "Arc Optimized Bridge" : "Cross-chain Transfer",
  };
}

// 0.5% fee
export const FEE_BPS = 50;

export function calculateFee(amount: string): string {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return "0";
  return ((num * FEE_BPS) / 10000).toFixed(6);
}

export function amountAfterFee(amount: string): string {
  const num = parseFloat(amount);
  const fee = parseFloat(calculateFee(amount));
  if (isNaN(num) || isNaN(fee)) return "0";
  return (num - fee).toFixed(6);
}
