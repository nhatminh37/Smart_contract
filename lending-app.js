// Global variables
let provider;
let signer;
let lendingContract;
let currentAccount;
let isRegistered = false;

// Wait for DOM content to load
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize UI event listeners
    initializeUI();
    
    // Check if MetaMask is installed
    if (typeof window.ethereum !== 'undefined') {
        // Initialize provider
        provider = new ethers.providers.Web3Provider(window.ethereum);
        
        // Check if already connected
        const accounts = await provider.listAccounts();
        if (accounts.length > 0) {
            await connectWallet();
        }
    } else {
        alert('MetaMask is not installed. Please install it to use this application.');
    }
});

// Initialize UI event listeners
function initializeUI() {
    // Connect wallet button
    document.getElementById('connectWalletBtn').addEventListener('click', connectWallet);
    
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
    try {
        // Request account access
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        currentAccount = accounts[0];
        
        // Get the signer
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        
        // Create contract instance
        lendingContract = new ethers.Contract(lendingPlatformAddress, lendingPlatformABI, signer);
        
        // Update UI
        document.getElementById('walletAddress').textContent = `${currentAccount.substring(0, 6)}...${currentAccount.substring(38)}`;
        document.getElementById('connectWalletBtn').style.display = 'none';
        document.getElementById('walletInfo').style.display = 'block';
        
        // Get balance
        const balance = await provider.getBalance(currentAccount);
        document.getElementById('walletBalance').textContent = `${ethers.utils.formatEther(balance).substring(0, 6)} ETH`;
        
        // Check if user is registered
        await checkUserRegistration();
        
        // Listen for account changes
        window.ethereum.on('accountsChanged', handleAccountsChanged);
        
        // Listen for network changes
        window.ethereum.on('chainChanged', () => {
            window.location.reload();
        });
    } catch (error) {
        console.error('Error connecting to wallet:', error);
        alert('Failed to connect to your wallet. Please try again.');
    }
}

// Handle account changes
function handleAccountsChanged(accounts) {
    if (accounts.length === 0) {
        // MetaMask is locked or the user has not connected any accounts
        alert('Please connect to MetaMask.');
        resetUI();
    } else if (accounts[0] !== currentAccount) {
        currentAccount = accounts[0];
        // Reload the page to refresh the UI with the new account
        window.location.reload();
    }
}

// Reset UI when wallet disconnects
function resetUI() {
    document.getElementById('connectWalletBtn').style.display = 'block';
    document.getElementById('walletInfo').style.display = 'none';
    document.getElementById('registerSection').style.display = 'none';
    document.getElementById('platformSection').style.display = 'none';
}

// Check if user is registered
async function checkUserRegistration() {
    try {
        const userRep = await lendingContract.getUserReputation(currentAccount);
        isRegistered = userRep.isRegistered;
        
        if (isRegistered) {
            // Show platform UI
            document.getElementById('registerSection').style.display = 'none';
            document.getElementById('platformSection').style.display = 'block';
            
            // Load user data
            await loadUserDashboard();
            await loadActiveLoanRequests();
            await loadUserLoans();
            await loadUserInvestments();
        } else {
            // Show registration UI
            document.getElementById('registerSection').style.display = 'block';
            document.getElementById('platformSection').style.display = 'none';
        }
    } catch (error) {
        console.error('Error checking user registration:', error);
    }
}

// Register user
async function registerUser() {
    try {
        document.getElementById('loadingSpinner').style.display = 'block';
        
        const tx = await lendingContract.registerUser();
        await tx.wait();
        
        isRegistered = true;
        document.getElementById('registerSection').style.display = 'none';
        document.getElementById('platformSection').style.display = 'block';
        
        // Load initial data
        await loadUserDashboard();
        await loadActiveLoanRequests();
        
        document.getElementById('loadingSpinner').style.display = 'none';
    } catch (error) {
        document.getElementById('loadingSpinner').style.display = 'none';
        console.error('Error registering user:', error);
        alert('Failed to register. Please try again.');
    }
}

// Load user dashboard data
async function loadUserDashboard() {
    try {
        const userRep = await lendingContract.getUserReputation(currentAccount);
        
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

// Load active loan requests
async function loadActiveLoanRequests() {
    try {
        const container = document.getElementById('activeLoanRequestsContainer');
        container.innerHTML = '<p>Loading loan requests...</p>';
        
        // Get active loan requests (first 10)
        const requestIds = await lendingContract.getActiveLoanRequests(0, 10);
        
        if (requestIds.length === 0) {
            container.innerHTML = '<p>No active loan requests found.</p>';
            return;
        }
        
        // Clear container
        container.innerHTML = '';
        
        // Create a card for each request
        for (const id of requestIds) {
            const request = await lendingContract.loanRequests(id);
            
            // Skip if not active
            if (request.status !== 0) continue;
            
            // Calculate collateralization ratio and class
            const collateralRatio = (Number(ethers.utils.formatEther(request.collateralAmount)) / Number(ethers.utils.formatEther(request.amount))) * 100;
            let collateralClass = 'low-collateral';
            if (collateralRatio >= 150) {
                collateralClass = 'high-collateral';
            } else if (collateralRatio >= 100) {
                collateralClass = 'medium-collateral';
            }
            
            // Format creation date
            const creationDate = new Date(request.timestamp.toNumber() * 1000).toLocaleDateString();
            
            // Create card
            const cardHtml = `
                <div class="loan-request-card" data-id="${id}">
                    <div class="row">
                        <div class="col-md-8">
                            <h3>${request.purpose}</h3>
                            <p>Requested by: ${request.borrower.substring(0, 6)}...${request.borrower.substring(38)}</p>
                            <p>Created on: ${creationDate}</p>
                            <p>Duration: ${request.durationDays.toString()} days</p>
                        </div>
                        <div class="col-md-4 text-right">
                            <div class="interest-rate">${request.interestRate.toNumber() / 100}% APR</div>
                            <p>Amount: ${ethers.utils.formatEther(request.amount)} ETH</p>
                            <span class="collateral-ratio ${collateralClass}">
                                ${collateralRatio.toFixed(0)}% Collateral
                            </span>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-12">
                            <button class="btn-primary view-loan-btn" data-id="${id}">View Details</button>
                            ${request.borrower.toLowerCase() !== currentAccount.toLowerCase() ? 
                                `<button class="btn-primary fund-loan-btn" data-id="${id}" data-amount="${ethers.utils.formatEther(request.amount)}">Fund This Loan</button>` : 
                                `<button class="btn-danger cancel-loan-btn" data-id="${id}">Cancel Request</button>`
                            }
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML += cardHtml;
        }
        
        // Add event listeners for buttons
        document.querySelectorAll('.view-loan-btn').forEach(btn => {
            btn.addEventListener('click', () => viewLoanDetails(btn.getAttribute('data-id')));
        });
        
        document.querySelectorAll('.fund-loan-btn').forEach(btn => {
            btn.addEventListener('click', () => showFundLoanForm(
                btn.getAttribute('data-id'), 
                btn.getAttribute('data-amount')
            ));
        });
        
        document.querySelectorAll('.cancel-loan-btn').forEach(btn => {
            btn.addEventListener('click', () => cancelLoanRequest(btn.getAttribute('data-id')));
        });
    } catch (error) {
        console.error('Error loading loan requests:', error);
        document.getElementById('activeLoanRequestsContainer').innerHTML = '<p>Failed to load loan requests. Please try again later.</p>';
    }
}

// Load user's active loans
async function loadUserLoans() {
    try {
        const container = document.getElementById('myActiveLoansContainer');
        container.innerHTML = '<p>Loading your active loans...</p>';
        
        // Get user's active loans
        const loanIds = await lendingContract.getUserActiveLoans(currentAccount);
        
        if (loanIds.length === 0) {
            container.innerHTML = '<p>You have no active loans.</p>';
            return;
        }
        
        // Clear container
        container.innerHTML = '';
        
        // Create a card for each loan
        for (const id of loanIds) {
            const loan = await lendingContract.loans(id);
            
            // Calculate remaining time
            const currentTime = Math.floor(Date.now() / 1000);
            const endTime = loan.endTime.toNumber();
            const remainingTime = endTime - currentTime;
            const remainingDays = Math.max(0, Math.floor(remainingTime / (24 * 60 * 60)));
            
            // Calculate total due
            const interestAmount = loan.amount.mul(loan.interestRate).mul(loan.endTime.sub(loan.startTime)).div(ethers.BigNumber.from(365 * 24 * 60 * 60 * 100));
            const totalDue = loan.amount.add(interestAmount);
            const remainingDue = totalDue.sub(loan.repaidAmount);
            
            // Create card
            const cardHtml = `
                <div class="active-loan-card" data-id="${id}">
                    <div class="row">
                        <div class="col-md-8">
                            <h3>Loan #${id.toString()}</h3>
                            <p>Lender: ${loan.lender.substring(0, 6)}...${loan.lender.substring(38)}</p>
                            <p>Start date: ${new Date(loan.startTime.toNumber() * 1000).toLocaleDateString()}</p>
                            <p>Due date: ${new Date(loan.endTime.toNumber() * 1000).toLocaleDateString()}</p>
                            <p>Remaining time: ${remainingDays} days</p>
                        </div>
                        <div class="col-md-4 text-right">
                            <div class="interest-rate">${loan.interestRate.toNumber() / 100}% APR</div>
                            <p>Principal: ${ethers.utils.formatEther(loan.amount)} ETH</p>
                            <p>Repaid: ${ethers.utils.formatEther(loan.repaidAmount)} ETH</p>
                            <p>Remaining: ${ethers.utils.formatEther(remainingDue)} ETH</p>
                            <p>Collateral: ${ethers.utils.formatEther(loan.collateralAmount)} ETH</p>
                        </div>
                    </div>
                    <div class="row mt-3">
                        <div class="col-md-12">
                            <button class="btn-primary repay-loan-btn" 
                                data-id="${id}" 
                                data-remaining="${ethers.utils.formatEther(remainingDue)}">
                                Repay Loan
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            container.innerHTML += cardHtml;
        }
        
        // Add event listeners for repay buttons
        document.querySelectorAll('.repay-loan-btn').forEach(btn => {
            btn.addEventListener('click', () => showRepayLoanForm(
                btn.getAttribute('data-id'),
                btn.getAttribute('data-remaining')
            ));
        });
    } catch (error) {
        console.error('Error loading user loans:', error);
        document.getElementById('myActiveLoansContainer').innerHTML = '<p>Failed to load your loans. Please try again later.</p>';
    }
}

// Load user's investments
async function loadUserInvestments() {
    try {
        const container = document.getElementById('myInvestmentsContainer');
        container.innerHTML = '<p>Loading your investments...</p>';
        
        // Get user's active investments
        const loanIds = await lendingContract.getUserActiveInvestments(currentAccount);
        
        if (loanIds.length === 0) {
            container.innerHTML = '<p>You have no active investments.</p>';
            return;
        }
        
        // Clear container
        container.innerHTML = '';
        
        // Create a card for each investment
        for (const id of loanIds) {
            const loan = await lendingContract.loans(id);
            
            // Calculate remaining time
            const currentTime = Math.floor(Date.now() / 1000);
            const endTime = loan.endTime.toNumber();
            const remainingTime = endTime - currentTime;
            const remainingDays = Math.max(0, Math.floor(remainingTime / (24 * 60 * 60)));
            
            // Calculate expected return
            const interestAmount = loan.amount.mul(loan.interestRate).mul(loan.endTime.sub(loan.startTime)).div(ethers.BigNumber.from(365 * 24 * 60 * 60 * 100));
            const totalReturn = loan.amount.add(interestAmount);
            
            // Check if loan is past due
            const isPastDue = currentTime > endTime && loan.repaidAmount.lt(totalReturn);
            
            // Create card
            const cardHtml = `
                <div class="active-loan-card" data-id="${id}">
                    <div class="row">
                        <div class="col-md-8">
                            <h3>Investment #${id.toString()}</h3>
                            <p>Borrower: ${loan.borrower.substring(0, 6)}...${loan.borrower.substring(38)}</p>
                            <p>Start date: ${new Date(loan.startTime.toNumber() * 1000).toLocaleDateString()}</p>
                            <p>Due date: ${new Date(loan.endTime.toNumber() * 1000).toLocaleDateString()}</p>
                            <p>Remaining time: ${remainingDays} days</p>
                        </div>
                        <div class="col-md-4 text-right">
                            <div class="interest-rate">${loan.interestRate.toNumber() / 100}% APR</div>
                            <p>Principal: ${ethers.utils.formatEther(loan.amount)} ETH</p>
                            <p>Expected return: ${ethers.utils.formatEther(totalReturn)} ETH</p>
                            <p>Repaid so far: ${ethers.utils.formatEther(loan.repaidAmount)} ETH</p>
                            <p>Collateral: ${ethers.utils.formatEther(loan.collateralAmount)} ETH</p>
                        </div>
                    </div>
                    ${isPastDue ? `
                    <div class="row mt-3">
                        <div class="col-md-12">
                            <button class="btn-danger default-loan-btn" data-id="${id}">Mark as Defaulted</button>
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
            
            container.innerHTML += cardHtml;
        }
        
        // Add event listeners for default buttons
        document.querySelectorAll('.default-loan-btn').forEach(btn => {
            btn.addEventListener('click', () => markLoanDefaulted(btn.getAttribute('data-id')));
        });
    } catch (error) {
        console.error('Error loading user investments:', error);
        document.getElementById('myInvestmentsContainer').innerHTML = '<p>Failed to load your investments. Please try again later.</p>';
    }
}

// Create a new loan request
async function createLoanRequest() {
    try {
        const loanAmount = ethers.utils.parseEther(document.getElementById('loanAmount').value);
        const loanDuration = document.getElementById('loanDuration').value;
        const baseInterestRate = Math.floor(parseFloat(document.getElementById('baseInterestRate').value) * 100); // Convert to basis points
        const loanPurpose = document.getElementById('loanPurpose').value;
        const collateralAmount = ethers.utils.parseEther(document.getElementById('collateralAmount').value);
        
        document.getElementById('loadingSpinner').style.display = 'block';
        
        // Create the loan request
        const tx = await lendingContract.createLoanRequest(
            loanAmount,
            loanDuration,
            baseInterestRate,
            loanPurpose,
            { value: collateralAmount }
        );
        
        await tx.wait();
        
        // Reset form
        document.getElementById('loanRequestForm').reset();
        
        // Reload data
        await loadUserDashboard();
        await loadActiveLoanRequests();
        await loadUserLoans();
        
        // Switch to loan requests tab
        switchTab('loanRequests');
        
        document.getElementById('loadingSpinner').style.display = 'none';
        alert('Loan request created successfully!');
    } catch (error) {
        document.getElementById('loadingSpinner').style.display = 'none';
        console.error('Error creating loan request:', error);
        alert('Failed to create loan request. Please try again.');
    }
}

// Cancel a loan request
async function cancelLoanRequest(requestId) {
    try {
        if (!confirm('Are you sure you want to cancel this loan request? Your collateral will be returned.')) {
            return;
        }
        
        document.getElementById('loadingSpinner').style.display = 'block';
        
        const tx = await lendingContract.cancelLoanRequest(requestId);
        await tx.wait();
        
        // Reload data
        await loadActiveLoanRequests();
        await loadUserDashboard();
        
        document.getElementById('loadingSpinner').style.display = 'none';
        alert('Loan request cancelled successfully!');
    } catch (error) {
        document.getElementById('loadingSpinner').style.display = 'none';
        console.error('Error cancelling loan request:', error);
        alert('Failed to cancel loan request. Please try again.');
    }
}

// View loan details
async function viewLoanDetails(requestId) {
    try {
        const request = await lendingContract.loanRequests(requestId);
        const modal = document.getElementById('loanDetailsModal');
        const content = document.getElementById('loanDetailsContent');
        
        // Calculate collateralization ratio
        const collateralRatio = (Number(ethers.utils.formatEther(request.collateralAmount)) / Number(ethers.utils.formatEther(request.amount))) * 100;
        
        // Create content
        content.innerHTML = `
            <div class="loan-details">
                <p><strong>Borrower:</strong> ${request.borrower}</p>
                <p><strong>Loan Amount:</strong> ${ethers.utils.formatEther(request.amount)} ETH</p>
                <p><strong>Duration:</strong> ${request.durationDays.toString()} days</p>
                <p><strong>Interest Rate:</strong> ${request.interestRate.toNumber() / 100}% per year</p>
                <p><strong>Collateral:</strong> ${ethers.utils.formatEther(request.collateralAmount)} ETH</p>
                <p><strong>Collateralization Ratio:</strong> ${collateralRatio.toFixed(2)}%</p>
                <p><strong>Purpose:</strong> ${request.purpose}</p>
                <p><strong>Created:</strong> ${new Date(request.timestamp.toNumber() * 1000).toLocaleString()}</p>
            </div>
        `;
        
        // Show modal
        modal.style.display = 'block';
    } catch (error) {
        console.error('Error viewing loan details:', error);
        alert('Failed to load loan details. Please try again.');
    }
}

// Show fund loan form
function showFundLoanForm(requestId, amount) {
    const modal = document.getElementById('loanDetailsModal');
    const fundForm = document.getElementById('fundLoanForm');
    const fundAmount = document.getElementById('fundAmount');
    
    // Set fund amount
    fundAmount.textContent = amount;
    
    // Show fund form
    fundForm.style.display = 'block';
    
    // Set confirm button action
    document.getElementById('confirmFundBtn').onclick = () => fundLoan(requestId, amount);
    
    // Show modal
    modal.style.display = 'block';
}

// Fund a loan
async function fundLoan(requestId, amount) {
    try {
        document.getElementById('loadingSpinner').style.display = 'block';
        document.getElementById('loanDetailsModal').style.display = 'none';
        
        const amountInWei = ethers.utils.parseEther(amount);
        
        const tx = await lendingContract.fundLoan(requestId, { value: amountInWei });
        await tx.wait();
        
        // Reload data
        await loadUserDashboard();
        await loadActiveLoanRequests();
        await loadUserInvestments();
        
        document.getElementById('loadingSpinner').style.display = 'none';
        alert('Loan funded successfully!');
        
        // Switch to investments tab
        switchTab('myInvestments');
    } catch (error) {
        document.getElementById('loadingSpinner').style.display = 'none';
        console.error('Error funding loan:', error);
        alert('Failed to fund loan. Please try again.');
    }
}

// Show repay loan form
function showRepayLoanForm(loanId, remainingAmount) {
    const modal = document.getElementById('repayLoanModal');
    const content = document.getElementById('repayLoanContent');
    const repayInput = document.getElementById('repayAmount');
    
    // Create content
    content.innerHTML = `
        <p>Loan ID: ${loanId}</p>
        <p>Remaining amount to pay: ${remainingAmount} ETH</p>
    `;
    
    // Set maximum repay amount
    repayInput.max = remainingAmount;
    repayInput.value = remainingAmount;
    
    // Set form submission handler
    document.getElementById('repayLoanForm').onsubmit = (e) => {
        e.preventDefault();
        repayLoan(loanId, document.getElementById('repayAmount').value);
    };
    
    // Show modal
    modal.style.display = 'block';
}

// Repay a loan
async function repayLoan(loanId, amount) {
    try {
        document.getElementById('loadingSpinner').style.display = 'block';
        document.getElementById('repayLoanModal').style.display = 'none';
        
        const amountInWei = ethers.utils.parseEther(amount);
        
        const tx = await lendingContract.repayLoan(loanId, { value: amountInWei });
        await tx.wait();
        
        // Reload data
        await loadUserDashboard();
        await loadUserLoans();
        
        document.getElementById('loadingSpinner').style.display = 'none';
        alert('Loan repayment successful!');
    } catch (error) {
        document.getElementById('loadingSpinner').style.display = 'none';
        console.error('Error repaying loan:', error);
        alert('Failed to repay loan. Please try again.');
    }
}

// Mark a loan as defaulted
async function markLoanDefaulted(loanId) {
    try {
        if (!confirm('Are you sure you want to mark this loan as defaulted? You will claim the collateral.')) {
            return;
        }
        
        document.getElementById('loadingSpinner').style.display = 'block';
        
        const tx = await lendingContract.markLoanDefaulted(loanId);
        await tx.wait();
        
        // Reload data
        await loadUserDashboard();
        await loadUserInvestments();
        
        document.getElementById('loadingSpinner').style.display = 'none';
        alert('Loan marked as defaulted. Collateral has been claimed.');
    } catch (error) {
        document.getElementById('loadingSpinner').style.display = 'none';
        console.error('Error marking loan as defaulted:', error);
        alert('Failed to mark loan as defaulted. Please try again.');
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