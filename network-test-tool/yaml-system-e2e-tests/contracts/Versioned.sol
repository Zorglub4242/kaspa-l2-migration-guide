
// SPDX-License-Identifier: MIT
pragma solidity 0.8.19;

contract VersionedContract {
    function getVersion() public pure returns (string memory) {
        return "0.8.19";
    }
}
