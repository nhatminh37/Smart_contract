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

    // Connect to MetaMask
    async function connectWallet() {
        if (!window.ethereum) {
            alert("Please install MetaMask to use this application");
            walletAddressEl.textContent = "MetaMask not detected";
            return;
        }
        try {
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            provider = new ethers.providers.Web3Provider(window.ethereum);
            signer = provider.getSigner();
            const address = await signer.getAddress();
            walletAddressEl.textContent = `${address.substring(0, 6)}...${address.substring(38)}`;
            connectWalletBtn.textContent = "Connected";
            
            // Initialize contract
            contract = new ethers.Contract(contractAddress, contractABI, signer);
            
            // Load campaigns
            loadCampaigns();
        } catch (error) {
            console.error("MetaMask connection error:", error);
            if (error.code === 4001) {
                walletAddressEl.textContent = "Connection request denied";
            } else {
                walletAddressEl.textContent = "Connection failed";
            }
        }
    }

    // Load campaigns from the contract
    async function loadCampaigns() {
        try {
            campaignsListEl.innerHTML = "<p>Loading campaigns...</p>";
            
            const campaignCount = await contract.getCampaignCount();
            let campaignsHTML = '';
            
            if (campaignCount.toNumber() === 0) {
                campaignsListEl.innerHTML = "<p>No active campaigns found.</p>";
                return;
            }
            
            for (let i = 1; i <= campaignCount; i++) {
                const campaign = await contract.getCampaignDetails(i);
                
                // Create campaign card
                const campaignCard = document.createElement('div');
                campaignCard.className = 'campaign-card';
                campaignCard.dataset.id = i;
                
                const progressPercentage = campaign[3].gt(0) 
                    ? (campaign[4].mul(100).div(campaign[3])).toNumber() 
                    : 0;
                
                campaignCard.innerHTML = `
                    <h3>${campaign[0]}</h3>
                    <p>${campaign[1]}</p>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                    </div>
                    <p>
                        <span>${ethers.utils.formatEther(campaign[4])} ETH</span> of 
                        <span>${ethers.utils.formatEther(campaign[3])} ETH</span> raised
                    </p>
                    <p>Status: ${campaign[6] ? 'Active' : 'Inactive'}</p>
                `;
                
                // Add click event to select this campaign for donation
                campaignCard.addEventListener('click', () => selectCampaign(i, campaign[0]));
                
                campaignsListEl.appendChild(campaignCard);
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
                connectWallet();
            } else {
                walletAddressEl.textContent = "Not connected";
                connectWalletBtn.textContent = "Connect Wallet";
            }
        });
    }
});
