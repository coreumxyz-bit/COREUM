// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title Staking — CORS Staking for Node Weight
 * @notice Users stake CORS to increase their node's weight in the swarm consensus.
 * @dev Stakers earn a share of the Burn Pool proportional to their stake.
 */
contract Staking is Ownable, ReentrancyGuard {
    IERC28 public immutable cors;

    /// @notice Stake records per user
    struct Stake {
        uint256 amount;
        uint256 since;
        uint256 rewardDebt;
    }

    mapping(address => Stake) public stakes;

    /// @notice Total CORS staked in the contract
    uint256 public totalStaked;

    /// @notice Maximum staking cap (5% of max supply)
    uint256 public constant CAP = 5_000_000 * 1e18;

    /// @notice Reward per block per staked token (scaled by 1e12)
    uint256 public rewardPerBlock = 1e12; // ~0.000001 CORS per block per CORS staked

    /// @notice Last block when rewards were calculated
    uint256 public lastRewardBlock;

    /// @notice Accumulated reward per share (scaled by 1e12)
    uint256 public accRewardPerShare;

    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardPerBlockUpdated(uint256 previous, uint256 current);

    constructor(address _cors) Ownable(msg.sender) {
        cors = IERC20(_cors);
        lastRewardBlock = block.number;
    }

    /* ---------------------------------------------------------------
     * Modifiers
     * ------------------------------------------------------------- */

    modifier updateReward() {
        if (block.number > lastRewardBlock && totalStaked > 0) {
            uint256 blocks = block.number - lastRewardBlock;
            accRewardPerShare += (blocks * rewardPerBlock * 1e12) / totalStaked;
        }
        lastRewardBlock = block.number;
        _;
    }

    /* ---------------------------------------------------------------
     * Staking
     * ------------------------------------------------------------- */

    /// @notice Stake CORS tokens
    function stake(uint256 amount) external nonReentrant updateReward {
        require(amount > 0, "Staking: zero amount");
        require(totalStaked + amount <= CAP, "Staking: cap reached");

        Stake storage s = stakes[msg.sender];
        _payReward(msg.sender);

        s.amount += amount;
        s.since = block.timestamp;
        s.rewardDebt = (s.amount * accRewardPerShare) / 1e12;
        totalStaked += amount;

        require(cors.transferFrom(msg.sender, address(this), amount), "Staking: transfer failed");
        emit Staked(msg.sender, amount);
    }

    /// @notice Unstake CORS tokens
    function withdraw(uint256 amount) external nonReentrant updateReward {
        Stake storage s = stakes[msg.sender];
        require(s.amount >= amount, "Staking: insufficient balance");
        require(amount > 0, "Staking: zero amount");

        _payReward(msg.sender);

        s.amount -= amount;
        s.rewardDebt = (s.amount * accRewardPerShare) / 1e12;
        totalStaked -= amount;

        require(cors.transfer(msg.sender, amount), "Staking: transfer failed");
        emit Withdrawn(msg.sender, amount);
    }

    /* ---------------------------------------------------------------
     * Rewards
     * ------------------------------------------------------------- */

    /// @notice Calculate pending rewards for a user
    function pendingReward(address user) public view returns (uint256) {
        Stake storage s = stakes[user];
        if (s.amount == 0) return 0;

        uint256 currentAcc = accRewardPerShare;
        if (block.number > lastRewardBlock && totalStaked > 0) {
            uint256 blocks = block.number - lastRewardBlock;
            currentAcc += (blocks * rewardPerBlock * 1e12) / totalStaked;
        }

        return (s.amount * currentAcc) / 1e12 - s.rewardDebt;
    }

    /// @notice Claim accumulated rewards
    function claimReward() external nonReentrant updateReward {
        _payReward(msg.sender);
    }

    function _payReward(address user) internal {
        uint256 reward = (stakes[user].amount * accRewardPerShare) / 1e12 - stakes[user].rewardDebt;
        if (reward > 0) {
            stakes[user].rewardDebt = (stakes[user].amount * accRewardPerShare) / 1e12;
            require(cors.transfer(user, reward), "Staking: reward transfer failed");
            emit RewardPaid(user, reward);
        }
    }

    /* ---------------------------------------------------------------
     * Admin
     * ------------------------------------------------------------- */

    /// @notice Update reward rate per block (only owner)
    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        updateReward();
        emit RewardPerBlockUpdated(rewardPerBlock, _rewardPerBlock);
        rewardPerBlock = _rewardPerBlock;
    }
}
