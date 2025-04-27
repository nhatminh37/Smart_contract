// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

/**
 * @title CharityFund
 * @dev A decentralized platform for transparent charity and disaster relief fund management
 */
contract CharityFund is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    struct Campaign {
        uint256 id;
        string name;
        string description;
        string imageURI;
        uint256 targetAmount;
        uint256 raisedAmount;
        address payable beneficiary;
        bool isActive;
        bool fundsReleased;
        mapping(address => uint256) donations;
        address[] donors;
    }
    
    struct Proposal {
        uint256 id;
        uint256 campaignId;
        string description;
        uint256 amount;
        uint256 votesFor;
        uint256 votesAgainst;
        bool executed;
        address proposer;
        mapping(address => bool) hasVoted;
    }
    
    Counters.Counter private _campaignIds;
    Counters.Counter private _proposalIds;
    
    mapping(uint256 => Campaign) public campaigns;
    mapping(uint256 => Proposal) public proposals;
    
    // Events
    event CampaignCreated(uint256 indexed campaignId, string name, address beneficiary, uint256 targetAmount);
    event DonationReceived(uint256 indexed campaignId, address indexed donor, uint256 amount);
    event FundsReleased(uint256 indexed campaignId, uint256 amount);
    event CampaignStatusChanged(uint256 indexed campaignId, bool isActive);
    event ProposalCreated(uint256 indexed proposalId, uint256 indexed campaignId, string description, uint256 amount);
    event ProposalVoted(uint256 indexed proposalId, address indexed voter, bool inSupport);
    event ProposalExecuted(uint256 indexed proposalId, uint256 indexed campaignId, uint256 amount);
    
    // Functions for campaign creation, donations, proposals, and voting
    /**
     * @dev Create a new charity campaign
     */
    function createCampaign(
        string memory name,
        string memory description,
        string memory imageURI,
        uint256 targetAmount,
        address payable beneficiary
    ) public onlyOwner {
        require(targetAmount > 0, "Target amount must be greater than 0");
        require(beneficiary != address(0), "Beneficiary cannot be the zero address");
        
        _campaignIds.increment();
        uint256 campaignId = _campaignIds.current();
        
        Campaign storage campaign = campaigns[campaignId];
        campaign.id = campaignId;
        campaign.name = name;
        campaign.description = description;
        campaign.imageURI = imageURI;
        campaign.targetAmount = targetAmount;
        campaign.raisedAmount = 0;
        campaign.beneficiary = beneficiary;
        campaign.isActive = true;
        campaign.fundsReleased = false;
        
        emit CampaignCreated(campaignId, name, beneficiary, targetAmount);
    }

    /**
     * @dev Donate to a campaign
     */
    function donate(uint256 campaignId) public payable campaignExists(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        require(campaign.isActive, "Campaign is not active");
        require(msg.value > 0, "Donation amount must be greater than 0");
        
        // Record donation
        if (campaign.donations[msg.sender] == 0) {
            campaign.donors.push(msg.sender);
        }
        
        campaign.donations[msg.sender] += msg.value;
        campaign.raisedAmount += msg.value;
        
        emit DonationReceived(campaignId, msg.sender, msg.value);
    }

    /**
     * @dev Set campaign status (active/inactive)
     */
    function setCampaignStatus(uint256 campaignId, bool isActive) public onlyOwner campaignExists(campaignId) {
        campaigns[campaignId].isActive = isActive;
        emit CampaignStatusChanged(campaignId, isActive);
    }

    /**
     * @dev Create a proposal for fund release
     */
    function createFundReleaseProposal(
        uint256 campaignId, 
        string memory description, 
        uint256 amount
    ) public onlyDonor(campaignId) campaignExists(campaignId) {
        Campaign storage campaign = campaigns[campaignId];
        require(!campaign.fundsReleased, "Funds already released");
        require(amount <= campaign.raisedAmount, "Requested amount exceeds raised amount");
        
        _proposalIds.increment();
        uint256 proposalId = _proposalIds.current();
        
        Proposal storage proposal = proposals[proposalId];
        proposal.id = proposalId;
        proposal.campaignId = campaignId;
        proposal.description = description;
        proposal.amount = amount;
        proposal.votesFor = 0;
        proposal.votesAgainst = 0;
        proposal.executed = false;
        proposal.proposer = msg.sender;
        
        emit ProposalCreated(proposalId, campaignId, description, amount);
    }

    /**
     * @dev Vote on a proposal
     */
    function voteOnProposal(uint256 proposalId, bool inSupport) public proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        uint256 campaignId = proposal.campaignId;
        
        // Check if the sender is a donor of the campaign
        require(campaigns[campaignId].donations[msg.sender] > 0, "Only donors can vote");
        require(!proposal.hasVoted[msg.sender], "Already voted");
        require(!proposal.executed, "Proposal already executed");
        
        proposal.hasVoted[msg.sender] = true;
        
        if (inSupport) {
            proposal.votesFor += 1;
        } else {
            proposal.votesAgainst += 1;
        }
        
        emit ProposalVoted(proposalId, msg.sender, inSupport);
    }

    /**
     * @dev Execute a proposal if it has passed
     */
    function executeProposal(uint256 proposalId) public nonReentrant onlyOwner proposalExists(proposalId) {
        Proposal storage proposal = proposals[proposalId];
        uint256 campaignId = proposal.campaignId;
        Campaign storage campaign = campaigns[campaignId];
        
        require(!proposal.executed, "Proposal already executed");
        require(proposal.votesFor > proposal.votesAgainst, "Proposal did not pass");
        require(campaign.raisedAmount >= proposal.amount, "Insufficient funds");
        
        proposal.executed = true;
        campaign.fundsReleased = true;
        
        // Transfer funds to the beneficiary
        campaign.beneficiary.transfer(proposal.amount);
        
        emit ProposalExecuted(proposalId, campaignId, proposal.amount);
        emit FundsReleased(campaignId, proposal.amount);
    }

    // Modifiers
    modifier onlyDonor(uint256 campaignId) {
        bool isDonor = false;
        for (uint i = 0; i < campaigns[campaignId].donors.length; i++) {
            if (campaigns[campaignId].donors[i] == msg.sender) {
                isDonor = true;
                break;
            }
        }
        require(isDonor, "Only donors can perform this action");
        _;
    }

    modifier campaignExists(uint256 campaignId) {
        require(campaignId > 0 && campaignId <= _campaignIds.current(), "Campaign does not exist");
        _;
    }

    modifier proposalExists(uint256 proposalId) {
        require(proposalId > 0 && proposalId <= _proposalIds.current(), "Proposal does not exist");
        _;
    }
}