// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title MockMultiSigWallet
 * @dev Simplified multi-signature wallet for DeFi load testing
 * Supports threshold signatures, transaction proposals, and batch operations
 */
contract MockMultiSigWallet {
    struct Transaction {
        address to;
        uint256 value;
        bytes data;
        bool executed;
        uint256 confirmations;
        uint256 timestamp;
    }

    struct Proposal {
        string description;
        address target;
        uint256 value;
        bytes data;
        uint256 confirmations;
        bool executed;
        uint256 deadline;
        mapping(address => bool) hasConfirmed;
    }

    mapping(address => bool) public isOwner;
    mapping(uint256 => Transaction) public transactions;
    mapping(uint256 => mapping(address => bool)) public confirmations;
    mapping(uint256 => Proposal) public proposals;
    
    address[] public owners;
    uint256 public requiredConfirmations;
    uint256 public transactionCount;
    uint256 public proposalCount;
    
    // Emergency features
    bool public emergencyMode = false;
    address public emergencyContact;
    uint256 public emergencyDelay = 24 hours;
    
    // Governance features
    uint256 public constant VOTING_PERIOD = 7 days;
    uint256 public constant EXECUTION_DELAY = 1 days;

    event TransactionSubmitted(uint256 indexed transactionId, address indexed submitter);
    event TransactionConfirmed(uint256 indexed transactionId, address indexed owner);
    event TransactionExecuted(uint256 indexed transactionId);
    event TransactionRevoked(uint256 indexed transactionId, address indexed owner);
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer, string description);
    event ProposalConfirmed(uint256 indexed proposalId, address indexed owner);
    event ProposalExecuted(uint256 indexed proposalId);
    event OwnerAdded(address indexed owner);
    event OwnerRemoved(address indexed owner);
    event RequirementChanged(uint256 required);
    event EmergencyModeActivated(address indexed activator);
    event EmergencyModeDeactivated(address indexed deactivator);

    modifier onlyOwner() {
        require(isOwner[msg.sender], "Not an owner");
        _;
    }

    modifier onlyWallet() {
        require(msg.sender == address(this), "Only wallet can call this");
        _;
    }

    modifier transactionExists(uint256 transactionId) {
        require(transactionId < transactionCount, "Transaction does not exist");
        _;
    }

    modifier notExecuted(uint256 transactionId) {
        require(!transactions[transactionId].executed, "Transaction already executed");
        _;
    }

    modifier notConfirmed(uint256 transactionId) {
        require(!confirmations[transactionId][msg.sender], "Transaction already confirmed");
        _;
    }

    constructor(
        address[] memory _owners,
        uint256 _requiredConfirmations,
        address _emergencyContact
    ) {
        require(_owners.length > 0, "Owners required");
        require(_requiredConfirmations > 0 && _requiredConfirmations <= _owners.length, 
                "Invalid required confirmations");

        for (uint256 i = 0; i < _owners.length; i++) {
            address owner = _owners[i];
            require(owner != address(0), "Invalid owner");
            require(!isOwner[owner], "Duplicate owner");

            isOwner[owner] = true;
            owners.push(owner);
        }

        requiredConfirmations = _requiredConfirmations;
        emergencyContact = _emergencyContact;
    }

    // Receive ether
    receive() external payable {}
    fallback() external payable {}

    // Submit a transaction
    function submitTransaction(
        address _to,
        uint256 _value,
        bytes memory _data
    ) public onlyOwner returns (uint256) {
        uint256 transactionId = transactionCount;
        
        transactions[transactionId] = Transaction({
            to: _to,
            value: _value,
            data: _data,
            executed: false,
            confirmations: 0,
            timestamp: block.timestamp
        });

        transactionCount++;
        
        emit TransactionSubmitted(transactionId, msg.sender);
        
        // Automatically confirm from submitter
        confirmTransaction(transactionId);
        
        return transactionId;
    }

    // Confirm a transaction
    function confirmTransaction(uint256 transactionId)
        public
        onlyOwner
        transactionExists(transactionId)
        notConfirmed(transactionId)
        notExecuted(transactionId)
    {
        confirmations[transactionId][msg.sender] = true;
        transactions[transactionId].confirmations++;
        
        emit TransactionConfirmed(transactionId, msg.sender);
        
        // Auto-execute if threshold reached
        if (transactions[transactionId].confirmations >= requiredConfirmations) {
            executeTransaction(transactionId);
        }
    }

    // Execute a transaction
    function executeTransaction(uint256 transactionId)
        public
        onlyOwner
        transactionExists(transactionId)
        notExecuted(transactionId)
    {
        Transaction storage txn = transactions[transactionId];
        require(txn.confirmations >= requiredConfirmations, "Not enough confirmations");

        txn.executed = true;
        
        (bool success,) = txn.to.call{value: txn.value}(txn.data);
        require(success, "Transaction execution failed");
        
        emit TransactionExecuted(transactionId);
    }

    // Revoke confirmation
    function revokeConfirmation(uint256 transactionId)
        public
        onlyOwner
        transactionExists(transactionId)
        notExecuted(transactionId)
    {
        require(confirmations[transactionId][msg.sender], "Transaction not confirmed");
        
        confirmations[transactionId][msg.sender] = false;
        transactions[transactionId].confirmations--;
        
        emit TransactionRevoked(transactionId, msg.sender);
    }

    // Governance proposals
    function createProposal(
        string memory description,
        address target,
        uint256 value,
        bytes memory data
    ) public onlyOwner returns (uint256) {
        uint256 proposalId = proposalCount++;
        
        Proposal storage proposal = proposals[proposalId];
        proposal.description = description;
        proposal.target = target;
        proposal.value = value;
        proposal.data = data;
        proposal.confirmations = 0;
        proposal.executed = false;
        proposal.deadline = block.timestamp + VOTING_PERIOD;
        
        emit ProposalCreated(proposalId, msg.sender, description);
        
        return proposalId;
    }

    // Confirm a proposal
    function confirmProposal(uint256 proposalId) public onlyOwner {
        require(proposalId < proposalCount, "Proposal does not exist");
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp <= proposal.deadline, "Voting period ended");
        require(!proposal.hasConfirmed[msg.sender], "Already confirmed");
        require(!proposal.executed, "Proposal already executed");
        
        proposal.hasConfirmed[msg.sender] = true;
        proposal.confirmations++;
        
        emit ProposalConfirmed(proposalId, msg.sender);
    }

    // Execute a proposal
    function executeProposal(uint256 proposalId) public onlyOwner {
        require(proposalId < proposalCount, "Proposal does not exist");
        Proposal storage proposal = proposals[proposalId];
        require(block.timestamp > proposal.deadline, "Voting period not ended");
        require(block.timestamp <= proposal.deadline + EXECUTION_DELAY, "Execution window expired");
        require(proposal.confirmations >= requiredConfirmations, "Not enough confirmations");
        require(!proposal.executed, "Proposal already executed");
        
        proposal.executed = true;
        
        (bool success,) = proposal.target.call{value: proposal.value}(proposal.data);
        require(success, "Proposal execution failed");
        
        emit ProposalExecuted(proposalId);
    }

    // Owner management functions (can only be called by wallet itself)
    function addOwner(address owner) public onlyWallet {
        require(owner != address(0), "Invalid owner");
        require(!isOwner[owner], "Already an owner");
        
        isOwner[owner] = true;
        owners.push(owner);
        
        emit OwnerAdded(owner);
    }

    function removeOwner(address owner) public onlyWallet {
        require(isOwner[owner], "Not an owner");
        require(owners.length > 1, "Cannot remove last owner");
        
        isOwner[owner] = false;
        
        // Remove from owners array
        for (uint256 i = 0; i < owners.length; i++) {
            if (owners[i] == owner) {
                owners[i] = owners[owners.length - 1];
                owners.pop();
                break;
            }
        }
        
        // Adjust required confirmations if necessary
        if (requiredConfirmations > owners.length) {
            requiredConfirmations = owners.length;
            emit RequirementChanged(requiredConfirmations);
        }
        
        emit OwnerRemoved(owner);
    }

    function changeRequirement(uint256 _required) public onlyWallet {
        require(_required > 0 && _required <= owners.length, "Invalid required confirmations");
        
        requiredConfirmations = _required;
        emit RequirementChanged(_required);
    }

    // Emergency functions
    function activateEmergencyMode() public {
        require(msg.sender == emergencyContact, "Only emergency contact");
        emergencyMode = true;
        emit EmergencyModeActivated(msg.sender);
    }

    function deactivateEmergencyMode() public onlyOwner {
        require(emergencyMode, "Emergency mode not active");
        emergencyMode = false;
        emit EmergencyModeDeactivated(msg.sender);
    }

    // Batch operations for load testing
    function batchSubmitTransactions(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory data
    ) public onlyOwner returns (uint256[] memory) {
        require(targets.length == values.length && values.length == data.length, 
                "Arrays length mismatch");
        
        uint256[] memory transactionIds = new uint256[](targets.length);
        
        for (uint256 i = 0; i < targets.length; i++) {
            transactionIds[i] = submitTransaction(targets[i], values[i], data[i]);
        }
        
        return transactionIds;
    }

    function batchConfirmTransactions(uint256[] memory transactionIds) public onlyOwner {
        for (uint256 i = 0; i < transactionIds.length; i++) {
            if (transactionIds[i] < transactionCount &&
                !confirmations[transactionIds[i]][msg.sender] &&
                !transactions[transactionIds[i]].executed) {
                confirmTransaction(transactionIds[i]);
            }
        }
    }

    // View functions
    function getOwners() public view returns (address[] memory) {
        return owners;
    }

    function getTransaction(uint256 transactionId) 
        public 
        view 
        returns (
            address to,
            uint256 value,
            bytes memory data,
            bool executed,
            uint256 confirmationCount
        )
    {
        Transaction storage txn = transactions[transactionId];
        return (txn.to, txn.value, txn.data, txn.executed, txn.confirmations);
    }

    function getConfirmationCount(uint256 transactionId) public view returns (uint256) {
        return transactions[transactionId].confirmations;
    }

    function isConfirmedBy(uint256 transactionId, address owner) public view returns (bool) {
        return confirmations[transactionId][owner];
    }

    function getPendingTransactions() public view returns (uint256[] memory) {
        uint256[] memory pending = new uint256[](transactionCount);
        uint256 pendingCount = 0;
        
        for (uint256 i = 0; i < transactionCount; i++) {
            if (!transactions[i].executed) {
                pending[pendingCount] = i;
                pendingCount++;
            }
        }
        
        // Resize array
        uint256[] memory result = new uint256[](pendingCount);
        for (uint256 i = 0; i < pendingCount; i++) {
            result[i] = pending[i];
        }
        
        return result;
    }

    function getExecutableTransactions() public view returns (uint256[] memory) {
        uint256[] memory executable = new uint256[](transactionCount);
        uint256 executableCount = 0;
        
        for (uint256 i = 0; i < transactionCount; i++) {
            if (!transactions[i].executed && 
                transactions[i].confirmations >= requiredConfirmations) {
                executable[executableCount] = i;
                executableCount++;
            }
        }
        
        // Resize array
        uint256[] memory result = new uint256[](executableCount);
        for (uint256 i = 0; i < executableCount; i++) {
            result[i] = executable[i];
        }
        
        return result;
    }

    // Utility functions
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }

    function getProposal(uint256 proposalId) 
        public 
        view 
        returns (
            string memory description,
            address target,
            uint256 value,
            bytes memory data,
            uint256 confirmationCount,
            bool executed,
            uint256 deadline
        )
    {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.description,
            proposal.target,
            proposal.value,
            proposal.data,
            proposal.confirmations,
            proposal.executed,
            proposal.deadline
        );
    }
}