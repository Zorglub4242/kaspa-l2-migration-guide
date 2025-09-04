// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title MyNFT
 * @dev Standard ERC721 NFT contract with URI storage and enumerable functionality
 */
contract MyNFT is ERC721, ERC721URIStorage, ERC721Enumerable, Ownable {
    using Counters for Counters.Counter;
    
    Counters.Counter private _tokenIdCounter;
    
    // Contract metadata
    string private _contractURI;
    
    // Maximum supply (optional limit)
    uint256 public maxSupply;
    
    // Minting price (0 for free minting)
    uint256 public mintPrice;
    
    // Events
    event BatchMinted(address indexed to, uint256[] tokenIds);
    event ContractURIUpdated(string newContractURI);
    event MintPriceUpdated(uint256 newPrice);
    
    constructor(
        string memory name,
        string memory symbol,
        string memory contractURI,
        uint256 _maxSupply,
        uint256 _mintPrice
    ) 
        ERC721(name, symbol) 
        Ownable(msg.sender)
    {
        _contractURI = contractURI;
        maxSupply = _maxSupply;
        mintPrice = _mintPrice;
    }
    
    /**
     * @dev Mint a single NFT to specified address
     */
    function mint(address to, string memory uri) public onlyOwner returns (uint256) {
        require(to != address(0), "Cannot mint to zero address");
        require(_tokenIdCounter.current() < maxSupply, "Max supply reached");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
        
        return tokenId;
    }
    
    /**
     * @dev Batch mint multiple NFTs to specified address
     */
    function batchMint(
        address to, 
        string[] memory uris
    ) public onlyOwner returns (uint256[] memory) {
        require(to != address(0), "Cannot mint to zero address");
        require(uris.length > 0, "Must provide at least one URI");
        require(
            _tokenIdCounter.current() + uris.length <= maxSupply, 
            "Batch would exceed max supply"
        );
        
        uint256[] memory tokenIds = new uint256[](uris.length);
        
        for (uint256 i = 0; i < uris.length; i++) {
            uint256 tokenId = _tokenIdCounter.current();
            _tokenIdCounter.increment();
            
            _safeMint(to, tokenId);
            _setTokenURI(tokenId, uris[i]);
            
            tokenIds[i] = tokenId;
        }
        
        emit BatchMinted(to, tokenIds);
        return tokenIds;
    }
    
    /**
     * @dev Public minting function (if price is set)
     */
    function publicMint(string memory uri) public payable returns (uint256) {
        require(msg.value >= mintPrice, "Insufficient payment");
        require(_tokenIdCounter.current() < maxSupply, "Max supply reached");
        
        uint256 tokenId = _tokenIdCounter.current();
        _tokenIdCounter.increment();
        
        _safeMint(msg.sender, tokenId);
        _setTokenURI(tokenId, uri);
        
        return tokenId;
    }
    
    /**
     * @dev Get contract-level metadata URI
     */
    function contractURI() public view returns (string memory) {
        return _contractURI;
    }
    
    /**
     * @dev Update contract metadata URI (only owner)
     */
    function setContractURI(string memory newContractURI) public onlyOwner {
        _contractURI = newContractURI;
        emit ContractURIUpdated(newContractURI);
    }
    
    /**
     * @dev Update mint price (only owner)
     */
    function setMintPrice(uint256 newPrice) public onlyOwner {
        mintPrice = newPrice;
        emit MintPriceUpdated(newPrice);
    }
    
    /**
     * @dev Get total number of minted tokens
     */
    function totalMinted() public view returns (uint256) {
        return _tokenIdCounter.current();
    }
    
    /**
     * @dev Get remaining supply
     */
    function remainingSupply() public view returns (uint256) {
        return maxSupply - _tokenIdCounter.current();
    }
    
    /**
     * @dev Withdraw contract balance (only owner)
     */
    function withdraw() public onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No funds to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Withdrawal failed");
    }
    
    /**
     * @dev Get all token IDs owned by an address
     */
    function tokensOfOwner(address owner) public view returns (uint256[] memory) {
        uint256 tokenCount = balanceOf(owner);
        uint256[] memory result = new uint256[](tokenCount);
        
        for (uint256 i = 0; i < tokenCount; i++) {
            result[i] = tokenOfOwnerByIndex(owner, i);
        }
        
        return result;
    }
    
    // Required overrides
    function _update(address to, uint256 tokenId, address auth)
        internal
        override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal
        override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public
        view
        override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, ERC721URIStorage, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}