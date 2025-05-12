// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LoanToken.sol";
import "./LendingCore.sol";

/**
 * @title TokenHandler
 * @dev Handles token-related functionality
 */
contract TokenHandler is LendingCore {
    // Token for loans
    LoanToken public loanToken;
    bool public usingToken = false;
    
    event TokenModeEnabled(address indexed tokenAddress);
    event TokenModeDisabled();
    
    /**
     * @dev Enable token mode with a specific LoanToken
     * @param tokenAddress The address of the LoanToken contract
     */
    function enableTokenMode(address tokenAddress) external onlyAdmin {
        require(tokenAddress != address(0), "Invalid token address");
        loanToken = LoanToken(tokenAddress);
        usingToken = true;
        emit TokenModeEnabled(tokenAddress);
    }
    
    /**
     * @dev Disable token mode
     */
    function disableTokenMode() external onlyAdmin {
        usingToken = false;
        emit TokenModeDisabled();
    }
    
    /**
     * @dev Transfer tokens from sender to recipient
     * @param from The sender address
     * @param to The recipient address
     * @param amount The amount to transfer
     */
    function _transferTokens(address from, address to, uint256 amount) internal {
        require(usingToken, "Token mode not enabled");
        require(loanToken.allowance(from, address(this)) >= amount, "Insufficient token allowance");
        loanToken.transferFrom(from, to, amount);
    }
} 