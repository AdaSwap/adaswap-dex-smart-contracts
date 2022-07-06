// SPDX-License-Identifier: MIT
pragma solidity =0.8.13;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract TestERC20 is ERC20 {
    constructor(string memory name, string memory symbol,uint _totalsupply) ERC20(name, symbol) {
        _mint(msg.sender, _totalsupply);
    }
}

