pragma solidity =0.8.13;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract Token1 is ERC20 {
    constructor() ERC20('Token1', 'TK1') {
        _mint(msg.sender, 1e28);
    }
}
