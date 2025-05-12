// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title LoanToken
 * @dev ERC20 token used for loans on the lending platform
 */
contract LoanToken is ERC20, ERC20Burnable, Ownable {
    address public lendingPlatform;
    
    event LendingPlatformChanged(address indexed newLendingPlatform);
    
    /**
     * @dev Create the token with a name and symbol
     */
    constructor(string memory name, string memory symbol) ERC20(name, symbol) Ownable(msg.sender) {
        // Initial supply of 1,000,000 tokens given to the contract deployer
        _mint(msg.sender, 1_000_000 * 10**decimals());
    }
    
    /**
     * @dev Update the lending platform address
     * @param _lendingPlatform The address of the lending platform contract
     */
    function setLendingPlatform(address _lendingPlatform) external onlyOwner {
        require(_lendingPlatform != address(0), "Invalid lending platform address");
        lendingPlatform = _lendingPlatform;
        emit LendingPlatformChanged(_lendingPlatform);
    }
    
    /**
     * @dev Mint new tokens (only the lending platform can call this)
     * @param to The address that will receive the minted tokens
     * @param amount The amount of tokens to mint
     */
    function mint(address to, uint256 amount) external {
        require(msg.sender == lendingPlatform || msg.sender == owner(), 
            "Only lending platform or owner can mint");
        _mint(to, amount);
    }
    
    /**
     * @dev Burn tokens (only the lending platform can call this)
     * @param from The address whose tokens will be burned
     * @param amount The amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) public override {
        if (msg.sender == lendingPlatform) {
            _burn(from, amount);
        } else {
            super.burnFrom(from, amount);
        }
    }
} 