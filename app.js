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

    // Add admin section to the HTML
    const mainEl = document.querySelector('main');
    const adminSection = document.createElement('section');
    adminSection.className = 'admin-section';
    adminSection.innerHTML = `
        <h2>Admin Functions</h2>
        <div id="adminPanel" style="display: none;">
            <h3>Create Campaign</h3>
            <form id="createCampaignForm">
                <div>
                    <label for="campaignName">Name:</label>
                    <input type="text" id="campaignName" placeholder="Campaign Name" required>
                </div>
                <div>
                    <label for="campaignDescription">Description:</label>
                    <textarea id="campaignDescription" placeholder="Campaign Description" required></textarea>
                </div>
                <div>
                    <label for="campaignImageURI">Image URL:</label>
                    <input type="text" id="campaignImageURI" placeholder="Image URL" value="https://placehold.co/400x200?text=Campaign+Image" required>
                </div>
                <div>
                    <label for="campaignTarget">Target Amount (ETH):</label>
                    <input type="number" id="campaignTarget" placeholder="Target Amount" step="0.01" min="0.01" required>
                </div>
                <div>
                    <label for="campaignBeneficiary">Beneficiary Address:</label>
                    <input type="text" id="campaignBeneficiary" placeholder="Beneficiary Address" required>
                </div>
                <button type="submit" id="createCampaignBtn">Create Campaign</button>
            </form>
            <p id="createCampaignStatus"></p>
        </div>
    `;
    mainEl.appendChild(adminSection);

    // Global variables
    let provider, signer, contract;
    let selectedCampaignId = null;
    let currentAccount = null;
    const CONTRACT_OWNER = '0x00ED48da0A7a1a6E369A2825e5C6A98584C0f44d'.toLowerCase();
    
    // Simple connection function with minimal dependencies
    async function connectWallet() {
        console.log("Connect button clicked");
        
        // Check if MetaMask is installed
        if (typeof window.ethereum === 'undefined') {
            console.error("MetaMask is not installed");
            walletAddressEl.textContent = "MetaMask not installed";
            return;
        }
        
        walletAddressEl.textContent = "Connecting...";
        
        try {
            // Request account access
            console.log("Requesting accounts...");
            const accounts = await ethereum.request({ method: 'eth_requestAccounts' });
            const account = accounts[0];
            currentAccount = account.toLowerCase();
            
            console.log("Connected account:", account);
            walletAddressEl.textContent = `${account.substring(0, 6)}...${account.substring(38)}`;
            connectWalletBtn.textContent = "Connected";
            
            // Get network info
            provider = new ethers.providers.Web3Provider(window.ethereum);
            const network = await provider.getNetwork();
            console.log("Network:", network);
            
            // Check if on Sepolia testnet
            if (network.chainId !== 11155111) {
                console.error("Not connected to Sepolia testnet");
                walletAddressEl.textContent = "Please switch to Sepolia testnet";
                return;
            }
            
            // Initialize contract
            signer = provider.getSigner();
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            
            // Check if user is contract owner
            if (currentAccount === CONTRACT_OWNER) {
                console.log("User is contract owner, displaying admin panel");
                document.getElementById('adminPanel').style.display = 'block';
            } else {
                console.log("User is not contract owner");
                document.getElementById('adminPanel').style.display = 'none';
            }
            
            // Load campaigns
            loadCampaigns();
            
        } catch (error) {
            console.error("Error connecting wallet:", error);
            if (error.code === 4001) {
                // User rejected request
                walletAddressEl.textContent = "Connection rejected";
            } else {
                walletAddressEl.textContent = "Connection failed";
            }
        }
    }

    // Create a campaign (admin function)
    async function createCampaign(event) {
        event.preventDefault();
        
        if (currentAccount !== CONTRACT_OWNER) {
            alert("Only the contract owner can create campaigns");
            return;
        }
        
        const name = document.getElementById('campaignName').value;
        const description = document.getElementById('campaignDescription').value;
        const imageURI = document.getElementById('campaignImageURI').value;
        const targetAmount = ethers.utils.parseEther(document.getElementById('campaignTarget').value);
        const beneficiary = document.getElementById('campaignBeneficiary').value;
        
        const statusEl = document.getElementById('createCampaignStatus');
        statusEl.textContent = "Creating campaign...";
        
        try {
            console.log("Creating campaign with params:", { name, description, imageURI, targetAmount: targetAmount.toString(), beneficiary });
            
            const tx = await contract.createCampaign(
                name,
                description,
                imageURI,
                targetAmount,
                beneficiary
            );
            
            statusEl.textContent = "Transaction submitted! Waiting for confirmation...";
            await tx.wait();
            
            statusEl.textContent = "Campaign created successfully!";
            
            // Reset form
            document.getElementById('createCampaignForm').reset();
            
            // Reload campaigns
            loadCampaigns();
            
        } catch (error) {
            console.error("Error creating campaign:", error);
            statusEl.textContent = "Error: " + (error.message || "Failed to create campaign");
        }
    }

    // Load campaigns from the contract
    async function loadCampaigns() {
        try {
            console.log("Loading campaigns...");
            campaignsListEl.innerHTML = "<p>Loading campaigns...</p>";
            
            const campaignCount = await contract.getCampaignCount();
            console.log("Campaign count:", campaignCount.toString());
            
            if (campaignCount.toNumber() === 0) {
                campaignsListEl.innerHTML = "<p>No active campaigns found.</p>";
                return;
            }
            
            campaignsListEl.innerHTML = ""; // Clear previous content
            
            for (let i = 1; i <= campaignCount; i++) {
                try {
                    console.log(`Loading campaign ${i}...`);
                    const campaign = await contract.getCampaignDetails(i);
                    console.log(`Campaign ${i} details:`, campaign);
                    
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
    document.getElementById('createCampaignForm').addEventListener('submit', createCampaign);

    // Listen for account changes
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            console.log("Accounts changed:", accounts);
            if (accounts.length > 0) {
                const account = accounts[0];
                walletAddressEl.textContent = `${account.substring(0, 6)}...${account.substring(38)}`;
            } else {
                walletAddressEl.textContent = "Not connected";
                connectWalletBtn.textContent = "Connect Wallet";
            }
        });
        
        // Listen for chain changes
        window.ethereum.on('chainChanged', () => {
            console.log("Chain changed, reloading page");
            window.location.reload(); // Recommended way to handle chain changes
        });
    }
});
