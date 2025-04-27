# Transparency Trust - Decentralized Charity Platform

A blockchain-based platform for transparent charity and disaster relief fundraising, allowing donors to track and vote on how funds are distributed.

## Features

- **Transparent Fundraising**: All donations are recorded on the blockchain
- **Democratic Fund Distribution**: Donors can vote on proposals for how funds should be used
- **Campaign Creation**: Admins can create campaigns for various causes
- **Fund Release Proposals**: Create and vote on proposals for fund distribution
- **Real-time Tracking**: See donation progress and voting results in real-time

## Project Structure

- `contracts/` - Smart contract code
  - `CharityFund.sol` - Main contract for the charity platform
- `frontend/` - React-based web interface
  - `src/components/` - React components
  - `src/services/` - Services for blockchain interaction
  - `src/assets/` - CSS and images

## Technologies Used

- **Smart Contract**: Solidity
- **Blockchain**: Ethereum
- **Frontend**: React.js
- **Web3 Integration**: ethers.js
- **Development Tools**: Hardhat

## Setup and Deployment

### Prerequisites

- Node.js and npm installed
- MetaMask browser extension
- Ethereum testnet (Sepolia/Goerli) account with test ETH

### Smart Contract Deployment

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure your `.env` file with your private key and Infura/Alchemy API key:
   ```
   PRIVATE_KEY=your_private_key
   INFURA_API_KEY=your_infura_api_key
   ```

3. Deploy to a testnet (e.g., Sepolia):
   ```bash
   npx hardhat run scripts/deploy.js --network sepolia
   ```

4. Copy the deployed contract address and update it in `frontend/src/services/web3Service.js`.

### Frontend Development

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

4. The application will be available at `http://localhost:3000`.

### Hosting on GitHub Pages

1. Update the `homepage` field in `package.json`:
   ```json
   "homepage": "https://yourusername.github.io/transparency-trust"
   ```

2. Deploy to GitHub Pages:
   ```bash
   npm run deploy
   ```

## Using the DApp

1. **Connect Wallet**: Click "Connect Wallet" and approve the MetaMask connection
2. **View Campaigns**: Browse active charity campaigns
3. **Make Donations**: Donate ETH to a campaign
4. **Create Proposals**: If you're a donor, propose how funds should be used
5. **Vote on Proposals**: Vote for or against proposals for fund distribution
6. **Admin Functions**: Contract owners can create campaigns and execute passed proposals

## Testnet Faucets

Get test ETH for trying the application:
- [Sepolia Faucet](https://sepoliafaucet.com/)
- [Goerli Faucet](https://goerlifaucet.com/)

## License

This project is licensed under the MIT License.

## Acknowledgements

- OpenZeppelin for secure contract libraries
- Ethereum community for documentation and examples 