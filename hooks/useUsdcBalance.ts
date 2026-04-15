"use client";

import { useEffect, useState, useCallback } from "react";
import { useAccount, useChainId } from "wagmi";
import { getUsdcBalance, getUsdcAddress } from "@/lib/txEngine";

export function useUsdcBalance() {
  const { address } = useAccount();
  const chainId = useChainId();
  const [balance, setBalance] = useState<string>("0");
  const [usdcAddress, setUsdcAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!address || !chainId) return;
    setLoading(true);
    try {
      const addr = await getUsdcAddress(chainId);
      setUsdcAddress(addr);
      if (addr) {
        const bal = await getUsdcBalance(chainId, address);
        setBalance(bal);
      } else {
        setBalance("0");
      }
    } catch (e) {
      console.error("[useUsdcBalance]", e);
    } finally {
      setLoading(false);
    }
  }, [address, chainId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, usdcAddress, loading, refresh };
}
