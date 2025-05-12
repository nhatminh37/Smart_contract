// Replace with your deployed contract addresses from Remix
const LENDING_PLATFORM_ADDRESS = "0xd3cd71D656df76dB5e56099ddC009Ca14B3cb914"; // LendingPlatform
const LOAN_TOKEN_ADDRESS = "0x1dA18b84cac0d9c9709E79e173C26932eB762564"; // LoanToken

// ABIs for the contracts
const LENDING_PLATFORM_ABI = [
  // Constructor
  "constructor()",
  
  // User registration & management
  "function registerUser()",
  "function getUserReputation(address user) view returns (uint256 reputationScore, uint256 totalLoansRequested, uint256 totalLoansFunded, uint256 loansRepaidOnTime, uint256 loansDefaulted, uint256 totalTransactions, uint256 collateralizationRatio, bool isRegistered)",
  "function getRecommendedInterestRate(address borrowerAddress) view returns (uint256)",
  
  // Loan request functions
  "function createLoanRequest(uint256 amount, uint256 durationDays, uint256 maxInterestRate, string purpose) payable",
  "function cancelLoanRequest(uint256 requestId)",
  "function checkLoanRequestExpiry(uint256 requestId) returns (bool)",
  "function getActiveLoanRequests(uint256 offset, uint256 limit) view returns (uint256[])",
  "function getAllActiveLoanRequests() view returns (uint256[])",
  
  // Funding offer functions
  "function createFundingOffer(uint256 requestId, uint256 interestRate)",
  "function cancelFundingOffer(uint256 offerId)",
  "function acceptFundingOffer(uint256 offerId)",
  "function fundAcceptedOffer(uint256 offerId) payable",
  
  // Loan management
  "function repayLoan(uint256 loanId) payable",
  "function markLoanDefaulted(uint256 loanId)",
  "function getUserActiveLoans(address user) view returns (uint256[])",
  "function getUserActiveInvestments(address user) view returns (uint256[])",
  
  // Admin functions
  "function updatePlatformBaseRate(uint256 newRate)",
  "function updatePlatformFee(uint256 newFeePercent)",
  "function withdrawPlatformFees()",
  "function updateAdminAddress(address newAdmin)",
  "function enableTokenMode(address tokenAddress)",
  "function disableTokenMode()",
  "function getPlatformStats() view returns (uint256 totalLoanRequests, uint256 totalFundedLoans, uint256 currentPlatformFee, uint256 platformFeesCollected)",
  
  // Mapping getters
  "function userReputations(address) view returns (uint256 reputationScore, uint256 totalLoansRequested, uint256 totalLoansFunded, uint256 loansRepaidOnTime, uint256 loansDefaulted, uint256 totalTransactions, uint256 collateralizationRatio, bool isRegistered)",
  "function loanRequests(uint256) view returns (uint256 id, address borrower, uint256 amount, uint256 durationDays, uint256 maxInterestRate, uint256 collateralAmount, string purpose, uint256 timestamp, uint8 status, uint256 bestOfferId)",
  "function loans(uint256) view returns (uint256 id, uint256 requestId, address borrower, address lender, uint256 amount, uint256 interestRate, uint256 collateralAmount, uint256 startTime, uint256 endTime, uint256 repaidAmount, uint8 status)",
  "function fundingOffers(uint256) view returns (uint256 id, uint256 requestId, address lender, uint256 interestRate, uint256 timestamp, uint8 status)",
  
  // Platform state
  "function platformBaseRate() view returns (uint256)",
  "function maxReputationDiscount() view returns (uint256)",
  "function requestExpirationTime() view returns (uint256)",
  "function offerExpirationTime() view returns (uint256)",
  "function platformFeePercent() view returns (uint256)",
  "function collectedFees() view returns (uint256)",
  "function adminAddress() view returns (address)",
  "function usingToken() view returns (bool)",
  "function loanToken() view returns (address)"
];

const LOAN_TOKEN_ABI = [
  "constructor(string name, string symbol)",
  "function name() view returns (string)",
  "function symbol() view returns (string)",
  "function decimals() view returns (uint8)",
  "function totalSupply() view returns (uint256)",
  "function balanceOf(address account) view returns (uint256)",
  "function transfer(address recipient, uint256 amount) returns (bool)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transferFrom(address sender, address recipient, uint256 amount) returns (bool)",
  "function mint(address to, uint256 amount)",
  "function burnFrom(address from, uint256 amount)",
  "function setLendingPlatform(address _lendingPlatform)",
  "function lendingPlatform() view returns (address)"
];

// Export the addresses and ABIs
export {
  LENDING_PLATFORM_ADDRESS,
  LOAN_TOKEN_ADDRESS,
  LENDING_PLATFORM_ABI,
  LOAN_TOKEN_ABI
}; 