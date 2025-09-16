// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/**
 * @title SimpleStorage
 * @dev A basic storage contract for load testing and demonstrations
 */
contract SimpleStorage {
    uint256 private storedValue;
    address public lastUpdater;
    uint256 public updateCount;

    event ValueUpdated(uint256 indexed oldValue, uint256 indexed newValue, address indexed updater);
    event ValueRetrieved(uint256 value, address retriever);

    constructor(uint256 _initialValue) {
        storedValue = _initialValue;
        lastUpdater = msg.sender;
        updateCount = 0;
    }

    /**
     * @dev Store a new value
     * @param _value The value to store
     */
    function store(uint256 _value) public {
        uint256 oldValue = storedValue;
        storedValue = _value;
        lastUpdater = msg.sender;
        updateCount++;

        emit ValueUpdated(oldValue, _value, msg.sender);
    }

    /**
     * @dev Retrieve the stored value
     * @return The currently stored value
     */
    function retrieve() public view returns (uint256) {
        return storedValue;
    }

    /**
     * @dev Get the current value and emit an event (for testing gas usage)
     * @return The currently stored value
     */
    function getValue() public returns (uint256) {
        emit ValueRetrieved(storedValue, msg.sender);
        return storedValue;
    }

    /**
     * @dev Increment the stored value by a given amount
     * @param _amount The amount to increment by
     */
    function increment(uint256 _amount) public {
        uint256 oldValue = storedValue;
        storedValue += _amount;
        lastUpdater = msg.sender;
        updateCount++;

        emit ValueUpdated(oldValue, storedValue, msg.sender);
    }

    /**
     * @dev Decrement the stored value by a given amount
     * @param _amount The amount to decrement by
     */
    function decrement(uint256 _amount) public {
        require(storedValue >= _amount, "Cannot decrement below zero");
        uint256 oldValue = storedValue;
        storedValue -= _amount;
        lastUpdater = msg.sender;
        updateCount++;

        emit ValueUpdated(oldValue, storedValue, msg.sender);
    }

    /**
     * @dev Reset the value to zero
     */
    function reset() public {
        uint256 oldValue = storedValue;
        storedValue = 0;
        lastUpdater = msg.sender;
        updateCount++;

        emit ValueUpdated(oldValue, 0, msg.sender);
    }

    /**
     * @dev Get contract statistics
     * @return value The current stored value
     * @return updater The address of the last updater
     * @return updates The total number of updates
     */
    function getStats() public view returns (uint256 value, address updater, uint256 updates) {
        return (storedValue, lastUpdater, updateCount);
    }
}