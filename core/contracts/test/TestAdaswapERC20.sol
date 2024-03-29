// SPDX-License-Identifier: MIT
pragma solidity =0.8.13;

import '../AdaswapERC20.sol';

contract TestAdaswapERC20 is AdaswapERC20 {
    constructor(uint _totalSupply) {
        _mint(msg.sender, _totalSupply);
    }
}
