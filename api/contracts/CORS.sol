// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";

/**
 * @title CORS — Coreum Token
 * @notice Native token of the Coreum DePIN network.
 * @dev Minting is restricted to the RewardManager contract. Burning happens on fees.
 */
contract CORS is ERC20, ERC20Burnable, Ownable {
    /// @notice Maximum token supply: 100,000,000 CORS
    uint256 public constant MAX_SUPPLY = 100_000_000 * 1e18;

    /// @notice Contract allowed to mint rewards (RewardManager)
    address public rewardManager;

    event RewardManagerUpdated(address indexed previous, address indexed current);
    event MinterUpdated(address indexed previous, address indexed current);

    constructor(address _rewardManager)
        ERC20("Coreum", "CORS")
        Ownable(msg.sender)
    {
        rewardManager = _rewardManager;
    }

    /* ---------------------------------------------------------------
     * Minting
     * ------------------------------------------------------------- */

    /// @notice Mint new tokens (only RewardManager)
    function mint(address to, uint256 amount) external {
        require(msg.sender == rewardManager, "CORS: not reward manager");
        _mint(to, amount);
    }

    /* ---------------------------------------------------------------
     * Burn
     * ------------------------------------------------------------- */

    /// @notice Burn tokens from caller's balance
    function burn(uint256 amount) external override {
        _burn(msg.sender, amount);
    }

    /// @notice Burn tokens from a specific account (only owner)
    function burnFrom(address account, uint256 amount) external onlyOwner {
        _burn(account, amount);
    }

    /* ---------------------------------------------------------------
     * Admin
     * ------------------------------------------------------------- */

    /// @notice Set the RewardManager contract
    function setRewardManager(address _rewardManager) external onlyOwner {
        require(_rewardManager != address(0), "CORS: zero address");
        emit RewardManagerUpdated(rewardManager, _rewardManager);
        rewardManager = _rewardManager;
    }
}
