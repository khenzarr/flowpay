import { ARC_CHAIN_ID } from "./contracts";

export type RouteStep = "send" | "bridge";

export interface FlowRoute {
  steps: RouteStep[];
  needsBridge: boolean;
  isArcOptimized: boolean; // true when Arc is source or destination
  label: string;           // human-readable route description
}

export function determineRoute(
  sourceChainId: number,
  destChainId: number
): FlowRoute {
  const sameChain = sourceChainId === destChainId;
  const arcInvolved = sourceChainId === ARC_CHAIN_ID || destChainId === ARC_CHAIN_ID;

  if (sameChain) {
    return {
      steps: ["send"],
      needsBridge: false,
      isArcOptimized: arcInvolved,
      label: arcInvolved ? "Direct send on Arc" : "Direct send",
    };
  }

  // Cross-chain: bridge + send on destination
  return {
    steps: ["bridge", "send"],
    needsBridge: true,
    isArcOptimized: arcInvolved,
    label: arcInvolved ? "Arc Optimized Bridge" : "Cross-chain Bridge",
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
