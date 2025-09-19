// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract Calculator {
    uint256 public result;

    event Calculation(string operation, uint256 a, uint256 b, uint256 result);

    function add(uint256 a, uint256 b) public returns (uint256) {
        result = a + b;
        emit Calculation("add", a, b, result);
        return result;
    }

    function subtract(uint256 a, uint256 b) public returns (uint256) {
        require(a >= b, "Result would be negative");
        result = a - b;
        emit Calculation("subtract", a, b, result);
        return result;
    }

    function multiply(uint256 a, uint256 b) public returns (uint256) {
        result = a * b;
        emit Calculation("multiply", a, b, result);
        return result;
    }

    function divide(uint256 a, uint256 b) public returns (uint256) {
        require(b != 0, "Division by zero");
        result = a / b;
        emit Calculation("divide", a, b, result);
        return result;
    }

    function power(uint256 base, uint256 exp) public returns (uint256) {
        result = base ** exp;
        emit Calculation("power", base, exp, result);
        return result;
    }

    function getResult() public view returns (uint256) {
        return result;
    }
}