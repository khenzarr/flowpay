// Bugfix: arc-native-decimal-fix
// Arc native USDC uses 18 decimals for the value field in sendTransaction.
// Previously usdcDecimals was 6, causing amounts to be 10^12 times too small.

import { describe, it, expect } from "vitest";
import { parseUnits, formatUnits } from "ethers";
import { CHAINS, getChainById, ARC_CHAIN_ID } from "../lib/chains";

// ── Chain config assertions ───────────────────────────────────────────────────

describe("Arc chain config — native decimal fix", () => {
  it("Arc usdcDecimals is 18 (native value field)", () => {
    expect(CHAINS.arc.usdcDecimals).toBe(18);
  });

  it("Arc nativeCurrency.decimals is 18", () => {
    expect(CHAINS.arc.nativeCurrency.decimals).toBe(18);
  });

  it("getChainById returns Arc with usdcDecimals 18", () => {
    const chain = getChainById(ARC_CHAIN_ID);
    expect(chain?.usdcDecimals).toBe(18);
  });

  it("non-Arc chains retain usdcDecimals 6", () => {
    // Sepolia ERC-20 USDC stays at 6
    expect(CHAINS.sepolia.usdcDecimals).toBe(6);
  });
});

// ── Amount encoding assertions ────────────────────────────────────────────────

describe("Arc native amount encoding — parseUnits with 18 decimals", () => {
  it("1 USDC encodes to 1e18 with 18 decimals (correct)", () => {
    const arc = CHAINS.arc;
    const encoded = parseUnits("1", arc.usdcDecimals);
    expect(encoded).toBe(1_000_000_000_000_000_000n);
  });

  it("0.995 USDC encodes to 995000000000000000n with 18 decimals", () => {
    const arc = CHAINS.arc;
    const encoded = parseUnits("0.995", arc.usdcDecimals);
    expect(encoded).toBe(995_000_000_000_000_000n);
  });

  it("0.005 USDC fee encodes to 5000000000000000n with 18 decimals", () => {
    const arc = CHAINS.arc;
    const encoded = parseUnits("0.005", arc.usdcDecimals);
    expect(encoded).toBe(5_000_000_000_000_000n);
  });

  it("regression: 6-decimal encoding of 0.995 would have been 995000 (wrong — 10^12 too small)", () => {
    // This is what the bug produced — kept as documentation
    const buggyEncoded = parseUnits("0.995", 6);
    expect(buggyEncoded).toBe(995_000n);
    // Correct 18-decimal value is 10^12 times larger
    const correctEncoded = parseUnits("0.995", 18);
    expect(correctEncoded / buggyEncoded).toBe(1_000_000_000_000n);
  });

  it("formatUnits with 18 decimals round-trips correctly for balance display", () => {
    // Simulates getUsdcBalance reading Arc native balance
    const rawBalance = 1_500_000_000_000_000_000n; // 1.5 USDC at 18 decimals
    const displayed = formatUnits(rawBalance, 18);
    expect(displayed).toBe("1.5");
  });
});
