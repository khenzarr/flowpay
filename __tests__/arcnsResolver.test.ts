// Feature: arcns-name-sending
// Tests for lib/arcnsResolver.ts

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fc, test as fcTest } from "@fast-check/vitest";
import {
  resolveArcNSName,
  isArcNSName,
  SUPPORTED_TLDS,
  type ArcNSResolutionResult,
} from "../lib/arcnsResolver";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function mockFetchNetworkError() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockRejectedValue(new TypeError("Failed to fetch"))
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ── isArcNSName ───────────────────────────────────────────────────────────────

describe("isArcNSName", () => {
  it("returns true for .arc names", () => {
    expect(isArcNSName("alice.arc")).toBe(true);
    expect(isArcNSName("test1.arc")).toBe(true);
  });

  it("returns true for .circle names", () => {
    expect(isArcNSName("alice.circle")).toBe(true);
  });

  it("returns false for 0x addresses", () => {
    expect(isArcNSName("0x1234567890abcdef1234567890abcdef12345678")).toBe(false);
  });

  it("returns false for unsupported TLDs", () => {
    expect(isArcNSName("alice.eth")).toBe(false);
    expect(isArcNSName("alice.ens")).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isArcNSName("")).toBe(false);
  });

  it("returns false for bare TLD with no label", () => {
    expect(isArcNSName(".arc")).toBe(false);
    expect(isArcNSName(".circle")).toBe(false);
  });
});

// ── Bugfix: arcns-response-mapping-fix ───────────────────────────────────────
// The live ArcNS adapter returns { status: "ok", address: "0x..." } for a
// successful resolution. The original switch only handled "resolved", causing
// "ok" to fall through to the default → adapter_unavailable.

describe("Bugfix arcns-response-mapping-fix: status:'ok' maps to resolved state", () => {
  it("returns resolved with address when adapter returns status:'ok' (confirmed live payload)", async () => {
    const addr = "0x0b943Fe9f1f8135e0751BA8B43dc0cD688ad209D";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        status: "ok",
        name: "ttttttt.arc",
        address: addr,
        owner: addr,
        expiry: null,
        source: "rpc",
      }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resolveArcNSName("ttttttt.arc");
    expect(result).toEqual({ state: "resolved", address: addr });
  });

  it("returns not_found when status:'ok' but address is missing", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok", name: "ttttttt.arc" }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resolveArcNSName("ttttttt.arc");
    expect(result).toEqual({ state: "not_found" });
  });

  it("returns not_found when status:'ok' but address is not a valid 0x address", async () => {
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "ok", address: "not-an-address" }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resolveArcNSName("ttttttt.arc");
    expect(result).toEqual({ state: "not_found" });
  });

  it("status:'resolved' still works (forward-compat)", async () => {
    const addr = "0xabcdef1234567890abcdef1234567890abcdef12";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "resolved", address: addr }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resolveArcNSName("alice.arc");
    expect(result).toEqual({ state: "resolved", address: addr });
  });
});

// ── Bugfix: arcns-request-construction-fix ────────────────────────────────────
// Regression test: fetch must be called with only the bare ArcNS name in the
// path segment, never with a pre-constructed URL as the name parameter.
// Bug condition: name passed to resolveArcNSName was the full URL, causing
// double-encoding: /resolve/name/https%3A%2F%2F...%2Fttttttt.arc

describe("Bugfix arcns-request-construction-fix: fetch URL contains only the bare name", () => {  it("calls fetch with the bare name in the path — not a pre-constructed URL (Req 2.1)", async () => {
    const addr = "0xabcdef1234567890abcdef1234567890abcdef12";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "resolved", address: addr }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await resolveArcNSName("ttttttt.arc");

    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const calledUrl: string = fetchSpy.mock.calls[0][0];

    // The path segment must be the bare name, not a percent-encoded URL
    expect(calledUrl).toBe(
      "https://arcns-app.vercel.app/api/v1/resolve/name/ttttttt.arc"
    );
    expect(calledUrl).not.toContain("%3A%2F%2F"); // must not contain encoded "://"
    expect(calledUrl).not.toContain("https%3A");  // must not contain encoded "https:"
  });

  it("path segment is only the name, not a double-encoded URL, for .circle names", async () => {
    const addr = "0xabcdef1234567890abcdef1234567890abcdef12";
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ status: "resolved", address: addr }),
    });
    vi.stubGlobal("fetch", fetchSpy);

    await resolveArcNSName("alice.circle");

    const calledUrl: string = fetchSpy.mock.calls[0][0];
    expect(calledUrl).toBe(
      "https://arcns-app.vercel.app/api/v1/resolve/name/alice.circle"
    );
    expect(calledUrl).not.toContain("%3A%2F%2F");
  });
});

// ── resolveArcNSName — example tests ─────────────────────────────────────────

describe("resolveArcNSName — example tests", () => {
  it("returns resolved with address when adapter returns success (Req 7.1)", async () => {
    const addr = "0xabcdef1234567890abcdef1234567890abcdef12";
    mockFetch({ status: "resolved", address: addr });
    const result = await resolveArcNSName("alice.arc");
    expect(result).toEqual({ state: "resolved", address: addr });
  });

  it("returns not_found when adapter returns not_found (Req 7.2)", async () => {
    mockFetch({ status: "not_found" });
    const result = await resolveArcNSName("unknown.arc");
    expect(result).toEqual({ state: "not_found" });
  });

  it("returns unsupported_tld without calling fetch for .eth names (Req 7.3)", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const result = await resolveArcNSName("alice.eth");
    expect(result).toEqual({ state: "unsupported_tld" });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns adapter_unavailable when fetch throws a network error (Req 7.4)", async () => {
    mockFetchNetworkError();
    const result = await resolveArcNSName("alice.arc");
    expect(result).toEqual({ state: "adapter_unavailable" });
  });

  it("returns invalid when adapter returns invalid (Req 7.5)", async () => {
    mockFetch({ status: "invalid" });
    const result = await resolveArcNSName("alice.arc");
    expect(result).toEqual({ state: "invalid" });
  });

  it("returns adapter_unavailable on HTTP 5xx", async () => {
    mockFetch({ error: "internal server error" }, 500);
    const result = await resolveArcNSName("alice.arc");
    expect(result).toEqual({ state: "adapter_unavailable" });
  });

  it("returns not_found when resolved address is not a valid 0x address", async () => {
    mockFetch({ status: "resolved", address: "not-an-address" });
    const result = await resolveArcNSName("alice.arc");
    expect(result).toEqual({ state: "not_found" });
  });

  it("returns adapter_unavailable when adapter returns malformed JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => { throw new SyntaxError("Unexpected token"); },
      })
    );
    const result = await resolveArcNSName("alice.arc");
    expect(result).toEqual({ state: "adapter_unavailable" });
  });
});

// ── Property-based tests ──────────────────────────────────────────────────────

// Feature: arcns-name-sending, Property 1: ArcNS name classification is mutually exclusive with valid 0x addresses
describe("Property 1: isArcNSName classification mutual exclusivity", () => {
  fcTest.prop([fc.stringMatching(/^[a-fA-F0-9]{40}$/)])(
    "valid 0x addresses are never classified as ArcNS names",
    (hex) => {
      const addr = "0x" + hex;
      expect(isArcNSName(addr)).toBe(false);
    }
  );

  fcTest.prop([
    fc.string({ minLength: 1, maxLength: 30 }).filter((s) => !s.includes(".")),
    fc.constantFrom(...SUPPORTED_TLDS),
  ])(
    "strings with supported TLD and non-empty label are classified as ArcNS names",
    (label, tld) => {
      expect(isArcNSName(label + tld)).toBe(true);
    }
  );
});

// Feature: arcns-name-sending, Property 2: Unsupported TLD never triggers a fetch
describe("Property 2: Unsupported TLD never triggers a fetch", () => {
  fcTest.prop([
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes(".")),
    fc.string({ minLength: 2, maxLength: 10 })
      .filter((s) => !s.includes("."))
      .map((s) => "." + s)
      .filter((tld) => !SUPPORTED_TLDS.includes(tld.toLowerCase())),
  ])(
    "unsupported TLD returns unsupported_tld without calling fetch",
    async (label, tld) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const result = await resolveArcNSName(label + tld);
      expect(result.state).toBe("unsupported_tld");
      expect(fetchSpy).not.toHaveBeenCalled();

      vi.unstubAllGlobals();
    }
  );
});

// Feature: arcns-name-sending, Property 3: Resolved address is always a valid 0x address
describe("Property 3: Resolved address is always a valid 0x address", () => {
  fcTest.prop([fc.stringMatching(/^[a-fA-F0-9]{40}$/)])(
    "resolved address matches /^0x[a-fA-F0-9]{40}$/",
    async (hex) => {
      const addr = "0x" + hex;
      mockFetch({ status: "resolved", address: addr });

      const result = await resolveArcNSName("alice.arc");
      expect(result.state).toBe("resolved");
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);

      vi.unstubAllGlobals();
    }
  );
});

// Feature: arcns-name-sending, Property 7: Resolver is idempotent for the same input and adapter response
describe("Property 7: Resolver idempotence", () => {
  fcTest.prop([
    fc.string({ minLength: 1, maxLength: 20 }).filter((s) => !s.includes(".")),
    fc.constantFrom(...SUPPORTED_TLDS),
    fc.stringMatching(/^[a-fA-F0-9]{40}$/),
  ])(
    "same name + same adapter response always returns same state and address",
    async (label, tld, hex) => {
      const addr = "0x" + hex;
      const name = label + tld;

      mockFetch({ status: "resolved", address: addr });
      const result1 = await resolveArcNSName(name);

      mockFetch({ status: "resolved", address: addr });
      const result2 = await resolveArcNSName(name);

      expect(result1.state).toBe(result2.state);
      expect(result1.address).toBe(result2.address);

      vi.unstubAllGlobals();
    }
  );
});
