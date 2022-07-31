// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

contract TimeLock {
  uint256 public constant LOCK_DURATION = 30 seconds;
  mapping(address => uint256) public unlockedDate;

  function lock(address user) internal {
    unlockedDate[user] = block.timestamp + LOCK_DURATION;
  }

  modifier whenUnlocked() {
    require(block.timestamp >= unlockedDate[msg.sender]);
    _;
    lock(msg.sender);
  }
}
