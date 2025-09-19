
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract InvalidContract {
    function broken() public {
        // Syntax error: missing semicolon
        uint256 x = 10
    }
}
