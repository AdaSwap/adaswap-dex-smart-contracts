// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;
pragma experimental ABIEncoderV2;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./IRewarder.sol";

interface IMasterAdaSwap {
    /// @notice Info about each MO user.
    /// `amount` LP token amount the user has provided.
    /// `rewardDebt` The amount of ASW entitled to the user.
    /// `lockTimeId` The lock time when the user will be able to withdraw or harvest his ASW.
    /// `lastDepositTime` The latest time when stakers deposited LP tokens.
    /// This value referrence to index fixedTime on PoolInfo.
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
        uint8 lockTimeId;
        uint64 lastDepositTime;
    }

    /// @notice Info of each MO pool.
    /// `allocPoint` The amount of allocation points assigned to the pool.
    /// Also known as the amount of ASW to distribute per seconds.
    struct PoolInfo {
        uint256 lpSupply;
        uint256 accAdaSwapPerShare;
        IRewarder rewarder;
        uint64 lastRewardTime;
        uint64 allocPoint;
    }

    /**
     * Events
     */
    event Deposit(
        address indexed user,
        address indexed lpToken,
        uint256 amount,
        uint8 lockTimeId,
        address indexed to
    );
    event Withdraw(
        address indexed user,
        address indexed lpToken,
        uint256 amount,
        uint8 lockTimeId,
        address indexed to
    );
    event EmergencyWithdraw(
        address indexed user,
        address indexed lpToken,
        uint256 amount,
        uint8 lockTimeId,
        address indexed to
    );
    event Harvest(
        address indexed user,
        address indexed lpToken,
        uint256 amount,
        uint8 lockTimeId
    );
    event LogPoolAddition(
        uint8 lockTimeId,
        uint64 allocPoint,
        address indexed lpToken,
        IRewarder indexed rewarder
    );
    event LogSetPool(
        address indexed lpToken,
        uint8 lockTimeId,
        uint64 allocPoint,
        IRewarder indexed rewarder,
        bool overwrite
    );
    event LogUpdatePool(
        address indexed lpToken,
        uint8 _lockTimeId,
        uint64 lastRewardTime,
        uint256 lpSupply,
        uint256 totalWeight
    );
    event LogAdaSwapPerSecond(uint256 adaswapPerSecond);

    function fixedTimes(uint256) external view returns (uint32);

    function AdaSwapTreasury() external view returns (address);

    function totalAllocPoint() external view returns (uint256);

    function adaswapPerSecond() external view returns (uint256);

    function isAllocatedPool(address _lpToken, uint8 _lockTimeId)
        external
        view
        returns (bool);

    function isExistPool(address _lpToken, uint8 _lockTimeId)
        external
        view
        returns (bool);

    function add(
        uint64 _allocPoint,
        address _lpToken,
        uint8 _lockTimeId,
        address _rewarder
    ) external;

    function set(
        address _lpToken,
        uint8 _lockTimeId,
        uint256 _allocPoint,
        IRewarder _rewarder,
        bool overwrite
    ) external;

    function pendingAdaSwap(
        address _lpToken,
        address _user,
        uint8 _lockTimeId
    ) external view returns (uint256 pending);

    function setAdaSwapPerSecond(uint256 _adaswapPerSecond) external;

    function massUpdatePools(address[] memory _lpToken) external;

    function updatePool(address _lpToken, uint8 _lockTimeId)
        external
        returns (PoolInfo memory pool);

    function deposit(
        address _lpToken,
        address _to,
        uint256 _amount,
        uint8 _lockTimeId
    ) external;

    function withdraw(
        address _lpToken,
        address _to,
        uint256 _amount,
        uint8 _lockTimeId
    ) external;

    function withdrawAndHarvest(
        address _lpToken,
        uint256 _amount,
        address _to,
        uint8 _lockTimeId
    ) external;

    function emergencyWithdraw(
        address _lpToken,
        address _to,
        uint8 _lockTimeId
    ) external;

    function harvest(
        address _lpToken,
        address to,
        uint8 _lockTimeId
    ) external;
}
