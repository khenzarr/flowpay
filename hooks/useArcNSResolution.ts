"use client";

import { useState, useEffect, useRef } from "react";
import { ARC_CHAIN_ID } from "@/lib/chains";
import {
  isArcNSName,
  resolveArcNSName,
  type ResolutionState,
} from "@/lib/arcnsResolver";

const DEBOUNCE_MS = 400;

export interface ArcNSResolutionHookResult {
  state: ResolutionState;
  resolvedAddress: string | null;
}

/**
 * Resolves an ArcNS name to a 0x address.
 * - Only active when destChainId === ARC_CHAIN_ID
 * - Debounces calls by 400ms
 * - Immediately resets to idle on name or destChainId change
 * - Cancels in-flight requests via AbortController
 */
export function useArcNSResolution(
  name: string,
  destChainId: number
): ArcNSResolutionHookResult {
  const [state, setState] = useState<ResolutionState>("idle");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);

  // Track the current abort controller so we can cancel in-flight requests
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    // Immediately reset on any change
    setState("idle");
    setResolvedAddress(null);

    // Cancel any in-flight request
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    // Gate: only resolve for Arc Testnet destination
    if (destChainId !== ARC_CHAIN_ID) return;

    // Gate: only resolve if input looks like an ArcNS name
    if (!isArcNSName(name)) return;

    // Debounce the resolution call
    const timer = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      setState("resolving");

      try {
        const result = await resolveArcNSName(name, controller.signal);
        // Discard if this request was superseded
        if (controller.signal.aborted) return;
        setState(result.state);
        setResolvedAddress(result.address ?? null);
      } catch {
        // AbortError from caller cancellation — discard silently
        if (!controller.signal.aborted) {
          setState("adapter_unavailable");
          setResolvedAddress(null);
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      if (abortRef.current) {
        abortRef.current.abort();
        abortRef.current = null;
      }
    };
  }, [name, destChainId]);

  return { state, resolvedAddress };
}
