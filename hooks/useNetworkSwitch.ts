"use client";

import { useCallback, useState } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { SUPPORTED_CHAIN_IDS, ARC_CHAIN_ID } from "@/lib/chains";
import { switchToChain } from "@/lib/network";

export function useNetworkSwitch() {
  const chainId = useChainId();
  const { switchChain: wagmiSwitch } = useSwitchChain();
  const [switching, setSwitching] = useState(false);

  const isSupported = SUPPORTED_CHAIN_IDS.includes(chainId);

  const switchTo = useCallback(
    async (targetChainId: number) => {
      setSwitching(true);
      try {
        // Try wagmi first (updates React state reactively)
        // Fall back to direct MetaMask call via network.ts
        try {
          await wagmiSwitch({ chainId: targetChainId });
        } catch {
          await switchToChain(targetChainId);
        }
      } finally {
        setSwitching(false);
      }
    },
    [wagmiSwitch]
  );

  return { chainId, isSupported, switching, switchTo, ARC_CHAIN_ID };
}
