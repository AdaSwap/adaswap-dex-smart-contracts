// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMasterAdaSwap {
    /// @notice Info of each MO user.
    /// `amount` LP token amount the user has provided.
    /// `rewardDebt` The amount of ADASWAP entitled to the user.
    struct UserInfo {
        uint256 amount; // How many LP tokens the user has provided.
        uint256 rewardDebt; // Reward debt. See explanation below.
    }

    /// @notice Info of each MO pool.
    /// `allocPoint` The amount of allocation points assigned to the pool.
    /// Also known as the amount of ADASWAP to distribute per block.
    struct PoolInfo {
        uint256 allocPoint; // How many allocation points assigned to this pool. ADASWAP to distribute per second.
        uint256 lastRewardTime; // Last block number that ADASWAP distribution occurs.
        uint256 accAdaSwapPerShare; // Accumulated ADASWAP per share, times 1e12. See below.
    }

    function poolLength() external view returns (uint256);
    function updatePool(uint256 pid) external returns (IMasterAdaSwap.PoolInfo memory);
    function userInfo(uint256 _pid, address _user) external view returns (uint256, uint256);
    function deposit(uint256 pid, uint256 amount, address to) external;
    function withdraw(uint256 pid, uint256 amount, address to) external;
    function harvest(uint256 pid, address to) external;
    function withdrawAndHarvest(uint256 pid, uint256 amount, address to) external;
    function emergencyWithdraw(uint256 pid, address to) external;
}
