// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title LendingPlatform
 * @dev A peer-to-peer decentralized lending platform with reputation scoring and competitive lending
 */
contract LendingPlatform is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    // Counters for IDs
    Counters.Counter private _loanRequestIds;
    Counters.Counter private _loanIds;
    Counters.Counter private _offerIds;
    
    // Status enums
    enum LoanRequestStatus { Active, Funded, Cancelled, Expired }
    enum LoanStatus { Active, Repaid, Defaulted }
    enum OfferStatus { Active, Accepted, Cancelled, Expired }
    
    // User reputation data
    struct UserReputation {
        uint256 reputationScore;       // Score from 0-100, starts at 50
        uint256 totalLoansRequested;   // Total loan requests created
        uint256 totalLoansFunded;      // Total loans funded (as lender)
        uint256 loansRepaidOnTime;     // Loans repaid on time (as borrower)
        uint256 loansDefaulted;        // Loans defaulted (as borrower)
        uint256 totalTransactions;     // Total transaction count
        uint256 collateralizationRatio; // Average collateralization ratio (x100 for precision)
        bool isRegistered;             // Whether user is registered
    }
    
    // Platform settings
    uint256 public platformBaseRate = 500;  // 5.00% base interest rate (x100 for precision)
    uint256 public maxReputationDiscount = 400; // Maximum discount of 4.00% for perfect reputation
    uint256 public requestExpirationTime = 7 days;
    uint256 public offerExpirationTime = 2 days;
    uint256 public platformFeePercent = 100; // 1.00% fee per loan (x100 for precision)
    uint256 public collectedFees = 0; // Total fees collected by the platform
    
    // Loan request structure
    struct LoanRequest {
        uint256 id;
        address borrower;
        uint256 amount;
        uint256 durationDays;
        uint256 maxInterestRate;       // Maximum interest rate borrower is willing to accept
        uint256 collateralAmount;      // Amount of collateral provided
        string purpose;                // Purpose of the loan
        uint256 timestamp;             // When the request was created
        LoanRequestStatus status;      // Status of the loan request
        uint256 bestOfferId;           // ID of the best offer (lowest interest rate)
    }
    
    // Funding offer structure
    struct FundingOffer {
        uint256 id;
        uint256 requestId;             // The loan request ID
        address lender;
        uint256 interestRate;          // Offered interest rate (per year, x100 for precision)
        uint256 timestamp;             // When the offer was made
        OfferStatus status;            // Status of the offer
    }
    
    // Active loan structure
    struct Loan {
        uint256 id;
        uint256 requestId;             // The original request ID
        address borrower;
        address lender;
        uint256 amount;
        uint256 interestRate;          // Interest rate (per year, x100 for precision)
        uint256 collateralAmount;      // Collateral amount
        uint256 startTime;             // When the loan started
        uint256 endTime;               // When the loan is due
        uint256 repaidAmount;          // Amount repaid so far
        LoanStatus status;             // Status of the loan
    }
    
    // Mappings
    mapping(address => UserReputation) public userReputations;
    mapping(uint256 => LoanRequest) public loanRequests;
    mapping(uint256 => Loan) public loans;
    mapping(uint256 => FundingOffer) public fundingOffers;
    mapping(uint256 => uint256[]) public requestOffers; // requestId => offerIds[]
    mapping(address => uint256[]) public userLoanRequests; // borrower => requestIds[]
    mapping(address => uint256[]) public userFundingOffers; // lender => offerIds[]
    
    // Events
    event UserRegistered(address indexed user);
    event ReputationUpdated(address indexed user, uint256 newScore);
    event LoanRequestCreated(uint256 indexed requestId, address indexed borrower, uint256 amount, uint256 maxInterestRate);
    event LoanRequestCancelled(uint256 indexed requestId);
    event LoanRequestExpired(uint256 indexed requestId);
    event FundingOfferCreated(uint256 indexed offerId, uint256 indexed requestId, address indexed lender, uint256 interestRate);
    event FundingOfferCancelled(uint256 indexed offerId);
    event FundingOfferAccepted(uint256 indexed offerId, uint256 indexed requestId);
    event LoanFunded(uint256 indexed loanId, uint256 indexed requestId, address indexed lender, address borrower, uint256 amount, uint256 interestRate);
    event LoanRepaid(uint256 indexed loanId, uint256 amount);
    event LoanDefaulted(uint256 indexed loanId);
    event CollateralReturned(uint256 indexed loanId, address borrower, uint256 amount);
    event CollateralClaimed(uint256 indexed loanId, address lender, uint256 amount);
    event PlatformBaseRateUpdated(uint256 newRate);
    event PlatformFeeUpdated(uint256 newFeePercent);
    event PlatformFeesWithdrawn(uint256 amount);
    event PlatformFeeCollected(uint256 loanId, uint256 feeAmount);
    
    constructor() Ownable(msg.sender) {}
    
    // Modifiers
    modifier onlyRegistered() {
        require(userReputations[msg.sender].isRegistered, "User not registered");
        _;
    }
    
    modifier loanRequestExists(uint256 requestId) {
        require(requestId > 0 && requestId <= _loanRequestIds.current(), "Loan request does not exist");
        _;
    }
    
    modifier loanExists(uint256 loanId) {
        require(loanId > 0 && loanId <= _loanIds.current(), "Loan does not exist");
        _;
    }
    
    modifier offerExists(uint256 offerId) {
        require(offerId > 0 && offerId <= _offerIds.current(), "Funding offer does not exist");
        _;
    }
    
    // User registration and reputation management
    /**
     * @dev Register a new user on the platform
     */
    function registerUser() public {
        require(!userReputations[msg.sender].isRegistered, "User already registered");
        
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
    function _updateReputation(address user, bool isPositive) private {
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
    
    // Admin functions
    /**
     * @dev Update the platform base interest rate
     * @param newRate The new base rate (x100 for precision)
     */
    function updatePlatformBaseRate(uint256 newRate) external onlyOwner {
        require(newRate >= 100, "Base rate must be at least 1%");
        platformBaseRate = newRate;
        emit PlatformBaseRateUpdated(newRate);
    }
    
    /**
     * @dev Update the platform fee percentage
     * @param newFeePercent The new fee percentage (x100 for precision)
     */
    function updatePlatformFee(uint256 newFeePercent) external onlyOwner {
        require(newFeePercent <= 500, "Fee cannot exceed 5%");
        platformFeePercent = newFeePercent;
        emit PlatformFeeUpdated(newFeePercent);
    }
    
    /**
     * @dev Withdraw collected platform fees
     */
    function withdrawPlatformFees() external onlyOwner {
        uint256 amount = collectedFees;
        require(amount > 0, "No fees to withdraw");
        
        collectedFees = 0;
        payable(owner()).transfer(amount);
        
        emit PlatformFeesWithdrawn(amount);
    }
    
    // Loan request functions
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
        
        // Create loan request
        _loanRequestIds.increment();
        uint256 requestId = _loanRequestIds.current();
        
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
        
        // Create new funding offer
        _offerIds.increment();
        uint256 offerId = _offerIds.current();
        
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
        
        // Collect funds from lender to fund the loan
        // This is implemented separately in fundAcceptedOffer
    }
    
    /**
     * @dev Fund a loan after the offer has been accepted
     */
    function fundAcceptedOffer(uint256 offerId) public payable offerExists(offerId) nonReentrant {
        FundingOffer storage offer = fundingOffers[offerId];
        LoanRequest storage request = loanRequests[offer.requestId];
        
        require(msg.sender == offer.lender, "Only offer creator can fund");
        require(offer.status == OfferStatus.Accepted, "Offer not accepted");
        require(msg.value == request.amount, "Incorrect loan amount");
        
        // Create new loan
        _loanIds.increment();
        uint256 loanId = _loanIds.current();
        
        Loan storage loan = loans[loanId];
        loan.id = loanId;
        loan.requestId = offer.requestId;
        loan.borrower = request.borrower;
        loan.lender = offer.lender;
        loan.amount = request.amount;
        loan.interestRate = offer.interestRate;
        loan.collateralAmount = request.collateralAmount;
        loan.startTime = block.timestamp;
        loan.endTime = block.timestamp + (request.durationDays * 1 days);
        loan.repaidAmount = 0;
        loan.status = LoanStatus.Active;
        
        // Update reputation data
        UserReputation storage lenderRep = userReputations[offer.lender];
        lenderRep.totalLoansFunded++;
        
        // Calculate platform fee
        uint256 feeAmount = (request.amount * platformFeePercent) / 10000; // Divide by 10000 to account for precision
        uint256 borrowerAmount = request.amount - feeAmount;
        
        // Add fee to collected fees
        collectedFees += feeAmount;
        
        // Transfer funds to borrower (minus platform fee)
        payable(request.borrower).transfer(borrowerAmount);
        
        emit PlatformFeeCollected(loanId, feeAmount);
        emit LoanFunded(loanId, offer.requestId, offer.lender, request.borrower, request.amount, offer.interestRate);
    }
    
    // View functions
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
    
    /**
     * @dev Get the number of loan requests
     */
    function getLoanRequestCount() public view returns (uint256) {
        return _loanRequestIds.current();
    }
    
    /**
     * @dev Get the number of loans
     */
    function getLoanCount() public view returns (uint256) {
        return _loanIds.current();
    }
    
    /**
     * @dev Get active loan requests
     * @param offset Pagination offset
     * @param limit Maximum number of entries to return
     */
    function getActiveLoanRequests(uint256 offset, uint256 limit) public view returns (uint256[] memory) {
        uint256 totalRequests = _loanRequestIds.current();
        
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
     * @dev Get user's active loans (as borrower)
     */
    function getUserActiveLoans(address user) public view returns (uint256[] memory) {
        uint256 totalLoans = _loanIds.current();
        
        // Count user's active loans
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= totalLoans; i++) {
            if (loans[i].borrower == user && loans[i].status == LoanStatus.Active) {
                activeCount++;
            }
        }
        
        // Collect active loan IDs
        uint256[] memory result = new uint256[](activeCount);
        uint256 resultIndex = 0;
        
        for (uint256 i = 1; i <= totalLoans && resultIndex < activeCount; i++) {
            if (loans[i].borrower == user && loans[i].status == LoanStatus.Active) {
                result[resultIndex] = i;
                resultIndex++;
            }
        }
        
        return result;
    }
    
    /**
     * @dev Get user's active investments (as lender)
     */
    function getUserActiveInvestments(address user) public view returns (uint256[] memory) {
        uint256 totalLoans = _loanIds.current();
        
        // Count user's active investments
        uint256 activeCount = 0;
        for (uint256 i = 1; i <= totalLoans; i++) {
            if (loans[i].lender == user && loans[i].status == LoanStatus.Active) {
                activeCount++;
            }
        }
        
        // Collect active investment IDs
        uint256[] memory result = new uint256[](activeCount);
        uint256 resultIndex = 0;
        
        for (uint256 i = 1; i <= totalLoans && resultIndex < activeCount; i++) {
            if (loans[i].lender == user && loans[i].status == LoanStatus.Active) {
                result[resultIndex] = i;
                resultIndex++;
            }
        }
        
        return result;
    }
    
    /**
     * @dev Get platform statistics
     */
    function getPlatformStats() public view returns (
        uint256 totalLoanRequests,
        uint256 totalFundedLoans,
        uint256 currentPlatformFee,
        uint256 platformFeesCollected
    ) {
        return (
            _loanRequestIds.current(),
            _loanIds.current(),
            platformFeePercent,
            collectedFees
        );
    }
} 