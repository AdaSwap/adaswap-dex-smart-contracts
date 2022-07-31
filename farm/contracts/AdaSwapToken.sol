// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/draft-ERC20Permit.sol";

contract AdaSwapToken is ERC20('AdaSwap', 'ASW'), ERC20Permit("ASW"), Ownable {
  function decimals() public view virtual override returns (uint8) {
    return 6;
  }

  function mint(address _to, uint256 _amount) public onlyOwner {
    _mint(_to, _amount);
  }
}
