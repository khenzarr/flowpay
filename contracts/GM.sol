// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title GM
 * @notice Daily GM check-in contract for Arc Testnet.
 *         One GM per address per cooldown period (default 23 hours).
 *         Emits a GM event that is indexable on-chain.
 *
 * @dev Arc Testnet uses USDC as native gas — no ETH required.
 *      Future extensions: streak tracking, leaderboard, cross-chain GM aggregation.
 */
contract GM {
    // ── Events ────────────────────────────────────────────────────────────────

    /// @notice Emitted when a user sends a GM
    event GMSent(address indexed user, uint256 timestamp, uint256 streak);

    // ── State ─────────────────────────────────────────────────────────────────

    /// @notice Timestamp of last GM per address
    mapping(address => uint256) public lastGM;

    /// @notice Current streak count per address
    mapping(address => uint256) public streakCount;

    /// @notice Total GMs sent by address (lifetime)
    mapping(address => uint256) public totalGMs;

    /// @notice Global GM count
    uint256 public totalGMCount;

    /// @notice Cooldown window — 23 hours so daily use is forgiving across timezones
    uint256 public constant COOLDOWN = 23 hours;

    // ── Errors ────────────────────────────────────────────────────────────────

    error CooldownActive(uint256 remainingSeconds);

    // ── Core function ─────────────────────────────────────────────────────────

    /**
     * @notice Send your daily GM on Arc.
     *         Enforces COOLDOWN between calls.
     *         Updates streak: resets if more than 48h since last GM.
     */
    function gm() external {
        uint256 last = lastGM[msg.sender];
        uint256 now_ = block.timestamp;

        // Enforce cooldown
        if (last != 0 && now_ - last < COOLDOWN) {
            revert CooldownActive(COOLDOWN - (now_ - last));
        }

        // Streak logic:
        // - If within 48h window since last GM → extend streak
        // - Otherwise → reset to 1
        uint256 current = streakCount[msg.sender];
        if (last == 0 || now_ - last >= 48 hours) {
            // First GM ever, or streak broken
            current = 1;
        } else {
            current += 1;
        }

        // Update state
        lastGM[msg.sender] = now_;
        streakCount[msg.sender] = current;
        totalGMs[msg.sender] += 1;
        totalGMCount += 1;

        emit GMSent(msg.sender, now_, current);
    }

    // ── View helpers ──────────────────────────────────────────────────────────

    /**
     * @notice Returns seconds remaining until the address can GM again.
     *         Returns 0 if cooldown has passed.
     */
    function cooldownRemaining(address user) external view returns (uint256) {
        uint256 last = lastGM[user];
        if (last == 0) return 0;
        uint256 elapsed = block.timestamp - last;
        if (elapsed >= COOLDOWN) return 0;
        return COOLDOWN - elapsed;
    }

    /**
     * @notice Returns full GM state for a user in one call.
     */
    function getUserState(address user)
        external
        view
        returns (
            uint256 last,
            uint256 streak,
            uint256 total,
            uint256 remaining
        )
    {
        last = lastGM[user];
        streak = streakCount[user];
        total = totalGMs[user];
        remaining = this.cooldownRemaining(user);
    }
}
