# P2P Decentralized Lending Platform with Reputation Scoring

A blockchain-based peer-to-peer lending platform where interest rates are dynamically adjusted based on borrowers' on-chain reputation scores.

## Ethereum Testnet
This project is designed to be deployed on the **Sepolia Testnet**.

## Features

- **Dynamic Interest Rates**: Interest rates are adjusted based on borrowers' on-chain reputation scores
- **Reputation System**: User reputation is calculated based on transaction history and collateralization ratios
- **Collateralized Loans**: Borrowers provide collateral for their loans
- **Transparent Loan History**: All lending activities are recorded on the blockchain
- **User Dashboard**: Users can view their reputation score and lending statistics

## Project Structure

- `contracts/` - Smart contract code
  - `LendingPlatform.sol` - Contract for the P2P lending platform
- `lending.html` - Main HTML for the lending platform
- `lending-app.js` - JavaScript for the lending platform
- `lending-abi.js` - ABI for the lending contract
- `styles.css` - CSS styling for the platform

### Prerequisites

- MetaMask browser extension
- Sepolia testnet account with test ETH

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

Get test ETH for trying the application:
- [Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
- [Sepolia Faucet (Alchemy)](https://www.alchemy.com/faucets/ethereum-sepolia)

## License

This project is licensed under the MIT License.
