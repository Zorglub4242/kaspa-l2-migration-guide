// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title HelloWorld
 * @dev Simple contract demonstrating basic Solidity patterns
 * @notice This exact contract works on Ethereum, Polygon, Arbitrum, and Kasplex!
 */
contract HelloWorld {
    /// @notice Current stored message
    string public message;
    
    /// @notice Address of the contract deployer
    address public owner;
    
    /// @notice Number of times the message has been changed
    uint256 public messageCount;
    
    /// @notice Emitted when the message is changed
    /// @param newMessage The new message that was set
    /// @param changedBy Address that changed the message
    event MessageChanged(string newMessage, address changedBy);

    /**
     * @notice Contract constructor
     * @dev Sets initial message and owner
     */
    constructor() {
        message = "Hello Kasplex!";
        owner = msg.sender;
        messageCount = 0;
    }

    /**
     * @notice Changes the stored message
     * @dev Anyone can call this function
     * @param newMessage The new message to store
     */
    function setMessage(string memory newMessage) public {
        message = newMessage;
        messageCount++;
        emit MessageChanged(newMessage, msg.sender);
    }

    /**
     * @notice Returns the current message
     * @dev This is a view function - free to call
     * @return The current stored message
     */
    function getMessage() public view returns (string memory) {
        return message;
    }

    /**
     * @notice Returns contract statistics
     * @return currentMessage The current message
     * @return totalChanges Number of times message was changed  
     * @return contractOwner Address that deployed the contract
     */
    function getStats() public view returns (
        string memory currentMessage,
        uint256 totalChanges,
        address contractOwner
    ) {
        return (message, messageCount, owner);
    }
}