// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";

/**
 * @title MyToken
 * @dev Standard ERC20 token with additional features
 * @notice This exact contract works on Ethereum, Polygon, Arbitrum, and Kasplex!
 * 
 * Features:
 * - Standard ERC20 functionality (transfer, approve, etc.)
 * - Ownable: Only owner can mint new tokens
 * - ERC20Permit: Gasless approvals via signatures
 * - Mintable: Owner can create new tokens
 * - Burnable: Anyone can burn their own tokens
 */
contract MyToken is ERC20, Ownable, ERC20Permit {
    
    /// @notice Maximum supply cap (optional - remove if unlimited)
    uint256 public constant MAX_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    
    /// @notice Emitted when tokens are minted
    event TokensMinted(address indexed to, uint256 amount);
    
    /// @notice Emitted when tokens are burned
    event TokensBurned(address indexed from, uint256 amount);

    /**
     * @notice Contract constructor
     * @param name Token name (e.g. "My Awesome Token")
     * @param symbol Token symbol (e.g. "MAT")
     * @param initialSupply Initial token supply (will be minted to deployer)
     */
    constructor(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) 
        ERC20(name, symbol) 
        Ownable(msg.sender)
        ERC20Permit(name)
    {
        require(initialSupply <= MAX_SUPPLY, "Initial supply exceeds maximum");
        
        if (initialSupply > 0) {
            _mint(msg.sender, initialSupply * 10**decimals());
        }
    }

    /**
     * @notice Mint new tokens (only owner)
     * @param to Address to receive the minted tokens
     * @param amount Amount of tokens to mint (in wei, e.g. 1000 * 10**18 for 1000 tokens)
     */
    function mint(address to, uint256 amount) public onlyOwner {
        require(to != address(0), "Cannot mint to zero address");
        require(totalSupply() + amount <= MAX_SUPPLY, "Would exceed maximum supply");
        
        _mint(to, amount);
        emit TokensMinted(to, amount);
    }

    /**
     * @notice Batch mint tokens to multiple addresses (gas efficient)
     * @param recipients Array of addresses to receive tokens
     * @param amounts Array of amounts to mint to each recipient
     */
    function batchMint(
        address[] calldata recipients, 
        uint256[] calldata amounts
    ) public onlyOwner {
        require(recipients.length == amounts.length, "Arrays length mismatch");
        require(recipients.length <= 200, "Too many recipients"); // Prevent gas limit issues
        
        uint256 totalAmount = 0;
        for (uint256 i = 0; i < amounts.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(totalSupply() + totalAmount <= MAX_SUPPLY, "Would exceed maximum supply");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(recipients[i] != address(0), "Cannot mint to zero address");
            _mint(recipients[i], amounts[i]);
            emit TokensMinted(recipients[i], amounts[i]);
        }
    }
    
    /**
     * @notice Burn tokens from your own balance
     * @param amount Amount of tokens to burn
     */
    function burn(uint256 amount) public {
        require(balanceOf(msg.sender) >= amount, "Insufficient balance to burn");
        
        _burn(msg.sender, amount);
        emit TokensBurned(msg.sender, amount);
    }

    /**
     * @notice Burn tokens from another address (requires approval)
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn
     */
    function burnFrom(address from, uint256 amount) public {
        uint256 currentAllowance = allowance(from, msg.sender);
        require(currentAllowance >= amount, "Insufficient allowance");
        
        _approve(from, msg.sender, currentAllowance - amount);
        _burn(from, amount);
        emit TokensBurned(from, amount);
    }

    /**
     * @notice Get token information
     * @return name_ Token name
     * @return symbol_ Token symbol  
     * @return decimals_ Token decimals
     * @return totalSupply_ Current total supply
     * @return maxSupply_ Maximum possible supply
     */
    function getTokenInfo() public view returns (
        string memory name_,
        string memory symbol_,
        uint8 decimals_,
        uint256 totalSupply_,
        uint256 maxSupply_
    ) {
        return (
            name(),
            symbol(),
            decimals(),
            totalSupply(),
            MAX_SUPPLY
        );
    }

    /**
     * @notice Check if address has minting privileges
     * @param account Address to check
     * @return True if account can mint tokens
     */
    function canMint(address account) public view returns (bool) {
        return account == owner();
    }
}

/*
🎯 DEPLOYMENT EXAMPLES:

// Constructor parameters for different use cases:

// 1. Simple token with initial supply
MyToken("My Awesome Token", "MAT", 1000000) // 1M tokens to deployer

// 2. Token with no initial supply (mint later)
MyToken("Growth Token", "GROW", 0) // No initial tokens

// 3. Community token with large supply
MyToken("Community Coin", "COMM", 100000000) // 100M tokens

🌐 NETWORK COMPATIBILITY:
✅ Ethereum Mainnet - Expensive gas but proven
✅ Polygon - Medium gas costs
✅ Arbitrum - Low gas costs
✅ Kasplex L2 - Ultra-low gas costs (99% savings!)

Same contract code works identically on all networks!
*/