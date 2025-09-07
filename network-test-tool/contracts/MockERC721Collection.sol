// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockERC721Collection
 * @dev Simplified ERC721 NFT collection for DeFi load testing
 * Supports minting, transfers, marketplace operations, and staking
 */
contract MockERC721Collection {
    // Token data
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;
    mapping(uint256 => address) private _tokenApprovals;
    mapping(address => mapping(address => bool)) private _operatorApprovals;
    
    // NFT specific data
    mapping(uint256 => string) private _tokenURIs;
    mapping(uint256 => bool) private _exists;
    
    // Marketplace features
    struct Listing {
        address seller;
        uint256 price;
        bool active;
    }
    mapping(uint256 => Listing) public listings;
    
    // Staking features
    struct StakedNFT {
        address owner;
        uint256 stakedAt;
        uint256 rewardsEarned;
    }
    mapping(uint256 => StakedNFT) public stakedNFTs;
    mapping(address => uint256[]) public userStakedTokens;
    
    uint256 private _currentIndex;
    uint256 public maxSupply = 10000;
    uint256 public mintPrice = 0.001 ether;
    uint256 public stakingRewardRate = 100; // Rewards per day per NFT
    
    string private _name;
    string private _symbol;
    string private _baseTokenURI;
    
    address public owner;
    bool public mintingEnabled = true;
    bool public stakingEnabled = true;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);
    event Approval(address indexed owner, address indexed approved, uint256 indexed tokenId);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);
    event NFTListed(uint256 indexed tokenId, address indexed seller, uint256 price);
    event NFTSold(uint256 indexed tokenId, address indexed buyer, address indexed seller, uint256 price);
    event NFTStaked(address indexed owner, uint256 indexed tokenId);
    event NFTUnstaked(address indexed owner, uint256 indexed tokenId, uint256 rewards);
    event RewardsClaimed(address indexed owner, uint256 amount);

    constructor(
        string memory name_,
        string memory symbol_,
        string memory baseTokenURI_
    ) {
        _name = name_;
        _symbol = symbol_;
        _baseTokenURI = baseTokenURI_;
        owner = msg.sender;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Not the owner");
        _;
    }

    // Standard ERC721 functions
    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function tokenURI(uint256 tokenId) public view returns (string memory) {
        require(_exists[tokenId], "Token does not exist");
        
        string memory _tokenURI = _tokenURIs[tokenId];
        string memory base = _baseTokenURI;
        
        if (bytes(base).length == 0) {
            return _tokenURI;
        }
        if (bytes(_tokenURI).length > 0) {
            return string(abi.encodePacked(base, _tokenURI));
        }
        
        return string(abi.encodePacked(base, _toString(tokenId), ".json"));
    }

    function balanceOf(address owner_) public view returns (uint256) {
        require(owner_ != address(0), "Balance query for zero address");
        return _balances[owner_];
    }

    function ownerOf(uint256 tokenId) public view returns (address) {
        address tokenOwner = _owners[tokenId];
        require(tokenOwner != address(0), "Owner query for nonexistent token");
        return tokenOwner;
    }

    function approve(address to, uint256 tokenId) public {
        address tokenOwner = ownerOf(tokenId);
        require(to != tokenOwner, "Approval to current owner");
        require(
            msg.sender == tokenOwner || isApprovedForAll(tokenOwner, msg.sender),
            "Approve caller is not owner nor approved for all"
        );
        
        _tokenApprovals[tokenId] = to;
        emit Approval(tokenOwner, to, tokenId);
    }

    function getApproved(uint256 tokenId) public view returns (address) {
        require(_exists[tokenId], "Approved query for nonexistent token");
        return _tokenApprovals[tokenId];
    }

    function setApprovalForAll(address operator, bool approved) public {
        require(operator != msg.sender, "Approve to caller");
        _operatorApprovals[msg.sender][operator] = approved;
        emit ApprovalForAll(msg.sender, operator, approved);
    }

    function isApprovedForAll(address owner_, address operator) public view returns (bool) {
        return _operatorApprovals[owner_][operator];
    }

    function transferFrom(address from, address to, uint256 tokenId) public {
        require(_isApprovedOrOwner(msg.sender, tokenId), "Transfer caller is not owner nor approved");
        _transfer(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId) public {
        transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory _data) public {
        transferFrom(from, to, tokenId);
    }

    // Minting functions
    function mint(address to, uint256 quantity) public payable {
        require(mintingEnabled, "Minting is disabled");
        require(quantity > 0 && quantity <= 20, "Invalid quantity");
        require(_currentIndex + quantity <= maxSupply, "Exceeds max supply");
        require(msg.value >= mintPrice * quantity, "Insufficient payment");

        for (uint256 i = 0; i < quantity; i++) {
            uint256 tokenId = _currentIndex++;
            _mint(to, tokenId);
        }
    }

    function batchMint(address[] calldata recipients, uint256[] calldata quantities) external onlyOwner {
        require(recipients.length == quantities.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < recipients.length; i++) {
            require(_currentIndex + quantities[i] <= maxSupply, "Exceeds max supply");
            
            for (uint256 j = 0; j < quantities[i]; j++) {
                uint256 tokenId = _currentIndex++;
                _mint(recipients[i], tokenId);
            }
        }
    }

    // Marketplace functions
    function listNFT(uint256 tokenId, uint256 price) external {
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(price > 0, "Price must be greater than 0");
        require(stakedNFTs[tokenId].owner == address(0), "Cannot list staked NFT");
        
        listings[tokenId] = Listing({
            seller: msg.sender,
            price: price,
            active: true
        });
        
        emit NFTListed(tokenId, msg.sender, price);
    }

    function buyNFT(uint256 tokenId) external payable {
        Listing storage listing = listings[tokenId];
        require(listing.active, "NFT not for sale");
        require(msg.value >= listing.price, "Insufficient payment");
        require(ownerOf(tokenId) == listing.seller, "Seller no longer owns NFT");
        
        address seller = listing.seller;
        uint256 price = listing.price;
        
        // Clear listing
        delete listings[tokenId];
        
        // Transfer NFT
        _transfer(seller, msg.sender, tokenId);
        
        // Transfer payment
        payable(seller).transfer(price);
        
        // Refund excess payment
        if (msg.value > price) {
            payable(msg.sender).transfer(msg.value - price);
        }
        
        emit NFTSold(tokenId, msg.sender, seller, price);
    }

    function cancelListing(uint256 tokenId) external {
        require(listings[tokenId].seller == msg.sender, "Not the seller");
        delete listings[tokenId];
    }

    // Staking functions
    function stakeNFT(uint256 tokenId) external {
        require(stakingEnabled, "Staking is disabled");
        require(ownerOf(tokenId) == msg.sender, "Not the owner");
        require(stakedNFTs[tokenId].owner == address(0), "Already staked");
        require(!listings[tokenId].active, "Cannot stake listed NFT");
        
        stakedNFTs[tokenId] = StakedNFT({
            owner: msg.sender,
            stakedAt: block.timestamp,
            rewardsEarned: 0
        });
        
        userStakedTokens[msg.sender].push(tokenId);
        
        emit NFTStaked(msg.sender, tokenId);
    }

    function unstakeNFT(uint256 tokenId) external {
        StakedNFT storage staked = stakedNFTs[tokenId];
        require(staked.owner == msg.sender, "Not the staker");
        
        uint256 rewards = calculateRewards(tokenId);
        
        // Remove from user's staked tokens
        uint256[] storage userTokens = userStakedTokens[msg.sender];
        for (uint256 i = 0; i < userTokens.length; i++) {
            if (userTokens[i] == tokenId) {
                userTokens[i] = userTokens[userTokens.length - 1];
                userTokens.pop();
                break;
            }
        }
        
        delete stakedNFTs[tokenId];
        
        // Transfer rewards (simplified - in practice would transfer reward tokens)
        if (rewards > 0) {
            // In a real implementation, transfer reward tokens here
            emit RewardsClaimed(msg.sender, rewards);
        }
        
        emit NFTUnstaked(msg.sender, tokenId, rewards);
    }

    function calculateRewards(uint256 tokenId) public view returns (uint256) {
        StakedNFT storage staked = stakedNFTs[tokenId];
        if (staked.owner == address(0)) return 0;
        
        uint256 stakingDuration = block.timestamp - staked.stakedAt;
        uint256 rewards = (stakingDuration * stakingRewardRate) / 1 days;
        
        return rewards + staked.rewardsEarned;
    }

    function getStakedTokens(address user) external view returns (uint256[] memory) {
        return userStakedTokens[user];
    }

    // Batch operations for load testing
    function batchTransfer(address[] calldata recipients, uint256[] calldata tokenIds) external {
        require(recipients.length == tokenIds.length, "Arrays length mismatch");
        
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (_isApprovedOrOwner(msg.sender, tokenIds[i])) {
                _transfer(msg.sender, recipients[i], tokenIds[i]);
            }
        }
    }

    function batchStake(uint256[] calldata tokenIds) external {
        for (uint256 i = 0; i < tokenIds.length; i++) {
            if (ownerOf(tokenIds[i]) == msg.sender && stakedNFTs[tokenIds[i]].owner == address(0) && !listings[tokenIds[i]].active) {
                stakedNFTs[tokenIds[i]] = StakedNFT({
                    owner: msg.sender,
                    stakedAt: block.timestamp,
                    rewardsEarned: 0
                });
                
                userStakedTokens[msg.sender].push(tokenIds[i]);
                emit NFTStaked(msg.sender, tokenIds[i]);
            }
        }
    }

    // Internal functions
    function _mint(address to, uint256 tokenId) internal {
        require(to != address(0), "Mint to zero address");
        require(!_exists[tokenId], "Token already minted");

        _balances[to] += 1;
        _owners[tokenId] = to;
        _exists[tokenId] = true;

        emit Transfer(address(0), to, tokenId);
    }

    function _transfer(address from, address to, uint256 tokenId) internal {
        require(ownerOf(tokenId) == from, "Transfer from incorrect owner");
        require(to != address(0), "Transfer to zero address");
        require(stakedNFTs[tokenId].owner == address(0), "Cannot transfer staked NFT");

        // Clear approvals
        delete _tokenApprovals[tokenId];
        delete listings[tokenId];

        _balances[from] -= 1;
        _balances[to] += 1;
        _owners[tokenId] = to;

        emit Transfer(from, to, tokenId);
    }

    function _isApprovedOrOwner(address spender, uint256 tokenId) internal view returns (bool) {
        require(_exists[tokenId], "Operator query for nonexistent token");
        address owner_ = ownerOf(tokenId);
        return (spender == owner_ || getApproved(tokenId) == spender || isApprovedForAll(owner_, spender));
    }

    // Utility functions
    function _toString(uint256 value) internal pure returns (string memory) {
        if (value == 0) return "0";
        
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        
        return string(buffer);
    }

    // Admin functions
    function setMintPrice(uint256 newPrice) external onlyOwner {
        mintPrice = newPrice;
    }

    function toggleMinting() external onlyOwner {
        mintingEnabled = !mintingEnabled;
    }

    function toggleStaking() external onlyOwner {
        stakingEnabled = !stakingEnabled;
    }

    function setStakingRewardRate(uint256 newRate) external onlyOwner {
        stakingRewardRate = newRate;
    }

    function withdrawFunds() external onlyOwner {
        payable(owner).transfer(address(this).balance);
    }

    // View functions
    function totalSupply() public view returns (uint256) {
        return _currentIndex;
    }

    function exists(uint256 tokenId) public view returns (bool) {
        return _exists[tokenId];
    }
}