// ABI for GMNFT.sol — milestone NFT rewards
export const GM_NFT_ABI = [
  // Write
  "function claim(uint256 milestone) external",

  // Read
  "function gmCore() view returns (address)",
  "function claimed(address user, uint256 milestone) view returns (bool)",
  "function ownerOf(uint256 tokenId) view returns (address)",
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenMilestone(uint256 tokenId) view returns (uint256)",
  "function tokenLabel(uint256 tokenId) view returns (string)",
  "function getClaimState(address user) view returns (bool eligible7, bool eligible30, bool eligible90, bool claimed7, bool claimed30, bool claimed90)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",

  // Constants
  "function MILESTONE_7() view returns (uint256)",
  "function MILESTONE_30() view returns (uint256)",
  "function MILESTONE_90() view returns (uint256)",

  // Events
  "event NFTClaimed(address indexed user, uint256 milestone, uint256 tokenId)",

  // Errors
  "error InvalidMilestone()",
  "error StreakTooLow(uint256 required, uint256 current)",
  "error AlreadyClaimed()",
] as const;
