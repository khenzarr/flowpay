// ABI for GMCore.sol — daily GM streak engine
export const GM_CORE_ABI = [
  // Write
  "function gm() external",

  // Read
  "function streak(address user) view returns (uint256)",
  "function lastGMDay(address user) view returns (uint256)",
  "function totalGMs(address user) view returns (uint256)",
  "function globalGMCount() view returns (uint256)",
  "function canGMToday(address user) view returns (bool)",
  "function getUserState(address user) view returns (uint256 currentStreak, uint256 lastDay, uint256 total, bool canGM)",

  // Events
  "event GM(address indexed user, uint256 streak, uint256 dayNumber)",

  // Errors
  "error AlreadyGMToday()",
] as const;
