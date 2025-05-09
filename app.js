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

    // Create proposal and voting sections
    const proposalSection = document.createElement('section');
    proposalSection.className = 'proposal-section';
    proposalSection.id = 'proposalSection';
    proposalSection.style.display = 'none';
    proposalSection.innerHTML = `
        <h2>Create Fund Release Proposal</h2>
        <p>As a donor, you can propose how funds should be used for this campaign.</p>
        <form id="createProposalForm">
            <div>
                <label for="proposalDescription">Proposal Description:</label>
                <textarea id="proposalDescription" placeholder="Describe how funds should be used" required></textarea>
            </div>
            <div>
                <label for="proposalAmount">Amount (ETH):</label>
                <input type="number" id="proposalAmount" placeholder="Amount to release" step="0.01" min="0.01" required>
            </div>
            <button type="submit" id="createProposalBtn">Submit Proposal</button>
        </form>
        <p id="proposalStatus"></p>
    `;

    const votingSection = document.createElement('section');
    votingSection.className = 'voting-section';
    votingSection.id = 'votingSection';
    votingSection.style.display = 'none';
    votingSection.innerHTML = `
        <h2>Vote on Proposals</h2>
        <p>Cast your vote on active proposals for fund distribution.</p>
        <div id="proposalsList"></div>
    `;

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

            <h3>Execute Proposals</h3>
            <div id="adminProposalsList"></div>
        </div>
    `;

    // Insert sections in the correct order
    const campaignsSection = document.querySelector('.campaigns-section');
    mainEl.insertBefore(adminSection, campaignsSection.nextSibling);
    mainEl.insertBefore(proposalSection, adminSection);
    mainEl.insertBefore(votingSection, proposalSection);

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
                loadAdminProposals();
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

    // Create a proposal for fund release
    async function createProposal(event) {
        event.preventDefault();
        
        if (!selectedCampaignId) {
            alert("Please select a campaign first");
            return;
        }
        
        const description = document.getElementById('proposalDescription').value;
        const amount = ethers.utils.parseEther(document.getElementById('proposalAmount').value);
        
        const statusEl = document.getElementById('proposalStatus');
        statusEl.textContent = "Creating proposal...";
        
        try {
            const tx = await contract.createFundReleaseProposal(
                selectedCampaignId,
                description,
                amount
            );
            
            statusEl.textContent = "Transaction submitted! Waiting for confirmation...";
            await tx.wait();
            
            statusEl.textContent = "Proposal created successfully!";
            
            // Reset form
            document.getElementById('createProposalForm').reset();
            
            // Reload proposals
            await loadProposals(selectedCampaignId);
            
        } catch (error) {
            console.error("Error creating proposal:", error);
            statusEl.textContent = "Error: " + (error.message || "Failed to create proposal");
        }
    }

    // Vote on a proposal
    async function voteOnProposal(proposalId, inSupport) {
        try {
            console.log(`Voting ${inSupport ? 'for' : 'against'} proposal ${proposalId}`);
            
            const tx = await contract.voteOnProposal(proposalId, inSupport);
            await tx.wait();
            
            alert(`Vote ${inSupport ? 'for' : 'against'} proposal ${proposalId} has been recorded!`);
            
            // Reload proposals
            if (selectedCampaignId) {
                await loadProposals(selectedCampaignId);
            }
            if (currentAccount === CONTRACT_OWNER) {
                await loadAdminProposals();
            }
            
        } catch (error) {
            console.error("Error voting on proposal:", error);
            alert("Error: " + (error.message || "Failed to vote on proposal"));
        }
    }

    // Execute a proposal (admin function)
    async function executeProposal(proposalId) {
        if (currentAccount !== CONTRACT_OWNER) {
            alert("Only the contract owner can execute proposals");
            return;
        }
        
        try {
            console.log(`Executing proposal ${proposalId}`);
            
            const tx = await contract.executeProposal(proposalId);
            await tx.wait();
            
            alert(`Proposal ${proposalId} has been executed successfully!`);
            
            // Reload proposals and campaigns
            loadCampaigns();
            if (selectedCampaignId) {
                await loadProposals(selectedCampaignId);
            }
            await loadAdminProposals();
            
        } catch (error) {
            console.error("Error executing proposal:", error);
            alert("Error: " + (error.message || "Failed to execute proposal"));
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
                        <div class="card-actions">
                            <button class="donate-btn">Donate</button>
                            <button class="proposal-btn">Propose</button>
                            <button class="view-proposals-btn">View Proposals</button>
                        </div>
                    `;
                    
                    campaignsListEl.appendChild(campaignCard);
                    
                    // Add event listeners to buttons
                    const donateBtn = campaignCard.querySelector('.donate-btn');
                    const proposeBtn = campaignCard.querySelector('.proposal-btn');
                    const viewProposalsBtn = campaignCard.querySelector('.view-proposals-btn');
                    
                    donateBtn.addEventListener('click', () => selectCampaign(i, campaign.name));
                    proposeBtn.addEventListener('click', () => openProposalForm(i, campaign.name));
                    viewProposalsBtn.addEventListener('click', () => loadProposals(i));
                    
                } catch (error) {
                    console.error(`Error loading campaign ${i}:`, error);
                }
            }
        } catch (error) {
            console.error("Error loading campaigns:", error);
            campaignsListEl.innerHTML = "<p>Error loading campaigns. Please try again.</p>";
        }
    }

    // Load proposals for a campaign
    async function loadProposals(campaignId) {
        const proposalsListEl = document.getElementById('proposalsList');
        votingSection.style.display = 'block';
        
        try {
            proposalsListEl.innerHTML = "<p>Loading proposals...</p>";
            
            // Get proposal count (You will need to add this function to your contract)
            // Since we don't have a direct way to get this, we'll assume a maximum and try to load them
            const maxProposalCount = 10; // Adjust based on your expectations
            let foundProposals = false;
            
            proposalsListEl.innerHTML = ""; // Clear previous content
            
            for (let i = 1; i <= maxProposalCount; i++) {
                try {
                    // Try to get proposal details
                    const proposal = await contract.proposals(i);
                    
                    // Check if this proposal belongs to the selected campaign
                    if (proposal.campaignId.toString() === campaignId.toString()) {
                        foundProposals = true;
                        
                        const proposalCard = document.createElement('div');
                        proposalCard.className = 'proposal-card';
                        
                        const hasVoted = await contract.hasVotedOnProposal(i, currentAccount);
                        const executed = proposal.executed;
                        
                        proposalCard.innerHTML = `
                            <h3>Proposal #${proposal.id}</h3>
                            <p>${proposal.description}</p>
                            <p>Amount: ${ethers.utils.formatEther(proposal.amount)} ETH</p>
                            <p>Votes For: ${proposal.votesFor}</p>
                            <p>Votes Against: ${proposal.votesAgainst}</p>
                            <p>Status: ${executed ? 'Executed' : 'Pending'}</p>
                            <div class="proposal-actions" ${executed || hasVoted ? 'style="display:none;"' : ''}>
                                <button class="vote-for-btn" data-id="${proposal.id}">Vote For</button>
                                <button class="vote-against-btn" data-id="${proposal.id}">Vote Against</button>
                            </div>
                        `;
                        
                        proposalsListEl.appendChild(proposalCard);
                        
                        // Add event listeners for voting
                        if (!executed && !hasVoted) {
                            const voteForBtn = proposalCard.querySelector('.vote-for-btn');
                            const voteAgainstBtn = proposalCard.querySelector('.vote-against-btn');
                            
                            voteForBtn.addEventListener('click', () => voteOnProposal(proposal.id, true));
                            voteAgainstBtn.addEventListener('click', () => voteOnProposal(proposal.id, false));
                        }
                    }
                } catch (error) {
                    console.log(`No proposal at index ${i} or error:`, error);
                }
            }
            
            if (!foundProposals) {
                proposalsListEl.innerHTML = "<p>No proposals found for this campaign.</p>";
            }
        } catch (error) {
            console.error("Error loading proposals:", error);
            proposalsListEl.innerHTML = "<p>Error loading proposals. Please try again.</p>";
        }
    }

    // Load proposals for admin to execute
    async function loadAdminProposals() {
        const adminProposalsListEl = document.getElementById('adminProposalsList');
        
        try {
            adminProposalsListEl.innerHTML = "<p>Loading proposals...</p>";
            
            // Similar to loadProposals but filter for ones that can be executed
            const maxProposalCount = 10;
            let foundProposals = false;
            
            adminProposalsListEl.innerHTML = "";
            
            for (let i = 1; i <= maxProposalCount; i++) {
                try {
                    const proposal = await contract.proposals(i);
                    
                    // Only show proposals that are not executed and have more votes for than against
                    if (!proposal.executed && proposal.votesFor.gt(proposal.votesAgainst)) {
                        foundProposals = true;
                        
                        const proposalCard = document.createElement('div');
                        proposalCard.className = 'proposal-card';
                        
                        proposalCard.innerHTML = `
                            <h3>Proposal #${proposal.id} (Campaign #${proposal.campaignId})</h3>
                            <p>${proposal.description}</p>
                            <p>Amount: ${ethers.utils.formatEther(proposal.amount)} ETH</p>
                            <p>Votes For: ${proposal.votesFor}</p>
                            <p>Votes Against: ${proposal.votesAgainst}</p>
                            <button class="execute-btn" data-id="${proposal.id}">Execute Proposal</button>
                        `;
                        
                        adminProposalsListEl.appendChild(proposalCard);
                        
                        // Add event listener for execution
                        const executeBtn = proposalCard.querySelector('.execute-btn');
                        executeBtn.addEventListener('click', () => executeProposal(proposal.id));
                    }
                } catch (error) {
                    console.log(`No proposal at index ${i} or error:`, error);
                }
            }
            
            if (!foundProposals) {
                adminProposalsListEl.innerHTML = "<p>No proposals ready for execution.</p>";
            }
        } catch (error) {
            console.error("Error loading admin proposals:", error);
            adminProposalsListEl.innerHTML = "<p>Error loading proposals. Please try again.</p>";
        }
    }

    // Select a campaign for donation
    function selectCampaign(id, name) {
        selectedCampaignId = id;
        selectedCampaignEl.textContent = `Selected Campaign: ${name}`;
        donationFormEl.style.display = 'block';
        proposalSection.style.display = 'none';
        votingSection.style.display = 'none';
        
        // Scroll to donation form
        donationFormEl.scrollIntoView({ behavior: 'smooth' });
    }

    // Open proposal form for a campaign
    function openProposalForm(id, name) {
        selectedCampaignId = id;
        document.querySelector('#proposalSection h2').textContent = `Create Proposal for: ${name}`;
        proposalSection.style.display = 'block';
        donationFormEl.style.display = 'none';
        votingSection.style.display = 'none';
        
        // Scroll to proposal form
        proposalSection.scrollIntoView({ behavior: 'smooth' });
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
            
            // Reload campaigns
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
    document.getElementById('createProposalForm').addEventListener('submit', createProposal);

    // Listen for account changes
    if (window.ethereum) {
        window.ethereum.on('accountsChanged', (accounts) => {
            console.log("Accounts changed:", accounts);
            if (accounts.length > 0) {
                const account = accounts[0];
                currentAccount = account.toLowerCase();
                walletAddressEl.textContent = `${account.substring(0, 6)}...${account.substring(38)}`;
                
                // Check if user is contract owner
                if (currentAccount === CONTRACT_OWNER) {
                    document.getElementById('adminPanel').style.display = 'block';
                    loadAdminProposals();
                } else {
                    document.getElementById('adminPanel').style.display = 'none';
                }
                
                // Reload campaigns
                loadCampaigns();
            } else {
                walletAddressEl.textContent = "Not connected";
                connectWalletBtn.textContent = "Connect Wallet";
                currentAccount = null;
                document.getElementById('adminPanel').style.display = 'none';
            }
        });
        
        // Listen for chain changes
        window.ethereum.on('chainChanged', () => {
            console.log("Chain changed, reloading page");
            window.location.reload(); // Recommended way to handle chain changes
        });
    }
});
