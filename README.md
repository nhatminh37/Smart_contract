# Transparency Trust - Decentralized Platforms for Charity and Lending

A blockchain-based ecosystem featuring a transparent charity fundraising platform and a peer-to-peer lending platform with reputation scoring.

## Ethereum Testnet Used
This project is deployed on the **Sepolia Testnet**. The charity smart contract address is: `0xb21d8633e9354bd9df7f8f6b92f70314ef00df18`. The lending platform contract will be deployed separately.

## Website 
The website is available at: https://nhatminh37.github.io/Smart_contract/

## Platforms

### 1. Charity Platform

- **Transparent Fundraising**: All donations are recorded on the blockchain
- **Democratic Fund Distribution**: Donors can vote on proposals for how funds should be used
- **Campaign Creation**: Admins can create campaigns for various causes
- **Fund Release Proposals**: Create and vote on proposals for fund distribution
- **Real-time Tracking**: See donation progress and voting results in real-time

### 2. P2P Lending Platform with Reputation Scoring

- **Dynamic Interest Rates**: Interest rates are adjusted based on borrowers' on-chain reputation scores
- **Reputation System**: User reputation is calculated based on transaction history and collateralization ratios
- **Collateralized Loans**: Borrowers provide collateral for their loans
- **Transparent Loan History**: All lending activities are recorded on the blockchain
- **User Dashboard**: Users can view their reputation score and lending statistics

## Project Structure

- `contracts/` - Smart contract code
  - `CharityFund.sol` - Contract for the charity platform
  - `LendingPlatform.sol` - Contract for the P2P lending platform
- `frontend/` - Frontend code for the lending platform
  - `lending.html` - Main HTML for the lending platform
  - `lending-app.js` - JavaScript for the lending platform
  - `lending-abi.js` - ABI for the lending contract
- `index.html` - Main HTML file for the charity platform
- `styles.css` - CSS styling for both platforms
- `app.js` - JavaScript for the charity platform
- `contract-abi.js` - Contract ABI for the charity platform

### Prerequisites

- MetaMask browser extension
- Sepolia testnet account with test ETH

## Using the Charity Platform

1. **Connect Wallet**: Click "Connect Wallet" and approve the MetaMask connection
2. **View Campaigns**: Browse active charity campaigns
3. **Make Donations**: Donate ETH to a campaign
4. **Create Proposals**: If you're a donor, propose how funds should be used
5. **Vote on Proposals**: Vote for or against proposals for fund distribution
6. **Admin Functions**: Contract owners can create campaigns and execute passed proposals

## Using the P2P Lending Platform

1. **Connect Wallet**: Connect your MetaMask wallet
2. **Register**: Register as a user on the platform
3. **Check Your Reputation**: View your current reputation score on the dashboard
4. **Browse Loan Requests**: View active loan requests from other users
5. **Request a Loan**: Create your own loan request with collateral
6. **Fund Loans**: Fund other users' loan requests
7. **Repay Loans**: Repay your active loans before the due date
8. **Manage Investments**: View and manage your investments in other users' loans

## Testnet Faucets

Get test ETH for trying the applications:
- [Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
- [Sepolia Faucet (Alchemy)](https://www.alchemy.com/faucets/ethereum-sepolia)

## License

This project is licensed under the MIT License.
