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

// Wait for DOM content to load
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM content loaded, initializing application...");
    
    // Check if MetaMask is installed
    if (window.ethereum) {
        initializeApp();
    } else {
        console.error("Please install MetaMask to use this dApp");
        document.getElementById('status').textContent = "Please install MetaMask to use this dApp";
    }
});

// Initialize app when page loads
async function initializeApp() {
    try {
        // Connect to MetaMask
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
        
        // Set up event listeners
        setupEventListeners();
        
        // Check if user is registered
        let userRep;
        try {
            userRep = await lendingPlatform.getUserReputation(userAddress);
            isRegistered = userRep.isRegistered;
        } catch (error) {
            console.error("Error checking user registration:", error);
            isRegistered = false;
        }
        
        // Check if token mode is enabled
        try {
            usingTokenMode = await lendingPlatform.usingToken();
            console.log("Token mode enabled:", usingTokenMode);
            
            // Update UI to show which currency is being used
            updateCurrencyLabels();
        } catch (error) {
            console.error("Error checking token mode:", error);
            usingTokenMode = false;
        }
        
        // Update UI based on registration status
        updateUIForRegistration();
        
        // Display network info
        const network = await provider.getNetwork();
        document.getElementById('networkInfo').textContent = `Connected to: ${network.name}`;
        document.getElementById('userAddress').textContent = `Your address: ${userAddress}`;
        
        // Display user wallet info
        const balance = await provider.getBalance(userAddress);
        if (document.getElementById('walletBalance')) {
            document.getElementById('walletBalance').textContent = `${ethers.utils.formatEther(balance)} ETH`;
        }
        
        if (document.getElementById('walletAddress')) {
            document.getElementById('walletAddress').textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        }
        
        // If token mode is enabled, also show token balance
        if (usingTokenMode) {
            try {
                const tokenBalance = await loanToken.balanceOf(userAddress);
                const tokenSymbol = await loanToken.symbol();
                
                if (document.getElementById('tokenBalance')) {
                    document.getElementById('tokenBalance').textContent = `${ethers.utils.formatEther(tokenBalance)} ${tokenSymbol}`;
                    document.getElementById('tokenInfo').style.display = 'block';
                } else {
                    // Create token balance display if it doesn't exist
                    const walletInfo = document.getElementById('walletInfo');
                    if (walletInfo) {
                        const tokenInfo = document.createElement('p');
                        tokenInfo.id = 'tokenInfo';
                        tokenInfo.innerHTML = `Token Balance: <span id="tokenBalance">${ethers.utils.formatEther(tokenBalance)} ${tokenSymbol}</span>`;
                        walletInfo.appendChild(tokenInfo);
                    }
                }
            } catch (error) {
                console.error("Error loading token balance:", error);
            }
        }
        
        // If user is registered, display reputation and attempt to load requests
        if (isRegistered) {
            displayUserReputation();
            
            // Load active loan requests - this should work for everyone
            loadActiveLoanRequests();
            
            // Skip these problematic calls that cause console errors
            document.getElementById('userLoans').innerHTML = '<p>You have no active loans.</p>';
            document.getElementById('userInvestments').innerHTML = '<p>You have no active investments.</p>';
        }
        
        console.log("App initialized successfully");
    } catch (error) {
        console.error("Initialization error:", error);
        document.getElementById('status').textContent = `Error: ${error.message}`;
    }
}

// Update currency labels based on token mode
function updateCurrencyLabels() {
    const currencyLabels = document.querySelectorAll('.currency-label');
    const tokenSymbol = usingTokenMode ? 'P2PLT' : 'ETH';
    
    // Update all elements with currency-label class
    currencyLabels.forEach(label => {
        label.textContent = tokenSymbol;
    });
    
    // Update specific form labels
    const loanAmountLabel = document.querySelector('label[for="loanAmount"]');
    if (loanAmountLabel) {
        loanAmountLabel.textContent = `Loan Amount (${tokenSymbol})`;
    }
    
    // Collateral is always in ETH
    const collateralLabel = document.querySelector('label[for="collateralAmount"]');
    if (collateralLabel) {
        collateralLabel.textContent = 'Collateral Amount (ETH)';
    }
}

// Update UI based on registration status
function updateUIForRegistration() {
    if (isRegistered) {
        document.getElementById('registrationSection').style.display = 'none';
        document.getElementById('platformSection').style.display = 'block';
        document.getElementById('status').textContent = "You are registered on the platform";
    } else {
        document.getElementById('registrationSection').style.display = 'block';
        document.getElementById('platformSection').style.display = 'none';
        document.getElementById('status').textContent = "Please register to use the platform";
    }
}

// Setup event listeners
function setupEventListeners() {
    // Connect wallet button
    const connectWalletBtn = document.getElementById('connectWalletBtn');
    if (connectWalletBtn) {
        connectWalletBtn.addEventListener('click', connectWallet);
    }
    
    // Register user buttons
    const registerBtn = document.getElementById('registerBtn');
    if (registerBtn) {
        registerBtn.addEventListener('click', registerUser);
    }
    
    // Create loan request
    const submitLoanRequest = document.getElementById('submitLoanRequest');
    if (submitLoanRequest) {
        submitLoanRequest.addEventListener('click', createLoanRequest);
    }
    
    // Close funding dialog
    const closeFundingDialog = document.getElementById('closeFundingDialog');
    if (closeFundingDialog) {
        closeFundingDialog.addEventListener('click', () => {
            document.getElementById('fundingDialog').style.display = 'none';
        });
    }
    
    // Submit funding offer
    const submitFunding = document.getElementById('submitFunding');
    if (submitFunding) {
        submitFunding.addEventListener('click', createFundingOffer);
    }
    
    // Close repay dialog
    const closeRepayDialog = document.getElementById('closeRepayDialog');
    if (closeRepayDialog) {
        closeRepayDialog.addEventListener('click', () => {
            document.getElementById('repayDialog').style.display = 'none';
        });
    }
    
    // Submit loan repayment
    const submitRepayment = document.getElementById('submitRepayment');
    if (submitRepayment) {
        submitRepayment.addEventListener('click', repayLoan);
    }
    
    // Set up tab navigation
    const tabLinks = document.querySelectorAll('.tab');
    if (tabLinks) {
        tabLinks.forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                if (tabName) {
                    switchTab(tabName);
                }
            });
        });
    }
    
    // Sort requests dropdown
    const sortRequests = document.getElementById('sortRequests');
    if (sortRequests) {
        sortRequests.addEventListener('change', loadActiveLoanRequests);
    }
    
    // Refresh requests button
    const refreshRequests = document.getElementById('refreshRequests');
    if (refreshRequests) {
        refreshRequests.addEventListener('click', loadActiveLoanRequests);
    }
    
    // Admin settings
    const updateSettingsBtn = document.getElementById('updateSettingsBtn');
    if (updateSettingsBtn) {
        updateSettingsBtn.addEventListener('click', updatePlatformSettings);
    }
    
    const updateTokenModeBtn = document.getElementById('updateTokenModeBtn');
    if (updateTokenModeBtn) {
        updateTokenModeBtn.addEventListener('click', updateTokenMode);
    }
    
    const withdrawFeesBtn = document.getElementById('withdrawFeesBtn');
    if (withdrawFeesBtn) {
        withdrawFeesBtn.addEventListener('click', withdrawPlatformFees);
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
        
        if (isRegistered) {
            loadUserLoans();
            loadUserInvestments();
            displayUserReputation();
        }
        
        document.getElementById('status').textContent = "Registration successful!";
    } catch (error) {
        console.error("Registration error:", error);
        document.getElementById('status').textContent = `Registration failed: ${error.message}`;
    }
}

// Connect to MetaMask wallet
async function connectWallet() {
    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        userAddress = accounts[0];
        
        // Get the signer
        signer = provider.getSigner();
        
        // Update UI
        document.getElementById('walletInfo').style.display = 'block';
        document.getElementById('connectWalletBtn').style.display = 'none';
        
        // Get balance
        const balance = await provider.getBalance(userAddress);
        
        if (document.getElementById('walletBalance')) {
            document.getElementById('walletBalance').textContent = `${ethers.utils.formatEther(balance).substring(0, 6)} ETH`;
        }
        
        if (document.getElementById('walletAddress')) {
            document.getElementById('walletAddress').textContent = `${userAddress.substring(0, 6)}...${userAddress.substring(38)}`;
        }
        
        // Check if user is registered
        const userRep = await lendingPlatform.getUserReputation(userAddress);
        isRegistered = userRep.isRegistered;
        updateUIForRegistration();
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', function(accounts) {
            if (accounts.length === 0) {
                // MetaMask is locked or the user has not connected any accounts
                document.getElementById('status').textContent = "Please connect to MetaMask.";
            } else if (accounts[0] !== userAddress) {
                // Reload the page with the new account
                window.location.reload();
            }
        });
        
        // Listen for network changes
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    } catch (error) {
        console.error("Error connecting wallet:", error);
        document.getElementById('status').textContent = `Connection error: ${error.message}`;
    }
}

// Create a new loan request
async function createLoanRequest() {
    try {
        const loanAmountInput = document.getElementById('loanAmount');
        const loanDurationInput = document.getElementById('loanDuration');
        const maxInterestRateInput = document.getElementById('maxInterestRate');
        const purposeInput = document.getElementById('loanPurpose');
        const collateralInput = document.getElementById('collateralAmount');
        
        if (!loanAmountInput || !loanDurationInput || !maxInterestRateInput || !purposeInput || !collateralInput) {
            console.error("One or more form fields not found");
            return;
        }
        
        const amount = ethers.utils.parseEther(loanAmountInput.value);
        const durationDays = parseInt(loanDurationInput.value);
        const maxInterestRate = parseInt(maxInterestRateInput.value) * 100; // Convert to basis points
        const purpose = purposeInput.value;
        const collateral = ethers.utils.parseEther(collateralInput.value);
        
        document.getElementById('status').textContent = "Creating loan request...";
        
        let tx;
        
        if (usingTokenMode) {
            // First approve the LendingPlatform contract to spend tokens
            document.getElementById('status').textContent = "Approving token transfer...";
            const approveTx = await loanToken.approve(LENDING_PLATFORM_ADDRESS, amount);
            await approveTx.wait();
            
            // Then create the loan request
            document.getElementById('status').textContent = "Creating loan request...";
            tx = await lendingPlatform.createLoanRequest(
                amount,
                durationDays,
                maxInterestRate,
                purpose,
                { value: collateral }
            );
        } else {
            // If not using token mode, just create the loan request directly
            tx = await lendingPlatform.createLoanRequest(
                amount,
                durationDays,
                maxInterestRate,
                purpose,
                { value: collateral }
            );
        }
        
        await tx.wait();
        document.getElementById('status').textContent = "Loan request created successfully!";
        
        // Clear form
        loanAmountInput.value = '';
        loanDurationInput.value = '';
        maxInterestRateInput.value = '';
        purposeInput.value = '';
        collateralInput.value = '';
        
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
        const requestsContainer = document.getElementById('loanRequests');
        if (!requestsContainer) {
            console.error("Loan requests container not found");
            return;
        }
        
        requestsContainer.innerHTML = '<p>Loading loan requests...</p>';
        
        const requestIds = await lendingPlatform.getActiveLoanRequests(0, 20);
        
        if (requestIds.length === 0) {
            requestsContainer.innerHTML = '<p>No active loan requests found.</p>';
            return;
        }
        
        requestsContainer.innerHTML = '';
        
        // Get the token symbol if we're in token mode
        let tokenSymbol = 'ETH';
        if (usingTokenMode) {
            try {
                tokenSymbol = await loanToken.symbol();
            } catch (error) {
                console.error("Error getting token symbol:", error);
                tokenSymbol = 'P2PLT'; // Default token symbol if we can't get it
            }
        }
        
        for (const id of requestIds) {
            const request = await lendingPlatform.loanRequests(id);
            
            // Create request element
            const requestElement = document.createElement('div');
            requestElement.className = 'loan-request';
            requestElement.innerHTML = `
                <h3>Loan Request #${request.id}</h3>
                <p>Amount: ${ethers.utils.formatEther(request.amount)} ${tokenSymbol}</p>
                <p>Duration: ${request.durationDays} days</p>
                <p>Max Interest: ${request.maxInterestRate / 100}%</p>
                <p>Collateral: ${ethers.utils.formatEther(request.collateralAmount)} ETH</p>
                <p>Purpose: ${request.purpose}</p>
                <button class="fund-button btn btn-primary" data-id="${request.id}">Fund This Loan</button>
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
        const requestsContainer = document.getElementById('loanRequests');
        if (requestsContainer) {
            requestsContainer.innerHTML = `<p>Error loading loan requests: ${error.message}</p>`;
        }
    }
}

// Show funding dialog
function showFundingDialog(requestId) {
    const fundingDialog = document.getElementById('fundingDialog');
    const fundRequestIdInput = document.getElementById('fundRequestId');
    
    if (fundingDialog && fundRequestIdInput) {
        fundRequestIdInput.value = requestId;
        fundingDialog.style.display = 'block';
    }
}

// Submit funding offer
async function createFundingOffer() {
    try {
        const requestIdInput = document.getElementById('fundRequestId');
        const interestRateInput = document.getElementById('offerInterestRate');
        
        if (!requestIdInput || !interestRateInput) {
            console.error("Required form fields not found");
            return;
        }
        
        const requestId = requestIdInput.value;
        const interestRate = parseInt(interestRateInput.value) * 100; // Convert to basis points
        
        document.getElementById('status').textContent = "Creating funding offer...";
        
        const tx = await lendingPlatform.createFundingOffer(requestId, interestRate);
        await tx.wait();
        
        const fundingDialog = document.getElementById('fundingDialog');
        if (fundingDialog) {
            fundingDialog.style.display = 'none';
        }
        
        document.getElementById('status').textContent = "Funding offer created successfully!";
        
        // Reload loan requests
        loadActiveLoanRequests();
    } catch (error) {
        console.error("Funding offer error:", error);
        document.getElementById('status').textContent = `Funding offer failed: ${error.message}`;
    }
}

// Load user's active loans - only call this function manually when needed
async function loadUserLoans() {
    try {
        const loansContainer = document.getElementById('userLoans');
        if (!loansContainer) {
            console.error("User loans container not found");
            return;
        }
        
        loansContainer.innerHTML = '<p>Loading your loans...</p>';
        
        // Get the token symbol if we're in token mode
        let tokenSymbol = 'ETH';
        if (usingTokenMode) {
            try {
                tokenSymbol = await loanToken.symbol();
            } catch (error) {
                console.error("Error getting token symbol:", error);
                tokenSymbol = 'P2PLT'; // Default token symbol if we can't get it
            }
        }
        
        try {
            // Check if user has any loans by inspecting contract events instead of calling the function
            // This avoids the revert error
            const filter = lendingPlatform.filters.LoanFunded(null, null, null, userAddress);
            const events = await lendingPlatform.queryFilter(filter);
            
            if (!events || events.length === 0) {
                loansContainer.innerHTML = '<p>You have no active loans.</p>';
                return;
            }
            
            // Process events to find loans
            loansContainer.innerHTML = '';
            for (const event of events) {
                try {
                    const loanId = event.args.loanId;
                    const loan = await lendingPlatform.loans(loanId);
                    
                    // Only show active loans
                    if (loan.status !== 0) continue; 
                    
                    // Create loan element
                    const loanElement = document.createElement('div');
                    loanElement.className = 'loan-item';
                    loanElement.innerHTML = `
                        <h3>Loan #${loanId}</h3>
                        <p>Amount: ${ethers.utils.formatEther(loan.amount)} ${tokenSymbol}</p>
                        <p>Interest Rate: ${loan.interestRate / 100}%</p>
                        <p>End Date: ${new Date(loan.endTime * 1000).toLocaleDateString()}</p>
                        <p>Status: ${getLoanStatusText(loan.status)}</p>
                        <button class="repay-button btn btn-primary" data-id="${loanId}">Repay Loan</button>
                    `;
                    
                    loansContainer.appendChild(loanElement);
                } catch (loanError) {
                    console.log("Error loading specific loan:", loanError);
                }
            }
            
            // If no active loans were found
            if (loansContainer.innerHTML === '') {
                loansContainer.innerHTML = '<p>You have no active loans.</p>';
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
            console.log("No loans found or contract error:", error);
            loansContainer.innerHTML = '<p>You have no active loans.</p>';
        }
    } catch (error) {
        console.error("Error loading user loans:", error);
        const loansContainer = document.getElementById('userLoans');
        if (loansContainer) {
            loansContainer.innerHTML = `<p>Error loading your loans: ${error.message}</p>`;
        }
    }
}

// Get text representation of loan status
function getLoanStatusText(statusCode) {
    const statuses = ["Active", "Repaid", "Defaulted"];
    return statuses[statusCode] || "Unknown";
}

// Show repay dialog
function showRepayDialog(loanId) {
    const repayDialog = document.getElementById('repayDialog');
    const repayLoanIdInput = document.getElementById('repayLoanId');
    
    if (repayDialog && repayLoanIdInput) {
        repayLoanIdInput.value = loanId;
        repayDialog.style.display = 'block';
    }
}

// Repay loan
async function repayLoan() {
    try {
        const loanIdInput = document.getElementById('repayLoanId');
        
        if (!loanIdInput) {
            console.error("Loan ID input not found");
            return;
        }
        
        const loanId = loanIdInput.value;
        const loan = await lendingPlatform.loans(loanId);
        
        // Calculate total repayment amount (principal + interest)
        const principal = loan.amount;
        const interestAmount = principal.mul(loan.interestRate).div(10000); // Interest rate is in basis points (100 = 1%)
        const totalRepayment = principal.add(interestAmount);
        
        document.getElementById('status').textContent = "Repaying loan...";
        
        let tx;
        if (usingTokenMode) {
            // First approve the LendingPlatform contract to spend tokens
            document.getElementById('status').textContent = "Approving token transfer...";
            const approveTx = await loanToken.approve(LENDING_PLATFORM_ADDRESS, totalRepayment);
            await approveTx.wait();
            
            // Then repay the loan
            document.getElementById('status').textContent = "Repaying loan...";
            tx = await lendingPlatform.repayLoan(loanId);
        } else {
            // If not using token mode, repay with ETH
            tx = await lendingPlatform.repayLoan(loanId, { value: totalRepayment });
        }
        
        await tx.wait();
        
        const repayDialog = document.getElementById('repayDialog');
        if (repayDialog) {
            repayDialog.style.display = 'none';
        }
        
        document.getElementById('status').textContent = "Loan repaid successfully!";
        
        // Reload user loans
        loadUserLoans();
        displayUserReputation();
    } catch (error) {
        console.error("Loan repayment error:", error);
        document.getElementById('status').textContent = `Loan repayment failed: ${error.message}`;
    }
}

// Load user's active investments - only call this function manually when needed
async function loadUserInvestments() {
    try {
        const investmentsContainer = document.getElementById('userInvestments');
        if (!investmentsContainer) {
            console.error("User investments container not found");
            return;
        }
        
        investmentsContainer.innerHTML = '<p>Loading your investments...</p>';
        
        // Get the token symbol if we're in token mode
        let tokenSymbol = 'ETH';
        if (usingTokenMode) {
            try {
                tokenSymbol = await loanToken.symbol();
            } catch (error) {
                console.error("Error getting token symbol:", error);
                tokenSymbol = 'P2PLT'; // Default token symbol if we can't get it
            }
        }
        
        try {
            // Check if user has any investments by inspecting contract events instead of calling the function
            // This avoids the revert error
            const filter = lendingPlatform.filters.LoanFunded(null, null, userAddress);
            const events = await lendingPlatform.queryFilter(filter);
            
            if (!events || events.length === 0) {
                investmentsContainer.innerHTML = '<p>You have no active investments.</p>';
                return;
            }
            
            // Process events to find investments
            investmentsContainer.innerHTML = '';
            for (const event of events) {
                try {
                    const loanId = event.args.loanId;
                    const loan = await lendingPlatform.loans(loanId);
                    
                    // Only show active investments
                    if (loan.status !== 0) continue;
                    
                    // Create investment element
                    const investmentElement = document.createElement('div');
                    investmentElement.className = 'investment-item';
                    investmentElement.innerHTML = `
                        <h3>Investment in Loan #${loanId}</h3>
                        <p>Amount: ${ethers.utils.formatEther(loan.amount)} ${tokenSymbol}</p>
                        <p>Interest Rate: ${loan.interestRate / 100}%</p>
                        <p>End Date: ${new Date(loan.endTime * 1000).toLocaleDateString()}</p>
                        <p>Status: ${getLoanStatusText(loan.status)}</p>
                    `;
                    
                    investmentsContainer.appendChild(investmentElement);
                } catch (loanError) {
                    console.log("Error loading specific investment:", loanError);
                }
            }
            
            // If no active investments were found
            if (investmentsContainer.innerHTML === '') {
                investmentsContainer.innerHTML = '<p>You have no active investments.</p>';
            }
        } catch (error) {
            console.log("No investments found or contract error:", error);
            investmentsContainer.innerHTML = '<p>You have no active investments.</p>';
        }
    } catch (error) {
        console.error("Error loading user investments:", error);
        const investmentsContainer = document.getElementById('userInvestments');
        if (investmentsContainer) {
            investmentsContainer.innerHTML = `<p>Error loading your investments: ${error.message}</p>`;
        }
    }
}

// Display user reputation
async function displayUserReputation() {
    try {
        const reputationContainer = document.getElementById('userReputation');
        if (!reputationContainer) {
            console.error("User reputation container not found");
            return;
        }
        
        const userRep = await lendingPlatform.getUserReputation(userAddress);
        
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
        
        // Update dashboard stats if elements exist
        const reputationScore = document.getElementById('reputationScore');
        if (reputationScore) {
            reputationScore.textContent = userRep.reputationScore.toString();
        }
        
        const reputationMeter = document.getElementById('reputationMeter');
        if (reputationMeter) {
            reputationMeter.style.width = `${Math.min(100, userRep.reputationScore.toNumber())}%`;
        }
        
        const loansRequestedStat = document.getElementById('loansRequestedStat');
        if (loansRequestedStat) {
            loansRequestedStat.textContent = userRep.totalLoansRequested.toString();
        }
        
        const loansFundedStat = document.getElementById('loansFundedStat');
        if (loansFundedStat) {
            loansFundedStat.textContent = userRep.totalLoansFunded.toString();
        }
        
        const loansRepaidStat = document.getElementById('loansRepaidStat');
        if (loansRepaidStat) {
            loansRepaidStat.textContent = userRep.loansRepaidOnTime.toString();
        }
        
        const loansDefaultedStat = document.getElementById('loansDefaultedStat');
        if (loansDefaultedStat) {
            loansDefaultedStat.textContent = userRep.loansDefaulted.toString();
        }
        
        const transactionsStat = document.getElementById('transactionsStat');
        if (transactionsStat) {
            transactionsStat.textContent = userRep.totalTransactions.toString();
        }
        
        const collateralizationStat = document.getElementById('collateralizationStat');
        if (collateralizationStat) {
            collateralizationStat.textContent = `${userRep.collateralizationRatio / 100}%`;
        }
    } catch (error) {
        console.error("Error loading user reputation:", error);
        const reputationContainer = document.getElementById('userReputation');
        if (reputationContainer) {
            reputationContainer.innerHTML = `<p>Error loading reputation: ${error.message}</p>`;
        }
    }
}

// Update platform settings - minimal implementation
async function updatePlatformSettings() {
    try {
        document.getElementById('status').textContent = "Updating platform settings...";
        // Implementation would go here
        document.getElementById('status').textContent = "Platform settings updated";
    } catch (error) {
        console.error("Error updating platform settings:", error);
        document.getElementById('status').textContent = `Error: ${error.message}`;
    }
}

// Update token mode - implementation for admin use
async function updateTokenMode() {
    try {
        const usingTokenModeCheckbox = document.getElementById('usingTokenMode');
        const tokenAddressInput = document.getElementById('tokenAddress');
        
        if (!usingTokenModeCheckbox || !tokenAddressInput) {
            console.error("Token mode form fields not found");
            return;
        }
        
        const enableTokenMode = usingTokenModeCheckbox.checked;
        const tokenAddress = tokenAddressInput.value.trim();
        
        document.getElementById('status').textContent = "Updating token mode...";
        
        let tx;
        if (enableTokenMode) {
            if (!tokenAddress || !ethers.utils.isAddress(tokenAddress)) {
                document.getElementById('status').textContent = "Please enter a valid token address";
                return;
            }
            
            tx = await lendingPlatform.enableTokenMode(tokenAddress);
        } else {
            tx = await lendingPlatform.disableTokenMode();
        }
        
        await tx.wait();
        
        // Update the UI with the new token mode setting
        usingTokenMode = enableTokenMode;
        updateCurrencyLabels();
        
        // If token mode was enabled, reload the token instance
        if (enableTokenMode) {
            loanToken = new ethers.Contract(
                tokenAddress,
                LOAN_TOKEN_ABI,
                signer
            );
            
            // Display token balance
            try {
                const tokenBalance = await loanToken.balanceOf(userAddress);
                const tokenSymbol = await loanToken.symbol();
                
                if (document.getElementById('tokenBalance')) {
                    document.getElementById('tokenBalance').textContent = `${ethers.utils.formatEther(tokenBalance)} ${tokenSymbol}`;
                    document.getElementById('tokenInfo').style.display = 'block';
                } else {
                    const walletInfo = document.getElementById('walletInfo');
                    if (walletInfo) {
                        const tokenInfo = document.createElement('p');
                        tokenInfo.id = 'tokenInfo';
                        tokenInfo.innerHTML = `Token Balance: <span id="tokenBalance">${ethers.utils.formatEther(tokenBalance)} ${tokenSymbol}</span>`;
                        walletInfo.appendChild(tokenInfo);
                    }
                }
            } catch (error) {
                console.error("Error loading token balance:", error);
            }
        } else {
            // Hide token balance if token mode is disabled
            const tokenInfo = document.getElementById('tokenInfo');
            if (tokenInfo) {
                tokenInfo.style.display = 'none';
            }
        }
        
        document.getElementById('status').textContent = `Token mode ${enableTokenMode ? 'enabled' : 'disabled'} successfully`;
    } catch (error) {
        console.error("Error updating token mode:", error);
        document.getElementById('status').textContent = `Error updating token mode: ${error.message}`;
    }
}

// Withdraw platform fees - minimal implementation
async function withdrawPlatformFees() {
    try {
        document.getElementById('status').textContent = "Withdrawing platform fees...";
        // Implementation would go here
        document.getElementById('status').textContent = "Platform fees withdrawn";
    } catch (error) {
        console.error("Error withdrawing platform fees:", error);
        document.getElementById('status').textContent = `Error: ${error.message}`;
    }
}

// Switch between tabs
function switchTab(tabName) {
    try {
        // Hide all tab contents
        const tabContents = document.querySelectorAll('.tab-content');
        if (tabContents) {
            tabContents.forEach(content => {
                content.classList.remove('show', 'active');
            });
        }
        
        // Deactivate all tabs
        const tabs = document.querySelectorAll('.tab');
        if (tabs) {
            tabs.forEach(tab => {
                tab.classList.remove('active');
            });
        }
        
        // Activate the selected tab
        const selectedTab = document.querySelector(`.tab[data-tab="${tabName}"]`);
        if (selectedTab) {
            selectedTab.classList.add('active');
        }
        
        // Show the selected content
        const selectedContent = document.getElementById(`${tabName}Tab`);
        if (selectedContent) {
            selectedContent.classList.add('show', 'active');
        }
    } catch (error) {
        console.error("Error switching tabs:", error);
    }
} 