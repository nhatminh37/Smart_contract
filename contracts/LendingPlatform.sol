// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title LendingPlatform
 * @dev A peer-to-peer decentralized lending platform with reputation scoring
 */
contract LendingPlatform is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    // Counters for IDs
    Counters.Counter private _loanRequestIds;
    Counters.Counter private _loanIds;
    
    // Status enums
    enum LoanRequestStatus { Active, Funded, Cancelled }
    enum LoanStatus { Active, Repaid, Defaulted }
    
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
    
    // Loan request structure
    struct LoanRequest {
        uint256 id;
        address borrower;
        uint256 amount;
        uint256 durationDays;
        uint256 interestRate;          // Interest rate (per year, x100 for precision)
        uint256 collateralAmount;      // Amount of collateral provided
        string purpose;                // Purpose of the loan
        uint256 timestamp;             // When the request was created
        LoanRequestStatus status;      // Status of the loan request
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
    
    // Events
    event UserRegistered(address indexed user);
    event ReputationUpdated(address indexed user, uint256 newScore);
    event LoanRequestCreated(uint256 indexed requestId, address indexed borrower, uint256 amount, uint256 interestRate);
    event LoanRequestCancelled(uint256 indexed requestId);
    event LoanFunded(uint256 indexed loanId, uint256 indexed requestId, address indexed lender, address borrower, uint256 amount);
    event LoanRepaid(uint256 indexed loanId, uint256 amount);
    event LoanDefaulted(uint256 indexed loanId);
    event CollateralReturned(uint256 indexed loanId, address borrower, uint256 amount);
    event CollateralClaimed(uint256 indexed loanId, address lender, uint256 amount);
    
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
     * @dev Calculate dynamic interest rate based on borrower's reputation
     * @param borrowerAddress The address of the borrower
     * @param baseInterestRate The base interest rate (in percent, x100 for precision)
     * @return The adjusted interest rate
     */
    function calculateDynamicInterestRate(address borrowerAddress, uint256 baseInterestRate) public view returns (uint256) {
        UserReputation storage reputation = userReputations[borrowerAddress];
        
        if (!reputation.isRegistered) {
            return baseInterestRate; // Use base rate for unregistered users
        }
        
        // Adjust interest rate based on reputation score (0-100)
        // Lower score = higher interest rate, higher score = lower interest rate
        // Maximum adjustment: +/- 5% (500 basis points)
        int256 adjustment = int256(50) - int256(reputation.reputationScore);
        
        // Each point of reputation is worth 10 basis points (0.1%)
        adjustment = (adjustment * 10);
        
        // Apply adjustment to base rate, ensuring it doesn't go below 1%
        int256 adjustedRate = int256(baseInterestRate) + adjustment;
        if (adjustedRate < 100) { // 1%
            adjustedRate = 100;
        }
        
        return uint256(adjustedRate);
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
    
    // Loan request functions
    /**
     * @dev Create a new loan request
     */
    function createLoanRequest(
        uint256 amount,
        uint256 durationDays,
        uint256 interestRate,
        string memory purpose
    ) public payable onlyRegistered {
        require(amount > 0, "Loan amount must be greater than 0");
        require(durationDays > 0, "Loan duration must be greater than 0");
        require(msg.value > 0, "Collateral required");
        
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
        request.interestRate = interestRate;
        request.collateralAmount = collateralAmount;
        request.purpose = purpose;
        request.timestamp = block.timestamp;
        request.status = LoanRequestStatus.Active;
        
        emit LoanRequestCreated(requestId, msg.sender, amount, interestRate);
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
        
        emit LoanRequestCancelled(requestId);
    }
    
    /**
     * @dev Fund a loan request
     */
    function fundLoan(uint256 requestId) public payable loanRequestExists(requestId) onlyRegistered {
        LoanRequest storage request = loanRequests[requestId];
        
        require(request.status == LoanRequestStatus.Active, "Request not active");
        require(msg.value == request.amount, "Incorrect loan amount");
        require(msg.sender != request.borrower, "Cannot fund own loan");
        
        // Update loan request status
        request.status = LoanRequestStatus.Funded;
        
        // Create new loan
        _loanIds.increment();
        uint256 loanId = _loanIds.current();
        
        Loan storage loan = loans[loanId];
        loan.id = loanId;
        loan.requestId = requestId;
        loan.borrower = request.borrower;
        loan.lender = msg.sender;
        loan.amount = request.amount;
        loan.interestRate = request.interestRate;
        loan.collateralAmount = request.collateralAmount;
        loan.startTime = block.timestamp;
        loan.endTime = block.timestamp + (request.durationDays * 1 days);
        loan.repaidAmount = 0;
        loan.status = LoanStatus.Active;
        
        // Update lender reputation
        UserReputation storage lenderRep = userReputations[msg.sender];
        lenderRep.totalLoansFunded++;
        
        // Transfer loan amount to borrower
        payable(request.borrower).transfer(request.amount);
        
        emit LoanFunded(loanId, requestId, msg.sender, request.borrower, request.amount);
    }
    
    /**
     * @dev Repay a loan (partial or full)
     */
    function repayLoan(uint256 loanId) public payable loanExists(loanId) {
        Loan storage loan = loans[loanId];
        
        require(msg.sender == loan.borrower, "Only borrower can repay");
        require(loan.status == LoanStatus.Active, "Loan not active");
        
        // Calculate total amount due (principal + interest)
        uint256 interestAmount = (loan.amount * loan.interestRate * (loan.endTime - loan.startTime)) / (365 days * 10000);
        uint256 totalDue = loan.amount + interestAmount;
        uint256 remainingDue = totalDue - loan.repaidAmount;
        
        require(msg.value > 0, "Payment amount must be greater than 0");
        require(msg.value <= remainingDue, "Payment exceeds amount due");
        
        // Update repaid amount
        loan.repaidAmount += msg.value;
        
        // Transfer payment to lender
        payable(loan.lender).transfer(msg.value);
        
        emit LoanRepaid(loanId, msg.value);
        
        // If loan is fully repaid
        if (loan.repaidAmount >= totalDue) {
            loan.status = LoanStatus.Repaid;
            
            // Return collateral to borrower
            payable(loan.borrower).transfer(loan.collateralAmount);
            
            // Update borrower reputation positively
            _updateReputation(loan.borrower, true);
            UserReputation storage borrowerRep = userReputations[loan.borrower];
            borrowerRep.loansRepaidOnTime++;
            
            emit CollateralReturned(loanId, loan.borrower, loan.collateralAmount);
        }
    }
    
    /**
     * @dev Mark a loan as defaulted (can only be called after loan due date)
     */
    function markLoanDefaulted(uint256 loanId) public loanExists(loanId) {
        Loan storage loan = loans[loanId];
        
        require(msg.sender == loan.lender, "Only lender can mark default");
        require(loan.status == LoanStatus.Active, "Loan not active");
        require(block.timestamp > loan.endTime, "Loan not yet due");
        
        loan.status = LoanStatus.Defaulted;
        
        // Transfer collateral to lender
        payable(loan.lender).transfer(loan.collateralAmount);
        
        // Update borrower reputation negatively
        _updateReputation(loan.borrower, false);
        UserReputation storage borrowerRep = userReputations[loan.borrower];
        borrowerRep.loansDefaulted++;
        
        emit LoanDefaulted(loanId);
        emit CollateralClaimed(loanId, loan.lender, loan.collateralAmount);
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
} 