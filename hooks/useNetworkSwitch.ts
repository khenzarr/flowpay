"use client";

import { useCallback, useState } from "react";
import { useChainId, useSwitchChain } from "wagmi";
import { switchChain as metamaskSwitchChain } from "@/lib/txEngine";
import { SUPPORTED_CHAIN_IDS, ARC_CHAIN_ID } from "@/lib/wagmi";

export function useNetworkSwitch() {
  const chainId = useChainId();
  const { switchChain: wagmiSwitch } = useSwitchChain();
  const [switching, setSwitching] = useState(false);

  const isSupported = SUPPORTED_CHAIN_IDS.includes(chainId);

  const switchTo = useCallback(
    async (targetChainId: number) => {
      setSwitching(true);
      try {
        try {
          await wagmiSwitch({ chainId: targetChainId });
        } catch {
          await metamaskSwitchChain(targetChainId);
        }
      } finally {
        setSwitching(false);
      }
    },
    [wagmiSwitch]
  );

  return { chainId, isSupported, switching, switchTo };
}
