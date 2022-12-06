// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import '../interfaces/ITreasury.sol';
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract Treasury is ITreasury, Ownable {
  using SafeERC20 for IERC20;

  function setAllowance(address token, uint256 amount, address to) external override onlyOwner {
    require(token != address(0) && to != address(0), 'Treasury: ZERO_ADDRESS');
    IERC20(token).safeApprove(to, amount);
  }

  function withdraw(address token, uint256[] memory _amounts, address[] memory _to) external override onlyOwner {
    require(_to.length == _amounts.length, 'Treasury: INVALID_ARRAY_LENGTHS');
    for(uint i=0; i < _to.length; i++) {
      require(getTokenBalance(token) >= _amounts[i], 'Treasury: NOT_ENOUGH_BALANCE');
      IERC20(token).safeTransfer(_to[i], _amounts[i]);
    }
  }

  function getTokenBalance(address token) public view override returns(uint256) {
    require(token != address(0), 'Treasury: ZERO_ADDRESS');
    return IERC20(token).balanceOf(address(this));
  }
}
