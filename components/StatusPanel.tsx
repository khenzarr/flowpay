"use client";

export type TxStatus =
  | { type: "idle" }
  | { type: "loading"; message: string }
  | {
      type: "success";
      txHash?: string;
      explorerUrl?: string;
      steps?: Array<{ name: string; state: string; txHash?: string; explorerUrl?: string; message?: string }>;
    }
  | { type: "error"; message: string };

interface StatusPanelProps {
  status: TxStatus;
  onReset?: () => void;
}

export function StatusPanel({ status, onReset }: StatusPanelProps) {
  if (status.type === "idle") return null;

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition-all ${
        status.type === "loading"
          ? "border-violet-500/20 bg-violet-500/5"
          : status.type === "success"
          ? "border-emerald-500/20 bg-emerald-500/5"
          : "border-red-500/20 bg-red-500/5"
      }`}
    >
      {/* Loading */}
      {status.type === "loading" && (
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-violet-400/40 border-t-violet-400 rounded-full animate-spin flex-shrink-0" />
          <p className="text-sm text-white/70">{status.message}</p>
        </div>
      )}

      {/* Success */}
      {status.type === "success" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-400">Transaction complete</p>
            </div>
            {onReset && (
              <button
                onClick={onReset}
                className="text-xs text-white/30 hover:text-white/60 transition-colors"
              >
                ✕ Close
              </button>
            )}
          </div>

          {status.steps && status.steps.length > 0 && (
            <div className="space-y-2 pl-1">
              {status.steps.map((step, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        step.state === "success"
                          ? "bg-emerald-400"
                          : step.state === "error"
                          ? "bg-red-400"
                          : "bg-white/20"
                      }`}
                    />
                    <span className="text-xs text-white/50 capitalize">{step.name}</span>
                    {step.message && (
                      <span className="text-xs text-white/25 truncate max-w-[140px]">
                        — {step.message}
                      </span>
                    )}
                  </div>
                  {step.explorerUrl && (
                    <a
                      href={step.explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex-shrink-0"
                    >
                      View ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Error */}
      {status.type === "error" && (
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-red-400 break-words">{status.message}</p>
          </div>
          {onReset && (
            <button
              onClick={onReset}
              className="text-xs text-white/30 hover:text-white/60 transition-colors flex-shrink-0"
            >
              ✕
            </button>
          )}
        </div>
      )}
    </div>
  );
}
