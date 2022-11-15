// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ITreasury {
  function setAllowance(address token, uint256 amount, address to) external;
  function withdraw(address _token, uint256[] memory _amounts, address[] memory _to) external;
  function getTokenBalance(address token) external view returns(uint256);
}
