# P2P Decentralized Lending Platform with Reputation Scoring

A blockchain-based peer-to-peer lending platform where interest rates are dynamically adjusted based on borrowers' on-chain reputation scores. This platform allows users to request loans, provide funding, and build a reputation through their lending and borrowing activities.

## Ethereum Testnet
This project is deployed on the **Sepolia Testnet**. Contract addresses:
- LendingPlatform: `0xd3cd71D656df76dB5e56099ddC009Ca14B3cb914`
- LoanToken (P2PLT): `0x1dA18b84cac0d9c9709E79e173C26932eB762564`

## Features

- **Dynamic Interest Rates**: Interest rates are adjusted based on borrowers' on-chain reputation scores
- **Reputation System**: User reputation is calculated based on transaction history and collateralization ratios
- **Collateralized Loans**: Borrowers provide collateral (ETH) for their loans
- **Dual Currency Support**: Support for both ETH and custom token (P2PLT) loans through token mode
- **Transparent Loan History**: All lending activities are recorded on the blockchain
- **User Dashboard**: Users can view their reputation score and lending statistics
- **Event-Based Tracking**: Track loan and investment activities through blockchain events

## Smart Contract Architecture

The platform consists of two primary smart contracts:

### LendingPlatform Contract
- Manages the core lending functionality
- Handles user registration and reputation scoring
- Processes loan requests, funding offers, and loan repayments
- Maintains collateral and enforces loan terms
- Supports both ETH and token-based lending

### LoanToken Contract (P2PLT)
- ERC20 token used for token-mode lending
- Used as an alternative to ETH for loan amounts
- Collateral is always in ETH regardless of token mode

## Project Structure

- `contracts/` - Smart contract code
  - `LendingPlatform.sol` - Main lending platform contract
  - `LoanToken.sol` - ERC20 token contract for token mode
- `index.html` - Main HTML for the lending platform
- `lending-app.js` - JavaScript for the lending platform interface
- `lending-abi.js` - ABIs for the smart contracts
- `styles.css` - CSS styling for the platform

## Technical Implementation

### Reputation System
Each user's reputation is calculated based on:
- Number of loans requested
- Number of loans funded
- On-time repayment rate
- Default rate
- Collateralization ratio
- Total transaction volume

Reputation scores affect the interest rates users can obtain, with higher reputation scores leading to more favorable rates.

### Token Mode
The platform supports two modes of operation:

1. **ETH Mode (Default)**: Loans are created, funded, and repaid using ETH
2. **Token Mode**: Loans are processed using the platform's custom ERC20 token (P2PLT)

In both modes, collateral is always provided in ETH for stability and security. Admin can toggle between modes through the admin panel or direct contract interaction.

### Prerequisites

- MetaMask browser extension
- Sepolia testnet account with test ETH
- For token mode: P2PLT tokens (can be obtained from platform admin)

## Using the P2P Lending Platform

1. **Connect Wallet**: Connect your MetaMask wallet to the Sepolia testnet
2. **Register**: Register as a user on the platform (one-time process)
3. **Check Your Reputation**: View your current reputation score on the dashboard
4. **Browse Loan Requests**: View active loan requests from other users
5. **Request a Loan**: 
   - Create your own loan request by specifying:
     - Loan amount (ETH or P2PLT in token mode)
     - Duration (in days)
     - Maximum interest rate you're willing to accept
     - Collateral amount (always in ETH)
     - Purpose of the loan
6. **Fund Loans**: 
   - Browse loan requests from other users
   - Make funding offers by specifying your desired interest rate
   - You cannot fund your own loan requests
7. **Repay Loans**: 
   - Repay your active loans before the due date
   - Repayment includes principal + interest
   - Upon successful repayment, your collateral is returned
8. **Manage Investments**: 
   - View and manage your investments in other users' loans
   - Monitor repayment status and due dates

## Error Handling

The platform includes robust error handling for various scenarios:
- Prevents users from funding their own loans
- Handles token approvals in token mode
- Gracefully manages contract errors for new users
- Uses event-based tracking as a fallback for problematic contract calls

## Testnet Resources

Get test ETH for trying the application:
- [Sepolia Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia)
- [Sepolia Faucet (Alchemy)](https://www.alchemy.com/faucets/ethereum-sepolia)

## Development and Testing

For local development and testing:

1. Clone the repository
2. Install dependencies
3. Use a local Ethereum development environment (Hardhat, Ganache, etc.)
4. Deploy contracts locally for testing
5. Configure `lending-abi.js` with your local contract addresses

## License

This project is licensed under the MIT License.
