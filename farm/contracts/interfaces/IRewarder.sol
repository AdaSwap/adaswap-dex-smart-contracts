// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IRewarder {
    function onAdaSwapReward(address recipient, uint256 adaswapAmount) external;

    function pendingTokens(uint256 adaswapAmount)
        external
        view
        returns (IERC20[] memory, uint256[] memory);
}
