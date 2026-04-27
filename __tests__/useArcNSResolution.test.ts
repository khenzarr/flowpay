// Feature: arcns-name-sending
// Tests for hooks/useArcNSResolution.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fc, test as fcTest } from "@fast-check/vitest";
import { renderHook, act } from "@testing-library/react";
import { useArcNSResolution } from "../hooks/useArcNSResolution";
import { ARC_CHAIN_ID } from "../lib/chains";

const NON_ARC_CHAIN_ID = 11155111; // Sepolia
const VALID_ADDRESS = "0xabcdef1234567890abcdef1234567890abcdef12";

function mockFetch(response: object, status = 200) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      json: async () => response,
    })
  );
}

/** Advance fake timers past debounce and flush all pending promises. */
async function flushResolution() {
  await act(async () => {
    vi.advanceTimersByTime(500);
    // Flush microtasks / promise queue
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

// ── Non-Arc destination ───────────────────────────────────────────────────────

describe("useArcNSResolution — non-Arc destination", () => {
  it("returns idle immediately when destChainId is not Arc Testnet (Req 5.4)", () => {
    const { result } = renderHook(() =>
      useArcNSResolution("alice.arc", NON_ARC_CHAIN_ID)
    );
    expect(result.current.state).toBe("idle");
    expect(result.current.resolvedAddress).toBeNull();
  });

  it("never calls fetch when destChainId is not Arc Testnet", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    renderHook(() => useArcNSResolution("alice.arc", NON_ARC_CHAIN_ID));

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

// ── Debounce ──────────────────────────────────────────────────────────────────

describe("useArcNSResolution — debounce", () => {
  it("does not call fetch before 400ms (Req 2.8)", async () => {
    mockFetch({ status: "resolved", address: VALID_ADDRESS });
    const fetchSpy = vi.mocked(fetch);

    renderHook(() => useArcNSResolution("alice.arc", ARC_CHAIN_ID));

    await act(async () => {
      vi.advanceTimersByTime(300);
      await Promise.resolve();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls fetch exactly once after 400ms debounce (Req 2.8)", async () => {
    mockFetch({ status: "resolved", address: VALID_ADDRESS });
    const fetchSpy = vi.mocked(fetch);

    renderHook(() => useArcNSResolution("alice.arc", ARC_CHAIN_ID));

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});

// ── Stale result invalidation ─────────────────────────────────────────────────

describe("useArcNSResolution — stale result invalidation (Req 7.7)", () => {
  it("clears resolved state immediately when name changes", async () => {
    mockFetch({ status: "resolved", address: VALID_ADDRESS });

    const { result, rerender } = renderHook(
      ({ name }: { name: string }) =>
        useArcNSResolution(name, ARC_CHAIN_ID),
      { initialProps: { name: "alice.arc" } }
    );

    // Wait for resolution to complete
    await flushResolution();
    expect(result.current.state).toBe("resolved");
    expect(result.current.resolvedAddress).toBe(VALID_ADDRESS);

    // Change the name — state must reset to idle immediately (before debounce)
    mockFetch({ status: "resolved", address: VALID_ADDRESS });
    act(() => {
      rerender({ name: "bob.arc" });
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.resolvedAddress).toBeNull();
  });

  it("clears resolved state immediately when destChainId changes away from Arc (Req 2.10)", async () => {
    mockFetch({ status: "resolved", address: VALID_ADDRESS });

    const { result, rerender } = renderHook(
      ({ destChainId }: { destChainId: number }) =>
        useArcNSResolution("alice.arc", destChainId),
      { initialProps: { destChainId: ARC_CHAIN_ID } }
    );

    // Wait for resolution
    await flushResolution();
    expect(result.current.state).toBe("resolved");

    // Switch to non-Arc destination
    act(() => {
      rerender({ destChainId: NON_ARC_CHAIN_ID });
    });

    expect(result.current.state).toBe("idle");
    expect(result.current.resolvedAddress).toBeNull();
  });
});

// ── Resolution states ─────────────────────────────────────────────────────────

describe("useArcNSResolution — resolution states", () => {
  it("transitions to resolved with address on success", async () => {
    mockFetch({ status: "resolved", address: VALID_ADDRESS });

    const { result } = renderHook(() =>
      useArcNSResolution("alice.arc", ARC_CHAIN_ID)
    );

    await flushResolution();
    expect(result.current.state).toBe("resolved");
    expect(result.current.resolvedAddress).toBe(VALID_ADDRESS);
  });

  it("transitions to not_found when adapter returns not_found", async () => {
    mockFetch({ status: "not_found" });

    const { result } = renderHook(() =>
      useArcNSResolution("unknown.arc", ARC_CHAIN_ID)
    );

    await flushResolution();
    expect(result.current.state).toBe("not_found");
    expect(result.current.resolvedAddress).toBeNull();
  });

  it("stays idle for non-ArcNS input (plain text)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = renderHook(() =>
      useArcNSResolution("notaname", ARC_CHAIN_ID)
    );

    await act(async () => {
      vi.advanceTimersByTime(500);
      await Promise.resolve();
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.state).toBe("idle");
  });
});

// ── Property 5: Input change always resets resolution state to idle ───────────

// Feature: arcns-name-sending, Property 5: Input change always resets resolution state to idle
describe("Property 5: Input change always resets resolution state to idle", () => {
  fcTest.prop([
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.includes(".")),
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.includes(".")),
  ])(
    "changing name after resolution immediately resets to idle",
    async (label1, label2) => {
      if (label1 === label2) return;

      mockFetch({ status: "resolved", address: VALID_ADDRESS });

      const { result, rerender } = renderHook(
        ({ name }: { name: string }) =>
          useArcNSResolution(name, ARC_CHAIN_ID),
        { initialProps: { name: label1 + ".arc" } }
      );

      await flushResolution();
      expect(result.current.state).toBe("resolved");

      mockFetch({ status: "resolved", address: VALID_ADDRESS });
      act(() => {
        rerender({ name: label2 + ".arc" });
      });

      expect(result.current.state).toBe("idle");
      expect(result.current.resolvedAddress).toBeNull();

      vi.unstubAllGlobals();
    }
  );
});

// Feature: arcns-name-sending, Property 6: Non-Arc destination always yields idle resolution state
describe("Property 6: Non-Arc destination always yields idle resolution state", () => {
  fcTest.prop([
    fc.integer({ min: 1, max: 999999999 }).filter((id) => id !== ARC_CHAIN_ID),
    fc.string({ minLength: 1, maxLength: 10 }).filter((s) => !s.includes(".")),
  ])(
    "non-Arc destChainId always returns idle regardless of name",
    async (chainId, label) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const { result } = renderHook(() =>
        useArcNSResolution(label + ".arc", chainId)
      );

      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(result.current.state).toBe("idle");
      expect(result.current.resolvedAddress).toBeNull();
      expect(fetchSpy).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    }
  );
});
