// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/Batchable.sol";
import "./libraries/Number.sol";
import "./interfaces/IRewarder.sol";
import "./interfaces/IMasterAdaSwap.sol";
import "./AdaSwapToken.sol";

/// @notice The MasterAdaSwap (MO) contract gives out a constant number of ASW tokens per second by minting right from AdaSwapToken contract.
contract MasterAdaSwap is Ownable, Batchable {
    using SafeERC20 for IERC20;
    using UInt256 for uint256;
    using Int256 for int256;
    using UInt128 for uint128;

    /// @notice Info of each MO user.
    /// `amount` LP token amount the user has provided.
    /// `rewardDebt` The amount of ASW entitled to the user.
    /// `lockTimeId` The lock time when the user will be able to withdraw or harvest his ASW
    /// This value referrence to index fixedTime on PoolInfo.
    struct UserInfo {
        uint256 amount;
        int256 rewardDebt;
        uint8 lockTimeId;
    }

    /// @notice The fixedTimes could be able to use in each pools. first element 0 second also meaning the flexible farming.
    uint32[] public fixedTimes = [
        0 seconds,
        7 days,
        14 days,
        30 days,
        60 days,
        90 days,
        365 days
    ];

    /// @notice Info of each MO pool.
    /// `allocPoint` The amount of allocation points assigned to the pool.
    /// Also known as the amount of ASW to distribute per seconds.
    struct PoolInfo {
        uint256 lpSupply;
        uint256 accAdaSwapPerShare;
        address rewarder;
        uint64 lastRewardTime;
        uint64 allocPoint;
    }

    /// @notice Address of AdaSwapTreasury contract.
    address public immutable AdaSwapTreasury;
    /// @notice Address of ASW contract.
    IERC20 public immutable ASW;

    // /// @notice Info of each MO pool.
    // PoolInfo[] public poolInfo;
    // /// @notice Address of the LP token for each MO pool.
    // IERC20[] public lpToken;
    // /// @notice Address of each `IRewarder` contract in MO.
    // IRewarder[] public rewarder;

    /// @notice Info of each user that stakes LP tokens.
    // user -> lpToken -> fixedOptionId -> UserInfo
    mapping(address => mapping(address => mapping(uint8 => UserInfo)))
        public userInfo;
    // lp token -> staking oprtion (locktime) -> poolInfo struct
    mapping(address => mapping(uint8 => poolInfo))
        public poolInfo;
    /// @notice Info of each user that stakes LP tokens.
    mapping(address => uint8[])
        public existingPoolOptions;
    /// @dev Total allocation points. Must be the sum of all allocation points in all pools.
    uint256 public totalAllocPoint = 0;

    uint256 private constant ACC_ADASWAP_PRECISION = 1e12;

    uint256 public adaswapPerSecond;

    event Deposit(
        address indexed user,
        address indexed lpToken,
        uint256 amount,
        uint8 fixedLockId,
        address indexed to
    );
    event Withdraw(
        address indexed user,
        address indexed lpToken,
        uint256 amount,
        uint8 fixedLockId,
        address indexed to
    );
    event EmergencyWithdraw(
        address indexed user,
        address indexed lpToken,
        uint256 amount,
        uint8 fixedLockId,
        address indexed to
    );
    event Harvest(
        address indexed user, 
        address indexed lpToken,
        uint256 amount,
        uint8 fixedLockId
    );
    event LogPoolAddition(
        address indexed lpToken,
        uint8 fixedLockId,
        uint64[] allocPoints,
        IERC20 indexed lpToken,
        IRewarder indexed rewarder,
        uint8 allowedFixedTime
    );
    event LogSetPool(
        address indexed lpToken,
        uint8 fixedLockId,
        uint64[] allocPoints,
        IRewarder indexed rewarder,
        uint8 allowedFixedTime,
        bool overwrite
    );
    event LogUpdatePool(
        address indexed lpToken,
        uint8 fixedLockId,
        uint64 lastRewardTime,
        uint256 lpSupply,
        uint256 totalWeight
    );
    event LogAdaSwapPerSecond(uint256 adaswapPerSecond);

    /// @param _adaswapTreasury The AdaSwapTreasury contract address.
    constructor(address _adaswapToken, address _adaswapTreasury) {
        ASW = AdaSwapToken(_adaswapToken);
        AdaSwapTreasury = _adaswapTreasury;
    }

    // /// @notice Returns the number of MO pools.
    // function poolLength() public view returns (uint256 pools) {
    //     pools = poolInfo.length;
    // }

    // / @notice Add a new LP to the pool. Can only be called by the owner.
    // / DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    // / @param _allocPoints AP list of the new pool for each fixed time.
    // / @param _lpToken Address of the LP ERC-20 token.
    // / @param _rewarder Address of the rewarder delegate.
    function add(
        uint64 _allocPoint,
        address _lpToken,
        uint8 _lockTimeId,
        address _rewarder
    ) public onlyOwner {
        totalAllocPoint += _allocPoint;
        poolInfo[_lpToken][_lockTimeId] = 
        PoolInfo({
               lpSupply: 0,
               accAdaSwapPerShare: 0,
               rewarder: _rewarder,
               lastRewardTime: block.timestamp.to64(),
               allocPoint: _allocPoint
        });

        existingPoolOptions[_lpToken].push(_lockTimeId);
        
        emit LogPoolAddition(
            lpToken.length - 1,
            _allocPoints,
            _lpToken,
            _rewarder,
            _allowedFixedTimeBitMask
        );
    }

    // /// @notice Update the given pool's ASW allocation point and `IRewarder` contract. Can only be called by the owner.
    // /// @param _pid The index of the pool. See `poolInfo`.
    // /// @param _allocPoints New AP of the pool.
    // /// @param _rewarder Address of the rewarder delegate.
    // /// @param overwrite True if _rewarder should be `set`. Otherwise `_rewarder` is ignored.
    // function set(
    //     uint256 _pid,
    //     uint64[] memory _allocPoints,
    //     IRewarder _rewarder,
    //     uint8 _allowedFixedTimeBitMask,
    //     uint128 _fixedTimeMultiplierRatio,
    //     bool overwrite
    // ) public onlyOwner {
    //     require(
    //         _allowedFixedTimeBitMask > 1,
    //         "MasterAdaSwap: invalid allowedFixedTimeBitMask."
    //     );
    //     require(
    //         _allocPoints.length == fixedTimes.length,
    //         "MasterAdaSwap: invalid allocPoints."
    //     );
    //     uint64 poolAllocPoint = 0;
    //     for (uint8 i = 0; i < _allocPoints.length; i++) {
    //         poolAllocPoint += _allocPoints[i];
    //     }
    //     totalAllocPoint =
    //         totalAllocPoint -
    //         poolInfo[_pid].allocPoint +
    //         poolAllocPoint;
    //     poolInfo[_pid].allocPoint = poolAllocPoint;
    //     poolInfo[_pid].allowedFixedTimeBitMask = _allowedFixedTimeBitMask;

    //     for (uint8 i = 0; i < fixedTimes.length; i++) {
    //         FixedPoolInfo storage fixedTimeInfo = fixedPoolInfo[
    //             poolInfo.length - 1
    //         ][i];
    //         fixedTimeInfo.weight = fixedTimeInfo.totalAmount * _allocPoints[i];
    //         fixedTimeInfo.allocPoint = _allocPoints[i];
    //     }

    //     if (overwrite) {
    //         rewarder[_pid] = _rewarder;
    //     }
    //     emit LogSetPool(
    //         _pid,
    //         _allocPoints,
    //         overwrite ? _rewarder : rewarder[_pid],
    //         _allowedFixedTimeBitMask,
    //         overwrite
    //     );
    // }

    /// @notice Sets the adaswap per second to be distributed. Can only be called by the owner.
    /// @param _adaswapPerSecond The amount of AdaSwap to be distributed per second.
    function setAdaSwapPerSecond(uint256 _adaswapPerSecond) public onlyOwner {
        adaswapPerSecond = _adaswapPerSecond;
        emit LogAdaSwapPerSecond(_adaswapPerSecond);
    }

    // / @notice View function to see pending ASW on frontend.
    // / @param _pid The index of the pool. See `poolInfo`.
    // / @param _user Address of user.
    // / @return pending ASW reward for a given user.
    function pendingAdaSwap(
        address _lpToken,
        address _user,
        uint8 _fixedLockId
    ) external view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_lpToken][_fixedLockId];
        UserInfo storage user = userInfo[_user][_lpToken][_fixedLockId];
        uint256 accAdaSwapPerShare = pool.accAdaSwapPerShare;
        uint256 lpSupply = pool.lpSupply;
        if (
            block.timestamp > pool.lastRewardTime &&
            lpSupply > 0
        ) {
            uint256 time = block.timestamp - pool.lastRewardTime;
            uint256 adaswapReward = (time * adaswapPerSecond * pool.allocPoint) / totalAllocPoint;
            accAdaSwapPerShare = accAdaSwapPerShare + (adaswapReward * ACC_ADASWAP_PRECISION / lpSupply);
        }
        pending = (int256(user.amount * accAdaSwapPerShare / ACC_ADASWAP_PRECISION) - user.rewardDebt)
            .toUInt256();
    }

    // /// @notice Update reward variables for all pools. Be careful of gas spending!
    // /// @param pids Pool IDs of all to be updated. Make sure to update all active pools.
    // function massUpdatePools(uint256[] calldata pids) external {
    //     uint256 len = pids.length;
    //     for (uint256 i = 0; i < len; ++i) {
    //         updatePool(pids[i]);
    //     }
    // }

    // change to mapping
    /// @notice Update reward variables of the given pool.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @return pool Returns the pool that was updated.
    function updatePool(
        address _lpToken,
        uint8 _fixedLockId
    ) public returns (PoolInfo memory pool) {
        pool = poolInfo[_lpToken][_fixedLockId];
        if (block.timestamp > pool.lastRewardTime) {
            uint256 lpSupply = pool.lpSupply;
            if (lpSupply > 0) {
                uint256 timestamp = block.timestamp.sub(pool.lastRewardTime);
                uint256 adaReward = timestamp.mul(adaswapPerSecond).mul(pool.allocPoint) / totalAllocPoint;
                pool.accAdaSwapPerShare = pool.accAdaSwapPerShare.add((adaReward.mul(ACC_ADASWAP_PRECISION) / lpSupply).to128());
            }
            pool.lastRewardTime = block.timestamp.to64();
            poolInfo[_lpToken][_fixedLockId] = pool;
            emit LogUpdatePool(_lpToken, _fixedLockId, pool.lastRewardTime, lpSupply, pool.accAdaSwapPerShare);
        }
    }

    // change to mapping
    /// @notice Deposit LP tokens to MO for ASW allocation.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param amount LP token amount to deposit.
    /// @param to The receiver of `amount` deposit benefit.
    function deposit(
        address _lpToken,
        address _to,
        uint256 _amount,
        uint8 _fixedLockId
    ) public {
        PoolInfo memory pool = updatePool(_lpToken, _fixedLockId);
        UserInfo storage user = userInfo[_to][_lpToken][_fixedLockId];

        // Effects
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.rewardDebt.add(int256(_amount.mul(pool.accAdaSwapPerShare) / ACC_ADASWAP_PRECISION));


        // Interactions
        IRewarder _rewarder = rewarder[pid];
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(pid, _to, _to, 0, user.amount);
        }

        IERC20(pool.rewarder).safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _lpToken, pid, _amount, _fixedLockId, _to);
    }

    // change to mapping
    /// @notice Withdraw LP tokens from MO.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param amount LP token amount to withdraw.
    /// @param to Receiver of the LP tokens.
    function withdraw(
        address _lpToken,
        uint256 _amount,
        uint8 _fixedLockId
    ) public {
        PoolInfo memory pool = updatePool(_lpToken, _fixedLockId);
        UserInfo storage user = userInfo[msg.sender][_lpToken][_fixedLockId];

       // Effects
        user.amount = user.amount.add(_amount);
        user.rewardDebt = user.rewardDebt.add(int256(amount.mul(pool.accAdaSwapPerShare) / ACC_ADASWAP_PRECISION));

        // Interactions
        IRewarder _rewarder = rewarder[pid];
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(_lpToken, msg.sender, _to, 0, user.amount, _fixedLockId);
        }

        IERC20(pool.rewarder).safeTransfer(_to, _amount);

        emit Withdraw(msg.sender, _lpToken, pid, _amount, _fixedLockId _to);
    }

    // change to mapping
    /// @notice Harvest proceeds for transaction sender to `to`.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param to Receiver of ASW rewards.
    function harvest(
        address _lpToken, 
        address to,
        uint8 _fixedLockId
    ) public {
        PoolInfo memory pool = updatePool(_lpToken, _fixedLockId);
        UserInfo storage user = userInfo[msg.sender][_lpToken][_fixedLockId];

        int256 accumulatedAdaSwap = int256(user.amount.mul(pool.accAdaSwapPerShare) / ACC_ADASWAP_PRECISION);
        uint256 _pendingAdaSwap = (accumulatedAdaSwap - user.rewardDebt)
            .toUInt256();

        // Effects
        user.rewardDebt = accumulatedAdaSwap;

        // Interactions
        if (_pendingAdaSwap != 0) {
            // TODO: update this if there is another way to reward users.
            ASW.safeTransferFrom(AdaSwapTreasury, to, _pendingAdaSwap);
        }

        IRewarder _rewarder = rewarder[pid];
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(
                _lpToken,
                msg.sender,
                to,
                _pendingAdaSwap,
                user.amount,
                _fixedLockId
            );
        }

        // emit Harvest(msg.sender, pid, _pendingAdaSwap);
    }

    // change to mapping 
    /// @notice Withdraw LP tokens from MO and harvest proceeds for transaction sender to `to`.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param amount LP token amount to withdraw.
    /// @param to Receiver of the LP tokens and ASW rewards.
    function withdrawAndHarvest(
        address _lpToken, 
        uint256 _amount,
        address _to,
        uint8 _fixedLockId
    ) public {
        PoolInfo memory pool = updatePool(_lpToken, _fixedLockId);
        UserInfo storage user = userInfo[msg.sender][_lpToken][_fixedLockId];

        int256 accumulatedAdaSwap = int256(
            user.amount * fixedTimeInfo.accAdaSwapPerShare / ACC_ADASWAP_PRECISION
        );
        uint256 _pendingAdaSwap = uint256(accumulatedAdaSwap - user.rewardDebt);

        // Effects
        user.rewardDebt =
            accumulatedAdaSwap -
            int256(_amount * fixedTimeInfo.accAdaSwapPerShare);
        user.amount -= _amount;

        // Interactions
        // TODO: update this if there is another way to reward
        ASW.safeTransferFrom(AdaSwapTreasury, _to, _pendingAdaSwap);

        IRewarder _rewarder = rewarder[pid];
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(
                _lpToken,
                msg.sender,
                _to,
                _pendingAdaSwap,
                user.amount,
                _fixedLockId
            );
        }

        IERC20(pool.rewarder).safeTransfer(_to, _amount);

        emit Withdraw(msg.sender, _lpToken, pid, _amount,_fixedLockId , _to);
        emit Harvest(msg.sender, _lpToken, pid, _pendingAdaSwap, _fixedLockId);
    }

    // change to mapping
    /// @notice Withdraw without caring about rewards. EMERGENCY ONLY.
    /// @param pid The index of the pool. See `poolInfo`.
    /// @param to Receiver of the LP tokens.
    function emergencyWithdraw(
        address _lpToken, 
        address _to,        
        uint8 _fixedLockId
    ) public {
        UserInfo storage user = userInfo[pid][msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;

        IRewarder _rewarder = rewarder[pid];
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(pid, msg.sender, _to, 0, 0);
        }

        // Note: transfer can fail or succeed if `amount` is zero.
        lpToken[pid].safeTransfer(_to, amount);
        emit EmergencyWithdraw(msg.sender, _lpToken, pid, amount,_fixedLockId, _to);
    }
}
