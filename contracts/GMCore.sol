// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GMCore
 * @notice Daily GM check-in engine for FlowPay on Arc Testnet.
 *
 * Streak logic uses UTC days (block.timestamp / 1 days):
 *   - 1 GM per UTC day per address
 *   - Streak continues if GM'd on consecutive days
 *   - Streak resets to 1 if a day is skipped
 *
 * Anti-cheat: all logic is enforced on-chain.
 * Arc Testnet: USDC is the native gas token.
 *
 * Future extensions: leaderboard, token rewards, cross-chain sync.
 */
contract GMCore {

    // ── Events ────────────────────────────────────────────────────────────────

    event GM(address indexed user, uint256 streak, uint256 dayNumber);

    // ── State ─────────────────────────────────────────────────────────────────

    /// @notice Current streak per address
    mapping(address => uint256) public streak;

    /// @notice Last UTC day number the address GM'd (block.timestamp / 1 days)
    mapping(address => uint256) public lastGMDay;

    /// @notice Lifetime GM count per address
    mapping(address => uint256) public totalGMs;

    /// @notice Global GM count across all users
    uint256 public globalGMCount;

    // ── Errors ────────────────────────────────────────────────────────────────

    error AlreadyGMToday();

    // ── Core function ─────────────────────────────────────────────────────────

    /**
     * @notice Send your daily GM.
     *         One call per UTC day. Streak resets if a day is skipped.
     */
    function gm() external {
        uint256 today = block.timestamp / 1 days;
        uint256 last  = lastGMDay[msg.sender];

        // One GM per UTC day
        if (last == today) revert AlreadyGMToday();

        // Streak: continue if yesterday, reset otherwise
        if (last == today - 1) {
            streak[msg.sender] += 1;
        } else {
            streak[msg.sender] = 1;
        }

        lastGMDay[msg.sender] = today;
        totalGMs[msg.sender]  += 1;
        globalGMCount         += 1;

        emit GM(msg.sender, streak[msg.sender], today);
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    /**
     * @notice Returns true if the address can GM today (UTC).
     */
    function canGMToday(address user) external view returns (bool) {
        return lastGMDay[user] != block.timestamp / 1 days;
    }

    /**
     * @notice Returns all state for a user in one call.
     */
    function getUserState(address user)
        external
        view
        returns (
            uint256 currentStreak,
            uint256 lastDay,
            uint256 total,
            bool    canGM
        )
    {
        currentStreak = streak[user];
        lastDay       = lastGMDay[user];
        total         = totalGMs[user];
        canGM         = lastGMDay[user] != block.timestamp / 1 days;
    }
}
