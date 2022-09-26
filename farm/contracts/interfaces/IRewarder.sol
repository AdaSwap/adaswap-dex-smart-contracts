// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// custom reward mechanisms
interface IRewarder {
    // this hook is while reward distribution if farm has custom reward mechanism
    function onAdaSwapReward(address recipient, uint256 adaswapAmount) external;

    function pendingTokens(uint256 adaswapAmount)
        external
        view
        returns (IERC20[] memory, uint256[] memory);
}
