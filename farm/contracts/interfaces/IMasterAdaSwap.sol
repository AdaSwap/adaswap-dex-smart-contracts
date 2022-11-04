// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IRewarder.sol";

interface IMasterAdaSwap {
    /// @notice Info about each MA user.
    /// `amount` LP token amount the user has provided.
    /// `rewardDebt` The amount of ASW entitled to the user.
    /// `lastDepositTime` The latest time when stakers deposited LP tokens.
    /// This value referrence to index fixedTime on PoolInfo.
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
        uint64 lastDepositTime;
    }

    /// @notice Info of each MA pool.
    /// `allocPoint` The amount of allocation points assigned to the pool.
    /// Also known as the amount of ASW to distribute per seconds.
    struct PoolInfo {
        uint256 accAdaSwapPerShare;
        uint64 lastRewardTime;
        uint64 allocPoint;
        uint256 weight;
    }

    /// @notice Info of each MA lock pool.
    struct LockInfo {
        uint256 supply;
        uint256 allocPoint;
    }

    /**
     * Events
     */
    event Deposit(
        address indexed user,
        uint256 indexed pid,
        uint8 lid,
        uint256 amount,
        address indexed to
    );
    event Withdraw(
        address indexed user,
        uint256 indexed pid,
        uint8 lid,
        uint256 amount,
        address indexed to
    );
    event EmergencyWithdraw(
        address indexed user,
        uint256 indexed pid,
        uint8 lid,
        uint256 amount,
        address indexed to
    );
    event Harvest(
        address indexed user,
        uint256 indexed pid,
        uint8 lid,
        uint256 amount
    );
    event LogPoolAddition(
        uint256 indexed pid,
        uint64[] allocPoints,
        IERC20 indexed lpToken,
        IRewarder indexed rewarder
    );
    event LogSetPool(
        uint256 indexed pid,
        uint8 indexed lid,
        uint256 allocPoint
    );
    event LogSetRewarder(uint256 indexed pid, IRewarder indexed rewarder);
    event LogUpdatePool(
        uint256 indexed pid,
        uint256 indexed lid,
        uint64 lastRewardTime,
        uint256 adaswapPerShare,
        uint256 poolweight
    );
    event LogAdaSwapPerSecond(uint256 adaswapPerSecond);

    function lockTimes(uint256) external view returns (uint32);

    function lockTimesLength() external view returns (uint256);

    function AdaSwapTreasury() external view returns (address);

    function totalAllocPoint() external view returns (uint256);

    function adaswapPerSecond() external view returns (uint256);

    function isExistPool(uint256 _pid, uint8 _lid) external view returns (bool);

    function nextUnlockedTime(
        uint256 _pid,
        uint8 _lid,
        address _user
    ) external view returns (uint64);

    function add(
        uint64[] memory _allocPoints,
        address _lpToken,
        address _rewarder
    ) external;

    function set(
        uint256 _pid,
        uint8 _lid,
        uint256 _allocPoint
    ) external;

    function setRewarder(uint256 pid, address rewarder) external;

    function pendingAdaSwap(
        uint256 _pid,
        uint8 _lid,
        address _user
    ) external view returns (uint256 pending);

    function setAdaSwapPerSecond(uint256 _adaswapPerSecond) external;

    function massUpdatePools(uint256[] calldata pids) external;

    function updatePool(uint256 _pid, uint8 _lid)
        external
        returns (PoolInfo memory pool, LockInfo memory lock);

    function deposit(
        uint256 _pid,
        uint8 _lid,
        uint256 _amount,
        address _to
    ) external;

    function withdraw(
        uint256 _pid,
        uint8 _lid,
        uint256 _amount,
        address _to
    ) external;

    function withdrawAndHarvest(
        uint256 _pid,
        uint8 _lid,
        uint256 _amount,
        address _to
    ) external;

    function emergencyWithdraw(
        uint256 _pid,
        uint8 _lid,
        address _to
    ) external;

    function harvest(
        uint256 _pid,
        uint8 _lid,
        address to
    ) external;
}
