// ArcNS name resolution — FlowPay integration
// Uses the live ArcNS public adapter as an external HTTP dependency.
// No ArcNS protocol logic is re-implemented here.

const ARCNS_ADAPTER_BASE = "https://arcns-app.vercel.app/api/v1";
const RESOLUTION_TIMEOUT_MS = 10_000;

export type ResolutionState =
  | "idle"
  | "resolving"
  | "resolved"
  | "zero_address"
  | "not_found"
  | "invalid"
  | "unsupported_tld"
  | "adapter_unavailable";

export interface ArcNSResolutionResult {
  state: ResolutionState;
  address?: string; // present only when state === 'resolved'
}

export const SUPPORTED_TLDS: string[] = [".arc", ".circle"];

/** Returns true if the input looks like an ArcNS name (non-empty label + supported TLD). */
export function isArcNSName(input: string): boolean {
  if (!input) return false;
  const lower = input.toLowerCase();
  return SUPPORTED_TLDS.some((tld) => {
    if (!lower.endsWith(tld)) return false;
    const label = input.slice(0, input.length - tld.length);
    return label.length > 0;
  });
}

/** Adapter response shape (inferred from ArcNS public adapter). */
interface AdapterResponse {
  // The live adapter returns "ok" for a successful resolution;
  // "resolved" is kept for forward-compatibility.
  status: "ok" | "resolved" | "not_found" | "invalid" | "unsupported_tld";
  address?: string;
}

/**
 * Resolves an ArcNS name to a 0x wallet address via the ArcNS public adapter.
 * Never throws — always returns a typed ArcNSResolutionResult.
 * Accepts an optional AbortSignal for caller-controlled cancellation.
 */
export async function resolveArcNSName(
  name: string,
  signal?: AbortSignal
): Promise<ArcNSResolutionResult> {
  // Validate TLD before making any network request
  if (!isArcNSName(name)) {
    const lower = name.toLowerCase();
    const hasDot = lower.lastIndexOf(".") > 0;
    if (hasDot) {
      return { state: "unsupported_tld" };
    }
    return { state: "invalid" };
  }

  // Merge caller signal with a hard timeout
  const timeoutSignal = AbortSignal.timeout(RESOLUTION_TIMEOUT_MS);
  const combinedSignal =
    signal
      ? AbortSignal.any([signal, timeoutSignal])
      : timeoutSignal;

  try {
    const url = `${ARCNS_ADAPTER_BASE}/resolve/name/${encodeURIComponent(name)}`;
    const response = await fetch(url, { signal: combinedSignal });

    if (!response.ok) {
      return { state: "adapter_unavailable" };
    }

    let data: AdapterResponse;
    try {
      data = await response.json();
    } catch {
      return { state: "adapter_unavailable" };
    }

    switch (data.status) {
      case "ok":
      case "resolved": {
        const addr = data.address ?? "";
        // Guard: resolved address must be a valid 0x address
        if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) {
          return { state: "not_found" };
        }
        // Guard: zero address means "no receiving address set"
        if (addr === "0x0000000000000000000000000000000000000000") {
          return { state: "zero_address" };
        }
        return { state: "resolved", address: addr };
      }
      case "not_found":
        return { state: "not_found" };
      case "invalid":
        return { state: "invalid" };
      case "unsupported_tld":
        return { state: "unsupported_tld" };
      default:
        return { state: "adapter_unavailable" };
    }
  } catch (err: unknown) {
    // Caller-initiated abort (name changed) — propagate so hook can discard
    if (err instanceof Error && err.name === "AbortError") {
      // Check if it was the timeout signal that fired
      if (timeoutSignal.aborted) {
        return { state: "adapter_unavailable" };
      }
      // Caller cancelled — re-throw so the hook can ignore the result
      throw err;
    }
    return { state: "adapter_unavailable" };
  }
}
