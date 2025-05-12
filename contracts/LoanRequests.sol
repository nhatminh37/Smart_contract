// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "./UserManager.sol";

/**
 * @title LoanRequests
 * @dev Handles loan requests and offers
 */
contract LoanRequests is UserManager {
    /**
     * @dev Create a new loan request
     */
    function createLoanRequest(
        uint256 amount,
        uint256 durationDays,
        uint256 maxInterestRate,
        string memory purpose
    ) public payable onlyRegistered {
        require(amount > 0, "Loan amount must be greater than 0");
        require(durationDays > 0, "Loan duration must be greater than 0");
        require(msg.value > 0, "Collateral required");
        require(maxInterestRate >= 100, "Max interest rate must be at least 1%");
        
        uint256 collateralAmount = msg.value;
        
        // Calculate collateralization ratio (x100 for precision)
        uint256 collateralizationRatio = (collateralAmount * 100) / amount;
        
        // Update reputation data
        UserReputation storage reputation = userReputations[msg.sender];
        reputation.totalLoansRequested++;
        
        // Update average collateralization ratio
        if (reputation.totalLoansRequested == 1) {
            reputation.collateralizationRatio = collateralizationRatio;
        } else {
            uint256 total = reputation.collateralizationRatio * (reputation.totalLoansRequested - 1);
            reputation.collateralizationRatio = (total + collateralizationRatio) / reputation.totalLoansRequested;
        }
        
        // Create loan request - using the helper function for incrementing
        uint256 requestId = _incrementLoanRequestId();
        
        LoanRequest storage request = loanRequests[requestId];
        request.id = requestId;
        request.borrower = msg.sender;
        request.amount = amount;
        request.durationDays = durationDays;
        request.maxInterestRate = maxInterestRate;
        request.collateralAmount = collateralAmount;
        request.purpose = purpose;
        request.timestamp = block.timestamp;
        request.status = LoanRequestStatus.Active;
        request.bestOfferId = 0;
        
        // Add to user's loan requests
        userLoanRequests[msg.sender].push(requestId);
        
        emit LoanRequestCreated(requestId, msg.sender, amount, maxInterestRate);
    }
    
    /**
     * @dev Cancel a loan request and return collateral
     */
    function cancelLoanRequest(uint256 requestId) public loanRequestExists(requestId) {
        LoanRequest storage request = loanRequests[requestId];
        
        require(msg.sender == request.borrower, "Only borrower can cancel");
        require(request.status == LoanRequestStatus.Active, "Request not active");
        
        request.status = LoanRequestStatus.Cancelled;
        
        // Return collateral to borrower
        payable(request.borrower).transfer(request.collateralAmount);
        
        // Cancel all active offers for this request
        uint256[] storage offers = requestOffers[requestId];
        for (uint i = 0; i < offers.length; i++) {
            FundingOffer storage offer = fundingOffers[offers[i]];
            if (offer.status == OfferStatus.Active) {
                offer.status = OfferStatus.Cancelled;
                emit FundingOfferCancelled(offer.id);
            }
        }
        
        emit LoanRequestCancelled(requestId);
    }
    
    /**
     * @dev Check if a loan request has expired and update its status if needed
     */
    function checkLoanRequestExpiry(uint256 requestId) public loanRequestExists(requestId) returns (bool) {
        LoanRequest storage request = loanRequests[requestId];
        
        if (request.status != LoanRequestStatus.Active) {
            return false;
        }
        
        if (block.timestamp > request.timestamp + requestExpirationTime) {
            request.status = LoanRequestStatus.Expired;
            
            // Return collateral to borrower
            payable(request.borrower).transfer(request.collateralAmount);
            
            // Cancel all active offers for this request
            uint256[] storage offers = requestOffers[requestId];
            for (uint i = 0; i < offers.length; i++) {
                FundingOffer storage offer = fundingOffers[offers[i]];
                if (offer.status == OfferStatus.Active) {
                    offer.status = OfferStatus.Expired;
                }
            }
            
            emit LoanRequestExpired(requestId);
            return true;
        }
        
        return false;
    }
    
    /**
     * @dev Create a funding offer for a loan request
     */
    function createFundingOffer(uint256 requestId, uint256 interestRate) public onlyRegistered loanRequestExists(requestId) {
        LoanRequest storage request = loanRequests[requestId];
        
        require(request.status == LoanRequestStatus.Active, "Request not active");
        require(msg.sender != request.borrower, "Cannot fund own loan");
        require(interestRate <= request.maxInterestRate, "Interest rate too high");
        require(interestRate >= 100, "Interest rate must be at least 1%");
        
        // Check if the request is expired
        bool expired = checkLoanRequestExpiry(requestId);
        require(!expired, "Loan request has expired");
        
        // Create new funding offer - using the helper function for incrementing
        uint256 offerId = _incrementOfferId();
        
        FundingOffer storage offer = fundingOffers[offerId];
        offer.id = offerId;
        offer.requestId = requestId;
        offer.lender = msg.sender;
        offer.interestRate = interestRate;
        offer.timestamp = block.timestamp;
        offer.status = OfferStatus.Active;
        
        // Add to request's offers and user's offers
        requestOffers[requestId].push(offerId);
        userFundingOffers[msg.sender].push(offerId);
        
        // Update best offer if this is the lowest interest rate
        if (request.bestOfferId == 0 || 
            fundingOffers[request.bestOfferId].interestRate > interestRate ||
            fundingOffers[request.bestOfferId].status != OfferStatus.Active) {
            request.bestOfferId = offerId;
        }
        
        emit FundingOfferCreated(offerId, requestId, msg.sender, interestRate);
    }
    
    /**
     * @dev Cancel a funding offer
     */
    function cancelFundingOffer(uint256 offerId) public offerExists(offerId) {
        FundingOffer storage offer = fundingOffers[offerId];
        
        require(msg.sender == offer.lender, "Only lender can cancel");
        require(offer.status == OfferStatus.Active, "Offer not active");
        
        offer.status = OfferStatus.Cancelled;
        
        // Update best offer if needed
        LoanRequest storage request = loanRequests[offer.requestId];
        if (request.bestOfferId == offerId) {
            // Find new best offer
            uint256[] storage offers = requestOffers[offer.requestId];
            uint256 lowestRate = type(uint256).max;
            uint256 bestId = 0;
            
            for (uint i = 0; i < offers.length; i++) {
                FundingOffer storage checkOffer = fundingOffers[offers[i]];
                if (checkOffer.status == OfferStatus.Active && checkOffer.interestRate < lowestRate) {
                    lowestRate = checkOffer.interestRate;
                    bestId = checkOffer.id;
                }
            }
            
            request.bestOfferId = bestId;
        }
        
        emit FundingOfferCancelled(offerId);
    }
    
    /**
     * @dev Accept a funding offer and create a loan
     */
    function acceptFundingOffer(uint256 offerId) public offerExists(offerId) {
        FundingOffer storage offer = fundingOffers[offerId];
        LoanRequest storage request = loanRequests[offer.requestId];
        
        require(msg.sender == request.borrower, "Only borrower can accept");
        require(request.status == LoanRequestStatus.Active, "Request not active");
        require(offer.status == OfferStatus.Active, "Offer not active");
        
        // Update statuses
        request.status = LoanRequestStatus.Funded;
        offer.status = OfferStatus.Accepted;
        
        emit FundingOfferAccepted(offerId, offer.requestId);
        
        // Cancel all other active offers for this request
        uint256[] storage offers = requestOffers[offer.requestId];
        for (uint i = 0; i < offers.length; i++) {
            if (offers[i] != offerId) {
                FundingOffer storage otherOffer = fundingOffers[offers[i]];
                if (otherOffer.status == OfferStatus.Active) {
                    otherOffer.status = OfferStatus.Cancelled;
                    emit FundingOfferCancelled(otherOffer.id);
                }
            }
        }
    }
    
    /**
     * @dev Get active loan requests
     * @param offset Pagination offset
     * @param limit Maximum number of entries to return
     */
    function getActiveLoanRequests(uint256 offset, uint256 limit) public view returns (uint256[] memory) {
        uint256 totalRequests = _getLoanRequestCount();
        
        // Count active requests
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= totalRequests; i++) {
            if (loanRequests[i].status == LoanRequestStatus.Active) {
                activeCount++;
            }
        }
        
        // Apply pagination
        uint256 start = offset < activeCount ? offset : activeCount;
        uint256 end = (start + limit) < activeCount ? (start + limit) : activeCount;
        uint256 resultCount = end - start;
        
        // Collect active request IDs
        uint256[] memory result = new uint256[](resultCount);
        uint256 resultIndex = 0;
        uint256 skipCount = 0;
        
        for (uint256 i = 1; i <= totalRequests && resultIndex < resultCount; i++) {
            if (loanRequests[i].status == LoanRequestStatus.Active) {
                if (skipCount < start) {
                    skipCount++;
                } else {
                    result[resultIndex] = i;
                    resultIndex++;
                }
            }
        }
        
        return result;
    }
    
    /**
     * @dev Get all active loan requests
     */
    function getAllActiveLoanRequests() external view returns (uint256[] memory) {
        uint256 totalRequests = _getLoanRequestCount();
        uint256 activeCount = 0;
        
        // Count active requests
        for (uint256 i = 1; i <= totalRequests; i++) {
            if (loanRequests[i].status == LoanRequestStatus.Active) {
                activeCount++;
            }
        }
        
        // Collect active request IDs
        uint256[] memory result = new uint256[](activeCount);
        uint256 resultIndex = 0;
        
        for (uint256 i = 1; i <= totalRequests && resultIndex < activeCount; i++) {
            if (loanRequests[i].status == LoanRequestStatus.Active) {
                result[resultIndex] = i;
                resultIndex++;
            }
        }
        
        return result;
    }
} 