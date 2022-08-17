// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./interfaces/IRewarder.sol";
import "./MasterAdaSwap.sol";

contract EmptyRewarder is IRewarder, Ownable{
  function onAdaSwapReward (uint256 pid, address _user, address to, uint256, uint256 lpToken) override external onlyOwner {
  }
  
  function pendingTokens(uint256 pid, address user, uint256) override external view returns (IERC20[] memory rewardTokens, uint256[] memory rewardAmounts) {
  }
}
