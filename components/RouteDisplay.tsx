"use client";

type RouteStep = "send" | "bridge";

interface RouteDisplayProps {
  route: RouteStep[];
  sourceChain: string;
  destChain: string;
  amount: string;
  receiveAmount: string;
  isArcOptimized?: boolean;
  routeLabel?: string;
}

const STEP_CONFIG: Record<RouteStep, { label: string; icon: string; bg: string; text: string; border: string }> = {
  bridge: {
    label: "Bridge",
    icon: "⬡",
    bg: "bg-blue-500/10",
    text: "text-blue-300",
    border: "border-blue-500/20",
  },
  send: {
    label: "Send",
    icon: "→",
    bg: "bg-emerald-500/10",
    text: "text-emerald-300",
    border: "border-emerald-500/20",
  },
};

export function RouteDisplay({
  route,
  sourceChain,
  destChain,
  amount,
  receiveAmount,
  isArcOptimized,
  routeLabel,
}: RouteDisplayProps) {
  if (!route.length) return null;

  return (
    <div className={`rounded-xl border p-4 space-y-3 ${
      isArcOptimized
        ? "border-violet-500/20 bg-violet-500/[0.04]"
        : "border-white/[0.07] bg-white/[0.02]"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-white/30 uppercase tracking-[0.15em] font-semibold">
          Route
        </p>
        {isArcOptimized && (
          <span className="flex items-center gap-1 text-[10px] text-violet-400/80 bg-violet-500/10 border border-violet-500/20 rounded-full px-2 py-0.5">
            <span>⚡</span>
            <span>Arc Optimized</span>
          </span>
        )}
      </div>

      {/* Flow */}
      <div className="flex items-center gap-2">
        {/* Source */}
        <div className="flex-shrink-0 text-center min-w-[60px]">
          <p className="text-[10px] text-white/30 mb-1">You send</p>
          <p className="text-sm font-bold text-white">{amount}</p>
          <p className="text-[10px] text-white/40 mt-0.5">USDC</p>
          <p className="text-[10px] text-white/30">{sourceChain}</p>
        </div>

        {/* Steps */}
        <div className="flex-1 flex items-center justify-center gap-1 overflow-hidden">
          <div className="h-px flex-1 bg-white/[0.08]" />
          {route.map((step, i) => {
            const cfg = STEP_CONFIG[step];
            return (
              <div key={i} className="flex items-center gap-1 flex-shrink-0">
                <div className={`flex items-center gap-1 ${cfg.bg} border ${cfg.border} rounded-full px-2 py-0.5`}>
                  <span className={`text-xs ${cfg.text}`}>{cfg.icon}</span>
                  <span className={`text-[11px] font-semibold ${cfg.text}`}>{cfg.label}</span>
                </div>
                {i < route.length - 1 && (
                  <span className="text-white/20 text-xs">›</span>
                )}
              </div>
            );
          })}
          <div className="h-px flex-1 bg-white/[0.08]" />
        </div>

        {/* Destination */}
        <div className="flex-shrink-0 text-center min-w-[60px]">
          <p className="text-[10px] text-white/30 mb-1">They receive</p>
          <p className="text-sm font-bold text-emerald-400">≈ {receiveAmount}</p>
          <p className="text-[10px] text-white/40 mt-0.5">USDC</p>
          <p className="text-[10px] text-white/30">{destChain}</p>
        </div>
      </div>

      {/* Route label */}
      {routeLabel && (
        <p className="text-[10px] text-white/25 text-center">{routeLabel}</p>
      )}
    </div>
  );
}
