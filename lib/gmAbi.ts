// ABI for the GM contract on Arc Testnet
// Source: contracts/GM.sol

export const GM_ABI = [
  // ── Write ──────────────────────────────────────────────────────────────────
  "function gm() external",

  // ── Read ───────────────────────────────────────────────────────────────────
  "function lastGM(address user) view returns (uint256)",
  "function streakCount(address user) view returns (uint256)",
  "function totalGMs(address user) view returns (uint256)",
  "function totalGMCount() view returns (uint256)",
  "function cooldownRemaining(address user) view returns (uint256)",
  "function getUserState(address user) view returns (uint256 last, uint256 streak, uint256 total, uint256 remaining)",

  // ── Events ─────────────────────────────────────────────────────────────────
  "event GMSent(address indexed user, uint256 timestamp, uint256 streak)",

  // ── Errors ─────────────────────────────────────────────────────────────────
  "error CooldownActive(uint256 remainingSeconds)",
] as const;

export type GMAbi = typeof GM_ABI;
