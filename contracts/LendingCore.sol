// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title LendingCore
 * @dev Base contract with common data structures and storage
 */
abstract contract LendingCore is Ownable {
    using Counters for Counters.Counter;
    
    // Counters for IDs
    Counters.Counter internal _loanRequestIds;
    Counters.Counter internal _loanIds;
    Counters.Counter internal _offerIds;
    
    // Status enums
    enum LoanRequestStatus { Active, Funded, Cancelled, Expired }
    enum LoanStatus { Active, Repaid, Defaulted }
    enum OfferStatus { Active, Accepted, Cancelled, Expired }
    
    // Admin address
    address public adminAddress;
    
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
    event AdminAddressUpdated(address indexed newAdmin);
    
    // Modifiers
    modifier onlyRegistered() {
        require(userReputations[msg.sender].isRegistered, "Not registered");
        _;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == adminAddress, "Only admin");
        _;
    }
    
    modifier loanRequestExists(uint256 requestId) {
        require(requestId > 0 && requestId <= _getLoanRequestCount(), "Request not found");
        _;
    }
    
    modifier loanExists(uint256 loanId) {
        require(loanId > 0 && loanId <= _getLoanCount(), "Loan not found");
        _;
    }
    
    modifier offerExists(uint256 offerId) {
        require(offerId > 0 && offerId <= _getOfferCount(), "Offer not found");
        _;
    }
    
    constructor() Ownable(msg.sender) {
        adminAddress = msg.sender;
    }
    
    /**
     * @dev Increment the loan request counter and return the new value
     */
    function _incrementLoanRequestId() internal returns (uint256) {
        _loanRequestIds.increment();
        return _loanRequestIds.current();
    }
    
    /**
     * @dev Increment the loan counter and return the new value
     */
    function _incrementLoanId() internal returns (uint256) {
        _loanIds.increment();
        return _loanIds.current();
    }
    
    /**
     * @dev Increment the offer counter and return the new value
     */
    function _incrementOfferId() internal returns (uint256) {
        _offerIds.increment();
        return _offerIds.current();
    }
    
    /**
     * @dev Get the current value of loan requests counter
     */
    function _getLoanRequestCount() internal view returns (uint256) {
        return _loanRequestIds.current();
    }
    
    /**
     * @dev Get the current value of loans counter
     */
    function _getLoanCount() internal view returns (uint256) {
        return _loanIds.current();
    }
    
    /**
     * @dev Get the current value of offers counter
     */
    function _getOfferCount() internal view returns (uint256) {
        return _offerIds.current();
    }
} 