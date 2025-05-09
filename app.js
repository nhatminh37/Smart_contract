// Main application code
document.addEventListener('DOMContentLoaded', () => {
    // Elements
    const connectWalletBtn = document.getElementById('connectWallet');
    const walletAddressEl = document.getElementById('walletAddress');
    const campaignsListEl = document.getElementById('campaignsList');
    const donationFormEl = document.getElementById('donationForm');
    const selectedCampaignEl = document.getElementById('selectedCampaign');
    const donationAmountEl = document.getElementById('donationAmount');
    const donateBtn = document.getElementById('donateBtn');
    const donationStatusEl = document.getElementById('donationStatus');

    // Global variables
    let provider, signer, contract;
    let selectedCampaignId = null;
    let isConnecting = false;

    // Check if wallet is already connected
    async function checkWalletConnection() {
        if (window.ethereum) {
            try {
                // Check if we're already connected
                const accounts = await window.ethereum.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    initializeWeb3(accounts[0]);
                }
            } catch (error) {
                console.error("Error checking initial wallet connection:", error);
            }
        } else {
            console.log("MetaMask not detected");
            walletAddressEl.textContent = "MetaMask not detected";
        }
    }

    // Initialize Web3 and contract
    async function initializeWeb3(account) {
        try {
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            walletAddressEl.textContent = `${account.substring(0, 6)}...${account.substring(38)}`;
            connectWalletBtn.textContent = "Connected";
            
            // Check correct network (Sepolia)
            const network = await provider.getNetwork();
            if (network.chainId !== 11155111) { // Sepolia chain ID
                walletAddressEl.textContent = "Please connect to Sepolia Testnet";
                return;
            }
            
            // Initialize contract
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            
            // Load campaigns
            loadCampaigns();
        } catch (error) {
            console.error("Error initializing Web3:", error);
        }
    }

    // Connect to MetaMask
    async function connectWallet() {
        if (isConnecting) return; // Prevent multiple simultaneous connection attempts
        
        if (!window.ethereum) {
            alert("Please install MetaMask to use this application");
            walletAddressEl.textContent = "MetaMask not detected";
            return;
        }
        
        isConnecting = true;
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            const accounts = await provider.listAccounts();
            if (accounts.length > 0) {
                initializeWeb3(accounts[0]);
            }
        } catch (error) {
            console.error("MetaMask connection error:", error);
            if (error.code === 4001) {
                walletAddressEl.textContent = "Connection request denied";
            } else {
                walletAddressEl.textContent = "Connection failed";
            }
        } finally {
            isConnecting = false;
        }
    }

    // Load campaigns from the contract
    async function loadCampaigns() {
        try {
            campaignsListEl.innerHTML = "<p>Loading campaigns...</p>";
            
            const campaignCount = await contract.getCampaignCount();
            
            if (campaignCount.toNumber() === 0) {
                campaignsListEl.innerHTML = "<p>No active campaigns found.</p>";
                return;
            }
            
            campaignsListEl.innerHTML = ""; // Clear previous content
            
            for (let i = 1; i <= campaignCount; i++) {
                try {
                    const campaign = await contract.getCampaignDetails(i);
                    
                    // Create campaign card
                    const campaignCard = document.createElement('div');
                    campaignCard.className = 'campaign-card';
                    campaignCard.dataset.id = i;
                    
                    const progressPercentage = campaign.targetAmount.gt(0) 
                        ? (campaign.raisedAmount.mul(100).div(campaign.targetAmount)).toNumber() 
                        : 0;
                    
                    campaignCard.innerHTML = `
                        <h3>${campaign.name}</h3>
                        <p>${campaign.description}</p>
                        <div class="campaign-image">
                            <img src="${campaign.imageURI}" alt="${campaign.name}">
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                        </div>
                        <p>
                            <span>${ethers.utils.formatEther(campaign.raisedAmount)} ETH</span> of 
                            <span>${ethers.utils.formatEther(campaign.targetAmount)} ETH</span> raised
                        </p>
                        <p>Status: ${campaign.isActive ? 'Active' : 'Inactive'}</p>
                    `;
                    
                    // Add click event to select this campaign for donation
                    campaignCard.addEventListener('click', () => selectCampaign(i, campaign.name));
                    
                    campaignsListEl.appendChild(campaignCard);
                } catch (error) {
                    console.error(`Error loading campaign ${i}:`, error);
                }
            }
        } catch (error) {
            console.error("Error loading campaigns:", error);
            campaignsListEl.innerHTML = "<p>Error loading campaigns. Please try again.</p>";
        }
    }

    // Select a campaign for donation
    function selectCampaign(id, name) {
        selectedCampaignId = id;
        selectedCampaignEl.textContent = `Selected Campaign: ${name}`;
        donationFormEl.style.display = 'block';
        
        // Scroll to donation form
        donationFormEl.scrollIntoView({ behavior: 'smooth' });
    }

    // Make a donation
    async function donate() {
        if (!selectedCampaignId) {
            alert("Please select a campaign first");
            return;
        }
        
        const amount = donationAmountEl.value;
        if (!amount || amount <= 0) {
            alert("Please enter a valid donation amount");
            return;
        }
        
        try {
            donateBtn.disabled = true;
            donationStatusEl.textContent = "Processing donation...";
            
            // Convert ETH to Wei
            const donationValue = ethers.utils.parseEther(amount);
            
            // Make donation transaction
            const tx = await contract.donate(selectedCampaignId, {
                value: donationValue
            });
            
            donationStatusEl.textContent = "Transaction submitted! Waiting for confirmation...";
            
            // Wait for transaction to be mined
            await tx.wait();
            
            donationStatusEl.textContent = "Thank you for your donation!";
            donationAmountEl.value = "";
            
            // Reload campaigns to show updated amounts
            loadCampaigns();
        } catch (error) {
            console.error("Error making donation:", error);
            donationStatusEl.textContent = "Error: " + (error.message || "Failed to process donation");
        } finally {
            donateBtn.disabled = false;
        }
    }

    // Event listeners
    connectWalletBtn.addEventListener('click', connectWallet);
    donateBtn.addEventListener('click', donate);

    // Listen for account changes
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', accounts => {
            if (accounts.length > 0) {
                initializeWeb3(accounts[0]);
            } else {
                walletAddressEl.textContent = "Not connected";
                connectWalletBtn.textContent = "Connect Wallet";
            }
        });
        
        // Listen for chain changes
        window.ethereum.on('chainChanged', () => {
            window.location.reload(); // Recommended way to handle chain changes
        });
    }
    
    // Check for existing connections on page load
    checkWalletConnection();
});
