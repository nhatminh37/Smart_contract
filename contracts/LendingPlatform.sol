// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./LoanToken.sol";
import "./LoanRequests.sol";

/**
 * @title LendingPlatform
 * @dev A peer-to-peer decentralized lending platform with reputation scoring and competitive lending
 */
contract LendingPlatform is Ownable, ReentrancyGuard, LoanRequests {
    // No constructor - we will use the constructor from the parent contracts
} 