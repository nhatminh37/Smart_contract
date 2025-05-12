// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./TokenHandler.sol";

/**
 * @title LendingAdmin
 * @dev Handles admin-specific functionality
 */
contract LendingAdmin is TokenHandler {
    /**
     * @dev Update the platform base interest rate
     * @param newRate The new base rate (x100 for precision)
     */
    function updatePlatformBaseRate(uint256 newRate) external onlyAdmin {
        require(newRate >= 100, "Base rate must be at least 1%");
        platformBaseRate = newRate;
        emit PlatformBaseRateUpdated(newRate);
    }
    
    /**
     * @dev Update the platform fee percentage
     * @param newFeePercent The new fee percentage (x100 for precision)
     */
    function updatePlatformFee(uint256 newFeePercent) external onlyAdmin {
        require(newFeePercent <= 500, "Fee cannot exceed 5%");
        platformFeePercent = newFeePercent;
        emit PlatformFeeUpdated(newFeePercent);
    }
    
    /**
     * @dev Withdraw collected platform fees
     */
    function withdrawPlatformFees() external onlyAdmin {
        uint256 amount = collectedFees;
        require(amount > 0, "No fees to withdraw");
        
        collectedFees = 0;
        payable(adminAddress).transfer(amount);
        
        emit PlatformFeesWithdrawn(amount);
    }
    
    /**
     * @dev Update the admin address
     * @param newAdmin The new admin address
     */
    function updateAdminAddress(address newAdmin) external onlyOwner {
        require(newAdmin != address(0), "Invalid admin address");
        adminAddress = newAdmin;
        emit AdminAddressUpdated(newAdmin);
    }
    
    /**
     * @dev Get platform statistics
     */
    function getPlatformStats() external view returns (
        uint256 totalLoanRequests,
        uint256 totalFundedLoans,
        uint256 currentPlatformFee,
        uint256 platformFeesCollected
    ) {
        return (
            getLoanRequestCount(),
            getLoanCount(),
            platformFeePercent,
            collectedFees
        );
    }
    
    /**
     * @dev Get the current count of loan requests
     */
    function getLoanRequestCount() internal view returns (uint256) {
        return _getLoanRequestCount();
    }
    
    /**
     * @dev Get the current count of loans
     */
    function getLoanCount() internal view returns (uint256) {
        return _getLoanCount();
    }
} 