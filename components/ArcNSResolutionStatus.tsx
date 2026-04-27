"use client";

import React from "react";
import type { ResolutionState } from "@/lib/arcnsResolver";

interface ArcNSResolutionStatusProps {
  state: ResolutionState;
  resolvedAddress: string | null;
  enteredName: string;
}

export function ArcNSResolutionStatus({
  state,
  resolvedAddress,
  enteredName,
}: ArcNSResolutionStatusProps): React.ReactElement | null {
  if (state === "idle") return null;

  if (state === "resolving") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-white/40">
        <span className="w-3 h-3 border border-white/30 border-t-white/70 rounded-full animate-spin flex-shrink-0" />
        <span>Resolving…</span>
      </div>
    );
  }

  if (state === "resolved" && resolvedAddress) {
    return (
      <div className="space-y-0.5">
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <span className="flex-shrink-0">✓</span>
          <span className="font-mono break-all">{resolvedAddress}</span>
        </div>
        <p className="text-[10px] text-white/25 pl-4">
          Funds will be sent to this address for <span className="text-white/40">{enteredName}</span>
        </p>
      </div>
    );
  }

  const errorMessages: Partial<Record<ResolutionState, string>> = {
    not_found: "This ArcNS name does not currently resolve to a wallet address.",
    unsupported_tld: "Unsupported name — use .arc or .circle",
    invalid: "Invalid ArcNS name",
    adapter_unavailable: "Name service unavailable — try again or use a 0x address",
  };

  const message = errorMessages[state];
  if (!message) return null;

  return (
    <p className="text-xs text-red-400/80 flex items-center gap-1">
      <span className="flex-shrink-0">⚠</span>
      <span>{message}</span>
    </p>
  );
}
