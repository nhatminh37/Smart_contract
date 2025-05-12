// Global variables
import { LENDING_PLATFORM_ADDRESS, LOAN_TOKEN_ADDRESS, LENDING_PLATFORM_ABI, LOAN_TOKEN_ABI } from './lending-abi.js';
let provider;
let signer;
let lendingPlatform;
let loanToken;
let userAddress;
let isRegistered = false;
let isAdmin = false;
let usingTokenMode = false;
let currentPage = 0;
let itemsPerPage = 5;

// Ensure ethers is loaded before proceeding
function ensureEthersLoaded(callback) {
    let attempts = 0;
    const maxAttempts = 5;
    
    function checkEthers() {
        console.log(`Checking for ethers.js (attempt ${attempts + 1}/${maxAttempts})...`);
        
        if (typeof window.ethers !== 'undefined') {
            console.log("ethers.js is available, proceeding...");
            callback();
            return;
        }
        
        attempts++;
        if (attempts >= maxAttempts) {
            console.error("Failed to load ethers.js after multiple attempts");
            alert("Could not load the ethers.js library. Please try refreshing the page or check your browser console for more information.");
            return;
        }
        
        console.log("ethers.js not loaded yet, waiting...");
        setTimeout(checkEthers, 1000); // Wait 1 second before checking again
    }
    
    checkEthers();
}

// Wait for DOM content to load
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded, initializing application...");
    
    // Initialize UI event listeners
    initializeUI();
    
    // Ensure ethers is loaded before initializing
    ensureEthersLoaded(initializeApp);
});

// Initialize wallet connection
async function initializeApp() {
    try {
        // Connect to MetaMask
        if (window.ethereum) {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            
            // Request account access if needed
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            signer = provider.getSigner();
            userAddress = await signer.getAddress();
            
            // Initialize contract instances
            lendingPlatform = new ethers.Contract(
                LENDING_PLATFORM_ADDRESS,
                LENDING_PLATFORM_ABI,
                signer
            );
            
            loanToken = new ethers.Contract(
                LOAN_TOKEN_ADDRESS,
                LOAN_TOKEN_ABI,
                signer
            );
            
            // Check if user is registered
            const userRep = await lendingPlatform.getUserReputation(userAddress);
            isRegistered = userRep.isRegistered;
            
            // Update UI based on registration status
            updateUIForRegistration();
            
            // Load active loan requests
            loadActiveLoanRequests();
            
            // Load user loans and investments if registered
            if (isRegistered) {
                loadUserLoans();
                loadUserInvestments();
                displayUserReputation();
            }
            
            // Setup event listeners for the UI
            setupEventListeners();
            
            // Display network info
            const network = await provider.getNetwork();
            document.getElementById('networkInfo').textContent = `Connected to: ${network.name}`;
            document.getElementById('userAddress').textContent = `Your address: ${userAddress}`;
            
            console.log("App initialized successfully");
        } else {
            console.error("Please install MetaMask to use this dApp");
            document.getElementById('status').textContent = "Please install MetaMask to use this dApp";
        }
    } catch (error) {
        console.error("Initialization error:", error);
        document.getElementById('status').textContent = `Error: ${error.message}`;
    }
}

// Update UI based on registration status
function updateUIForRegistration() {
    if (isRegistered) {
        document.getElementById('registrationSection').style.display = 'none';
        document.getElementById('loanRequestForm').style.display = 'block';
        document.getElementById('status').textContent = "You are registered on the platform";
    } else {
        document.getElementById('registrationSection').style.display = 'block';
        document.getElementById('loanRequestForm').style.display = 'none';
        document.getElementById('status').textContent = "Please register to use the platform";
    }
}

// Register user on the platform
async function registerUser() {
    try {
        document.getElementById('status').textContent = "Registering user...";
        const tx = await lendingPlatform.registerUser();
        await tx.wait();
        
        isRegistered = true;
        updateUIForRegistration();
        displayUserReputation();
        
        document.getElementById('status').textContent = "Registration successful!";
    } catch (error) {
        console.error("Registration error:", error);
        document.getElementById('status').textContent = `Registration failed: ${error.message}`;
    }
}

// Create a new loan request
async function createLoanRequest() {
    try {
        const amount = ethers.utils.parseEther(document.getElementById('loanAmount').value);
        const durationDays = parseInt(document.getElementById('loanDuration').value);
        const maxInterestRate = parseInt(document.getElementById('maxInterestRate').value) * 100; // Convert to basis points
        const purpose = document.getElementById('loanPurpose').value;
        const collateral = ethers.utils.parseEther(document.getElementById('collateralAmount').value);
        
        document.getElementById('status').textContent = "Creating loan request...";
        
        const tx = await lendingPlatform.createLoanRequest(
            amount,
            durationDays,
            maxInterestRate,
            purpose,
            { value: collateral }
        );
        
        await tx.wait();
        document.getElementById('status').textContent = "Loan request created successfully!";
        
        // Reload loan requests
        loadActiveLoanRequests();
    } catch (error) {
        console.error("Loan request error:", error);
        document.getElementById('status').textContent = `Loan request failed: ${error.message}`;
    }
}

// Load active loan requests
async function loadActiveLoanRequests() {
    try {
        const requestIds = await lendingPlatform.getActiveLoanRequests(0, 20);
        const requestsContainer = document.getElementById('loanRequests');
        requestsContainer.innerHTML = '';
        
        for (const id of requestIds) {
            const request = await lendingPlatform.loanRequests(id);
            
            // Create request element
            const requestElement = document.createElement('div');
            requestElement.className = 'loan-request';
            requestElement.innerHTML = `
                <h3>Loan Request #${request.id}</h3>
                <p>Amount: ${ethers.utils.formatEther(request.amount)} ETH</p>
                <p>Duration: ${request.durationDays} days</p>
                <p>Max Interest: ${request.maxInterestRate / 100}%</p>
                <p>Collateral: ${ethers.utils.formatEther(request.collateralAmount)} ETH</p>
                <p>Purpose: ${request.purpose}</p>
                <button class="fund-button" data-id="${request.id}">Fund This Loan</button>
            `;
            
            requestsContainer.appendChild(requestElement);
        }
        
        // Add event listeners to fund buttons
        const fundButtons = document.querySelectorAll('.fund-button');
        fundButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const requestId = event.target.getAttribute('data-id');
                showFundingDialog(requestId);
            });
        });
    } catch (error) {
        console.error("Error loading loan requests:", error);
        document.getElementById('status').textContent = `Error loading loan requests: ${error.message}`;
    }
}

// Show funding dialog
function showFundingDialog(requestId) {
    document.getElementById('fundRequestId').value = requestId;
    document.getElementById('fundingDialog').style.display = 'block';
}

// Submit funding offer
async function createFundingOffer() {
    try {
        const requestId = document.getElementById('fundRequestId').value;
        const interestRate = parseInt(document.getElementById('offerInterestRate').value) * 100; // Convert to basis points
        
        document.getElementById('status').textContent = "Creating funding offer...";
        
        const tx = await lendingPlatform.createFundingOffer(requestId, interestRate);
        await tx.wait();
        
        document.getElementById('fundingDialog').style.display = 'none';
        document.getElementById('status').textContent = "Funding offer created successfully!";
        
        // Reload funding offers for this request
        loadFundingOffers(requestId);
    } catch (error) {
        console.error("Funding offer error:", error);
        document.getElementById('status').textContent = `Funding offer failed: ${error.message}`;
    }
}

// Load user's active loans
async function loadUserLoans() {
    try {
        const loanIds = await lendingPlatform.getUserActiveLoans(userAddress);
        const loansContainer = document.getElementById('userLoans');
        loansContainer.innerHTML = '';
        
        for (const id of loanIds) {
            const loan = await lendingPlatform.loans(id);
            
            // Create loan element
            const loanElement = document.createElement('div');
            loanElement.className = 'loan-item';
            loanElement.innerHTML = `
                <h3>Loan #${loan.id}</h3>
                <p>Amount: ${ethers.utils.formatEther(loan.amount)} ETH</p>
                <p>Interest Rate: ${loan.interestRate / 100}%</p>
                <p>End Date: ${new Date(loan.endTime * 1000).toLocaleDateString()}</p>
                <p>Status: ${getLoanStatusText(loan.status)}</p>
                <button class="repay-button" data-id="${loan.id}">Repay Loan</button>
            `;
            
            loansContainer.appendChild(loanElement);
        }
        
        // Add event listeners to repay buttons
        const repayButtons = document.querySelectorAll('.repay-button');
        repayButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const loanId = event.target.getAttribute('data-id');
                showRepayDialog(loanId);
            });
        });
    } catch (error) {
        console.error("Error loading user loans:", error);
    }
}

// Get text representation of loan status
function getLoanStatusText(statusCode) {
    const statuses = ["Active", "Repaid", "Defaulted"];
    return statuses[statusCode] || "Unknown";
}

// Show repay dialog
function showRepayDialog(loanId) {
    document.getElementById('repayLoanId').value = loanId;
    document.getElementById('repayDialog').style.display = 'block';
}

// Repay loan
async function repayLoan() {
    try {
        const loanId = document.getElementById('repayLoanId').value;
        const loan = await lendingPlatform.loans(loanId);
        
        // Calculate total repayment amount (principal + interest)
        const principal = loan.amount;
        const interestAmount = principal.mul(loan.interestRate).div(10000); // Interest rate is in basis points (100 = 1%)
        const totalRepayment = principal.add(interestAmount);
        
        document.getElementById('status').textContent = "Repaying loan...";
        
        const tx = await lendingPlatform.repayLoan(loanId, { value: totalRepayment });
        await tx.wait();
        
        document.getElementById('repayDialog').style.display = 'none';
        document.getElementById('status').textContent = "Loan repaid successfully!";
        
        // Reload user loans
        loadUserLoans();
        displayUserReputation();
    } catch (error) {
        console.error("Loan repayment error:", error);
        document.getElementById('status').textContent = `Loan repayment failed: ${error.message}`;
    }
}

// Load user's active investments
async function loadUserInvestments() {
    try {
        const loanIds = await lendingPlatform.getUserActiveInvestments(userAddress);
        const investmentsContainer = document.getElementById('userInvestments');
        investmentsContainer.innerHTML = '';
        
        for (const id of loanIds) {
            const loan = await lendingPlatform.loans(id);
            
            // Create investment element
            const investmentElement = document.createElement('div');
            investmentElement.className = 'investment-item';
            investmentElement.innerHTML = `
                <h3>Investment in Loan #${loan.id}</h3>
                <p>Amount: ${ethers.utils.formatEther(loan.amount)} ETH</p>
                <p>Interest Rate: ${loan.interestRate / 100}%</p>
                <p>End Date: ${new Date(loan.endTime * 1000).toLocaleDateString()}</p>
                <p>Status: ${getLoanStatusText(loan.status)}</p>
            `;
            
            investmentsContainer.appendChild(investmentElement);
        }
    } catch (error) {
        console.error("Error loading user investments:", error);
    }
}

// Display user reputation
async function displayUserReputation() {
    try {
        const userRep = await lendingPlatform.getUserReputation(userAddress);
        const reputationContainer = document.getElementById('userReputation');
        
        reputationContainer.innerHTML = `
            <h3>Your Reputation</h3>
            <p>Reputation Score: ${userRep.reputationScore}</p>
            <p>Loans Requested: ${userRep.totalLoansRequested}</p>
            <p>Loans Funded: ${userRep.totalLoansFunded}</p>
            <p>Loans Repaid On Time: ${userRep.loansRepaidOnTime}</p>
            <p>Defaulted Loans: ${userRep.loansDefaulted}</p>
            <p>Total Transactions: ${userRep.totalTransactions}</p>
            <p>Collateralization Ratio: ${userRep.collateralizationRatio / 100}%</p>
        `;
    } catch (error) {
        console.error("Error loading user reputation:", error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Register user
    document.getElementById('registerButton').addEventListener('click', registerUser);
    
    // Create loan request
    document.getElementById('submitLoanRequest').addEventListener('click', createLoanRequest);
    
    // Close funding dialog
    document.getElementById('closeFundingDialog').addEventListener('click', () => {
        document.getElementById('fundingDialog').style.display = 'none';
    });
    
    // Submit funding offer
    document.getElementById('submitFunding').addEventListener('click', createFundingOffer);
    
    // Close repay dialog
    document.getElementById('closeRepayDialog').addEventListener('click', () => {
        document.getElementById('repayDialog').style.display = 'none';
    });
    
    // Submit loan repayment
    document.getElementById('submitRepayment').addEventListener('click', repayLoan);
}

// Initialize UI event listeners
function initializeUI() {
    console.log("Initializing UI and event listeners");
    // Connect wallet button
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', connectWallet);
        console.log("Wallet connect button listener added");
    } else {
        console.error("Connect wallet button not found in the DOM");
    }
    
    // Register button
    document.getElementById('registerBtn').addEventListener('click', registerUser);
    
    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.getAttribute('data-tab');
            switchTab(tabName);
        });
    });
    
    // Loan request form submission
    document.getElementById('loanRequestForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await createLoanRequest();
    });
    
    // Repay loan form submission
    document.getElementById('repayLoanForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await repayLoan();
    });
    
    // Admin panel buttons
    document.getElementById('updateSettingsBtn').addEventListener('click', updatePlatformSettings);
    document.getElementById('updateTokenModeBtn').addEventListener('click', updateTokenMode);
    document.getElementById('withdrawFeesBtn').addEventListener('click', withdrawPlatformFees);
    
    // Sort and refresh loan requests
    document.getElementById('sortRequests').addEventListener('change', () => loadActiveLoanRequests());
    document.getElementById('refreshRequests').addEventListener('click', () => loadActiveLoanRequests());
    
    // Close buttons for modals
    document.querySelectorAll('.close, .close-modal').forEach(element => {
        element.addEventListener('click', () => {
            document.querySelectorAll('.modal').forEach(modal => {
                modal.style.display = 'none';
            });
        });
    });
    
    // When the user clicks anywhere outside of the modal, close it
    window.addEventListener('click', (event) => {
        document.querySelectorAll('.modal').forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
}

// Connect to MetaMask wallet
async function connectWallet() {
    console.log("Attempting to connect wallet...");
    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];
        console.log("Connected to account:", userAddress);
        
        // Get the signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        
        // Create contract instance
        lendingPlatform = new ethers.Contract(LENDING_PLATFORM_ADDRESS, LENDING_PLATFORM_ABI, signer);
        console.log("Lending contract instance created");
        
        // Update UI
        document.getElementById('walletAddress').textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        document.getElementById('connectWalletBtn').style.display = 'none';
        document.getElementById('walletInfo').style.display = 'block';
        
        // Get balance
        const balance = await provider.getBalance(userAddress);
        document.getElementById('walletBalance').textContent = `${ethers.utils.formatEther(balance).substring(0, 6)} ETH`;
        console.log("Wallet balance:", ethers.utils.formatEther(balance), "ETH");
        
        // Check if user is registered
        await checkUserRegistration();
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        
        // Listen for network changes
        window.ethereum.on('chainChanged', () => {
            console.log("Network changed, reloading...");
            window.location.reload();
        });
    } catch (error) {
        console.error('Error connecting to wallet:', error);
        alert('Failed to connect to your wallet. Please make sure MetaMask is unlocked and on the Sepolia testnet. Error: ' + error.message);
    }
}

// Handle account changes
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // MetaMask is locked or the user has not connected any accounts
        alert('Please connect to MetaMask.');
        resetUI();
    } else if (accounts[0] !== userAddress) {
        userAddress = accounts[0];
        // Reload the page to refresh the UI with the new account
        window.location.reload();
    }
}

// Reset UI when wallet disconnects
function resetUI() {
    document.getElementById('connectWalletBtn').style.display = 'block';
    document.getElementById('walletInfo').style.display = 'none';
    document.getElementById('registrationSection').style.display = 'none';
    document.getElementById('platformSection').style.display = 'none';
}

// Check if user is registered
async function checkUserRegistration() {
    try {
        const userRep = await lendingPlatform.getUserReputation(userAddress);
        isRegistered = userRep.isRegistered;
        
        // Check if user is admin
        const adminAddress = await lendingPlatform.adminAddress();
        isAdmin = (userAddress.toLowerCase() === adminAddress.toLowerCase());
        
        // Check if token mode is enabled
        usingTokenMode = await lendingPlatform.usingToken();
        
        // Update UI based on admin status
        document.getElementById('adminTab').style.display = isAdmin ? 'block' : 'none';
        
        if (isRegistered) {
            // Show platform UI
            document.getElementById('registrationSection').style.display = 'none';
            document.getElementById('platformSection').style.display = 'block';
            
            // Load user data
            await loadUserDashboard();
            await loadActiveLoanRequests();
            await loadUserLoans();
            await loadUserInvestments();
            
            // Load admin data if admin
            if (isAdmin) {
                await loadAdminData();
            }
        } else {
            // Show registration UI
            document.getElementById('registrationSection').style.display = 'block';
            document.getElementById('platformSection').style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking user registration:', error);
    }
}

// Load user dashboard data
async function loadUserDashboard() {
    try {
        const userRep = await lendingPlatform.getUserReputation(userAddress);
        
        // Update reputation score
        const reputationScore = userRep.reputationScore.toNumber();
        document.getElementById('reputationScore').textContent = reputationScore;
        document.getElementById('reputationMeter').style.width = `${reputationScore}%`;
        
        // Update stats
        document.getElementById('loansRequestedStat').textContent = userRep.totalLoansRequested.toString();
        document.getElementById('loansFundedStat').textContent = userRep.totalLoansFunded.toString();
        document.getElementById('loansRepaidStat').textContent = userRep.loansRepaidOnTime.toString();
        document.getElementById('loansDefaultedStat').textContent = userRep.loansDefaulted.toString();
        document.getElementById('transactionsStat').textContent = userRep.totalTransactions.toString();
        
        // Format collateralization ratio
        const collateralizationRatio = userRep.collateralizationRatio.toNumber() / 100;
        document.getElementById('collateralizationStat').textContent = `${collateralizationRatio}%`;
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Load admin data
async function loadAdminData() {
    try {
        // Get platform settings
        const baseRate = await lendingPlatform.platformBaseRate();
        const baseRateFormatted = baseRate.toNumber() / 100;
        document.getElementById('platformBaseRate').value = baseRateFormatted;
        
        const feePercent = await lendingPlatform.platformFeePercent();
        const feePercentFormatted = feePercent.toNumber() / 100;
        document.getElementById('platformFeePercent').value = feePercentFormatted;
        
        // Get token mode status
        const usingToken = await lendingPlatform.usingToken();
        document.getElementById('usingTokenMode').checked = usingToken;
        
        if (usingToken) {
            const tokenAddress = await lendingPlatform.loanToken();
            document.getElementById('tokenAddress').value = tokenAddress;
        }
        
        // Get platform statistics
        const stats = await lendingPlatform.getPlatformStats();
        
        document.getElementById('adminTotalRequestsStat').textContent = stats.totalLoanRequests.toString();
        document.getElementById('adminTotalLoansStat').textContent = stats.totalFundedLoans.toString();
        document.getElementById('adminCurrentFeeStat').textContent = `${stats.currentPlatformFee.toNumber() / 100}%`;
        document.getElementById('adminCollectedFeesStat').textContent = `${ethers.utils.formatEther(stats.platformFeesCollected)} ETH`;
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

// Update platform settings
async function updatePlatformSettings() {
    try {
        document.getElementById('loadingSpinner').style.display = 'block';
        
        const baseRate = parseFloat(document.getElementById('platformBaseRate').value);
        const baseRateBasis = Math.floor(baseRate * 100);
        
        const feePercent = parseFloat(document.getElementById('platformFeePercent').value);
        const feePercentBasis = Math.floor(feePercent * 100);
        
        // Update base rate
        let tx = await lendingPlatform.updatePlatformBaseRate(baseRateBasis);
        await tx.wait();
        
        // Update fee percent
        tx = await lendingPlatform.updatePlatformFee(feePercentBasis);
        await tx.wait();
        
        // Reload admin data
        await loadAdminData();
        
        document.getElementById('loadingSpinner').style.display = 'none';
        alert('Platform settings updated successfully!');
    } catch (error) {
        document.getElementById('loadingSpinner').style.display = 'none';
        console.error('Error updating platform settings:', error);
        alert('Failed to update platform settings. ' + error.message);
    }
}

// Update token mode
async function updateTokenMode() {
    try {
        document.getElementById('loadingSpinner').style.display = 'block';
        
        const enableToken = document.getElementById('usingTokenMode').checked;
        const tokenAddress = document.getElementById('tokenAddress').value;
        
        if (enableToken) {
            // Validate address
            if (!ethers.utils.isAddress(tokenAddress)) {
                alert('Please enter a valid token address');
                document.getElementById('loadingSpinner').style.display = 'none';
                return;
            }
            
            // Enable token mode
            const tx = await lendingPlatform.enableTokenMode(tokenAddress);
            await tx.wait();
            
            // Initialize loan token contract
            loanToken = new ethers.Contract(tokenAddress, LOAN_TOKEN_ABI, signer);
        } else {
            // Disable token mode
            const tx = await lendingPlatform.disableTokenMode();
            await tx.wait();
        }
        
        // Reload admin data
        await loadAdminData();
        
        // Update global variable
        usingTokenMode = enableToken;
        
        document.getElementById('loadingSpinner').style.display = 'none';
        alert(`Token mode ${enableToken ? 'enabled' : 'disabled'} successfully!`);
    } catch (error) {
        document.getElementById('loadingSpinner').style.display = 'none';
        console.error('Error updating token mode:', error);
        alert('Failed to update token mode. ' + error.message);
    }
}

// Withdraw platform fees
async function withdrawPlatformFees() {
    try {
        document.getElementById('loadingSpinner').style.display = 'block';
        
        const tx = await lendingPlatform.withdrawPlatformFees();
        await tx.wait();
        
        // Reload admin data
        await loadAdminData();
        
        document.getElementById('loadingSpinner').style.display = 'none';
        alert('Platform fees withdrawn successfully!');
    } catch (error) {
        document.getElementById('loadingSpinner').style.display = 'none';
        console.error('Error withdrawing fees:', error);
        alert('Failed to withdraw fees. ' + error.message);
    }
}

// Switch between tabs
function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Deactivate all tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Activate selected tab
    document.getElementById(`${tabName}Tab`).classList.add('active');
    document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
} 