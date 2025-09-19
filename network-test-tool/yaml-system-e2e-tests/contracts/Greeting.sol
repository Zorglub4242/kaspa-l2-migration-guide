
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract GreetingContract {
    string public greeting;
    address public owner;
    uint256 public deployTime;

    constructor(string memory _greeting) {
        greeting = _greeting;
        owner = msg.sender;
        deployTime = block.timestamp;
    }

    function setGreeting(string memory _newGreeting) public {
        require(msg.sender == owner, "Only owner can change greeting");
        greeting = _newGreeting;
    }

    function getInfo() public view returns (string memory, address, uint256) {
        return (greeting, owner, deployTime);
    }
}
