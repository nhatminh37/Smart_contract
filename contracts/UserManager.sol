// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./LendingAdmin.sol";

/**
 * @title UserManager
 * @dev Handles user registration and reputation
 */
contract UserManager is LendingAdmin {
    /**
     * @dev Register a new user on the platform
     */
    function registerUser() public {
        require(!userReputations[msg.sender].isRegistered, "Already registered");
        
        UserReputation storage reputation = userReputations[msg.sender];
        reputation.reputationScore = 50; // Start with a neutral score
        reputation.isRegistered = true;
        
        emit UserRegistered(msg.sender);
    }
    
    /**
     * @dev Get the recommended interest rate for a borrower based on reputation
     * @param borrowerAddress The address of the borrower
     * @return The recommended interest rate
     */
    function getRecommendedInterestRate(address borrowerAddress) public view returns (uint256) {
        UserReputation storage reputation = userReputations[borrowerAddress];
        
        if (!reputation.isRegistered) {
            return platformBaseRate; // Use base rate for unregistered users
        }
        
        // Calculate discount based on reputation score (0-100)
        // Higher score = lower interest rate
        // Maximum discount is maxReputationDiscount for a score of 100
        uint256 discountPerPoint = maxReputationDiscount / 100;
        uint256 discount = (reputation.reputationScore * discountPerPoint);
        
        // Ensure the interest rate doesn't go below 1%
        if (discount >= platformBaseRate - 100) {
            return 100; // 1% minimum
        }
        
        return platformBaseRate - discount;
    }
    
    /**
     * @dev Update user reputation after loan repayment or default
     * @param user The user whose reputation needs updating
     * @param isPositive Whether the update is positive (repayment) or negative (default)
     */
    function _updateReputation(address user, bool isPositive) internal {
        UserReputation storage reputation = userReputations[user];
        
        if (!reputation.isRegistered) {
            return;
        }
        
        reputation.totalTransactions++;
        
        // Adjust score - positive updates increase score, negative decrease it
        if (isPositive) {
            // Increase score, max 100
            reputation.reputationScore = reputation.reputationScore + 5 > 100 ? 100 : reputation.reputationScore + 5;
        } else {
            // Decrease score, min 0
            reputation.reputationScore = reputation.reputationScore < 10 ? 0 : reputation.reputationScore - 10;
        }
        
        emit ReputationUpdated(user, reputation.reputationScore);
    }
    
    /**
     * @dev Get user reputation data
     */
    function getUserReputation(address user) public view returns (
        uint256 reputationScore,
        uint256 totalLoansRequested,
        uint256 totalLoansFunded,
        uint256 loansRepaidOnTime,
        uint256 loansDefaulted,
        uint256 totalTransactions,
        uint256 collateralizationRatio,
        bool isRegistered
    ) {
        UserReputation storage reputation = userReputations[user];
        
        return (
            reputation.reputationScore,
            reputation.totalLoansRequested,
            reputation.totalLoansFunded,
            reputation.loansRepaidOnTime,
            reputation.loansDefaulted,
            reputation.totalTransactions,
            reputation.collateralizationRatio,
            reputation.isRegistered
        );
    }
} 