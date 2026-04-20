// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GMNFT
 * @notice Milestone NFT rewards for FlowPay GM Streak system.
 *
 * Tiers:
 *   - 7  days → Bronze GM Badge
 *   - 30 days → Silver GM Badge
 *   - 90 days → Gold GM Badge
 *
 * Reads streak directly from GMCore — no trust required.
 * Each milestone can only be claimed once per address.
 * Anti-cheat: streak is enforced by GMCore on-chain.
 */

interface IGMCore {
    function streak(address user) external view returns (uint256);
}

contract GMNFT {

    // ── Events ────────────────────────────────────────────────────────────────

    event NFTClaimed(address indexed user, uint256 milestone, uint256 tokenId);

    // ── State ─────────────────────────────────────────────────────────────────

    IGMCore public immutable gmCore;

    /// @notice claimed[user][milestone] = true if already claimed
    mapping(address => mapping(uint256 => bool)) public claimed;

    /// @notice tokenId → owner
    mapping(uint256 => address) public ownerOf;

    /// @notice owner → balance
    mapping(address => uint256) public balanceOf;

    /// @notice tokenId → milestone tier
    mapping(uint256 => uint256) public tokenMilestone;

    uint256 private _nextTokenId = 1;

    string public name   = "FlowPay GM Badge";
    string public symbol = "GMBADGE";

    // ── Valid milestones ──────────────────────────────────────────────────────

    uint256 public constant MILESTONE_7  = 7;
    uint256 public constant MILESTONE_30 = 30;
    uint256 public constant MILESTONE_90 = 90;

    // ── Errors ────────────────────────────────────────────────────────────────

    error InvalidMilestone();
    error StreakTooLow(uint256 required, uint256 current);
    error AlreadyClaimed();

    // ── Constructor ───────────────────────────────────────────────────────────

    constructor(address _gmCore) {
        gmCore = IGMCore(_gmCore);
    }

    // ── Claim ─────────────────────────────────────────────────────────────────

    /**
     * @notice Claim a milestone NFT.
     * @param milestone Must be 7, 30, or 90.
     */
    function claim(uint256 milestone) external {
        // Validate milestone
        if (
            milestone != MILESTONE_7 &&
            milestone != MILESTONE_30 &&
            milestone != MILESTONE_90
        ) revert InvalidMilestone();

        // Check streak
        uint256 current = gmCore.streak(msg.sender);
        if (current < milestone) revert StreakTooLow(milestone, current);

        // Check not already claimed
        if (claimed[msg.sender][milestone]) revert AlreadyClaimed();

        // Mark claimed
        claimed[msg.sender][milestone] = true;

        // Mint
        uint256 tokenId = _nextTokenId++;
        ownerOf[tokenId]       = msg.sender;
        balanceOf[msg.sender] += 1;
        tokenMilestone[tokenId] = milestone;

        emit NFTClaimed(msg.sender, milestone, tokenId);
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    /**
     * @notice Returns claim status for all 3 milestones in one call.
     * @return eligible7  true if streak >= 7
     * @return eligible30 true if streak >= 30
     * @return eligible90 true if streak >= 90
     * @return claimed7   true if already claimed 7-day badge
     * @return claimed30  true if already claimed 30-day badge
     * @return claimed90  true if already claimed 90-day badge
     */
    function getClaimState(address user)
        external
        view
        returns (
            bool eligible7,
            bool eligible30,
            bool eligible90,
            bool claimed7,
            bool claimed30,
            bool claimed90
        )
    {
        uint256 s = gmCore.streak(user);
        eligible7  = s >= MILESTONE_7;
        eligible30 = s >= MILESTONE_30;
        eligible90 = s >= MILESTONE_90;
        claimed7   = claimed[user][MILESTONE_7];
        claimed30  = claimed[user][MILESTONE_30];
        claimed90  = claimed[user][MILESTONE_90];
    }

    /**
     * @notice Returns a metadata-style label for a token.
     */
    function tokenLabel(uint256 tokenId) external view returns (string memory) {
        uint256 m = tokenMilestone[tokenId];
        if (m == MILESTONE_7)  return "Bronze GM Badge - 7 Day Streak";
        if (m == MILESTONE_30) return "Silver GM Badge - 30 Day Streak";
        if (m == MILESTONE_90) return "Gold GM Badge - 90 Day Streak";
        return "GM Badge";
    }
}
