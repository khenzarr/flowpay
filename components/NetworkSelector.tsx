"use client";

import { CHAIN_LIST } from "@/lib/chains";

interface NetworkSelectorProps {
  label: string;
  selectedChainId: number;
  onChange: (chainId: number) => void;
  excludeChainId?: number;
}

export function NetworkSelector({ label, selectedChainId, onChange, excludeChainId }: NetworkSelectorProps) {
  const options = CHAIN_LIST.filter((c) => c.id !== excludeChainId);

  return (
    <div className="space-y-1.5">
      <label className="text-[11px] text-white/40 font-semibold uppercase tracking-widest">
        {label}
      </label>
      <div className="relative">
        <select
          value={selectedChainId}
          onChange={(e) => onChange(Number(e.target.value))}
          className="input-glow w-full bg-white/[0.04] border border-white/[0.08] focus:border-violet-500/50 rounded-xl px-4 py-3 text-sm text-white outline-none transition-all appearance-none cursor-pointer pr-10"
        >
          {options.map((chain) => (
            <option key={chain.id} value={chain.id}>
              {chain.name}
            </option>
          ))}
        </select>
        {/* Chevron */}
        <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-white/30">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}
