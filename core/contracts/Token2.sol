pragma solidity >=0.8.13;

import '@openzeppelin/contracts/token/ERC20/ERC20.sol';

contract Token2 is ERC20 {
    constructor() ERC20('Token2', 'TK2') {
        _mint(msg.sender, 2*1e28);
    }
}
