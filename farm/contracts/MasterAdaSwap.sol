// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/Number.sol";
import "./interfaces/IMasterAdaSwap.sol";

/// @notice The MasterAdaSwap (MO) contract gives out a constant number of ASW tokens per second by minting right from the AdaSwapToken contract.
contract MasterAdaSwap is Ownable, IMasterAdaSwap {
    using SafeERC20 for IERC20;
    using UInt256 for uint256;
    using Int256 for int256;
    using UInt128 for uint128;

    /// @notice The lockTimes could be able to use in each pools. first element 0 second also meaning the flexible farming.
    uint32[] public lockTimes = [
        0 seconds,
        7 minutes,
        14 minutes,
        30 minutes,
        60 minutes,
        90 minutes,
        365 minutes
    ];

    function nextUnlockedTime(
        uint256 _pid,
        uint8 _lid,
        address _user
    ) external view returns (uint64 t) {
        return userInfo[_pid][_lid][_user].lastDepositTime + lockTimes[_lid];
    }

    /// @notice Address of AdaSwapTreasury contract.
    address public immutable AdaSwapTreasury;
    /// @notice Address of ASW contract.
    IERC20 public immutable ASW;

    /// @notice Info of each MCV2 pool.
    PoolInfo[] public poolInfo;
    /// @notice Address of the LP token for each MCV2 pool.
    IERC20[] public lpToken;
    /// @notice Address of each `IRewarder` contract in MCV2.
    IRewarder[] public rewarder;

    // lp token -> lockTimeId -> LockInfo
    mapping(uint256 => mapping(uint8 => LockInfo)) public lockInfo;

    /// @notice Info about each user that stakes LP tokens.
    // pid  -> lockTimeId -> user address -> UserInfo
    mapping(uint256 => mapping(uint8 => mapping(address => UserInfo)))
        public userInfo;

    /// @notice Info of each user that stakes LP tokens.
    uint8[] public existingPoolBitMasks;

    /// @dev Total amount of allocation points. Must be the sum of all allocation points from all pools.
    uint256 public totalAllocPoint = 0;

    uint256 private constant ACC_ADASWAP_PRECISION = 1e12;

    uint256 public adaswapPerSecond;

    /// @param _adaswapTreasury The contract address.
    constructor(address _adaswapToken, address _adaswapTreasury) {
        ASW = IERC20(_adaswapToken);
        AdaSwapTreasury = _adaswapTreasury;
    }

    function poolsLength() public view returns (uint256) {
        return poolInfo.length;
    }

    function lockTimesLength() public view returns (uint256) {
        return lockTimes.length;
    }

    function isExistPool(uint256 _pid, uint8 _lid) public view returns (bool) {
        return lockInfo[_pid][_lid].allocPoint != 0;
    }

    /// @notice Creates a new staking pool with fixed LP token. Can only be called by the owner.
    /// DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    /// @param _allocPoints AP for new pool which are generated for each fixed time.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _rewarder Address of the rewarder delegate.
    function add(
        uint64[] memory _allocPoints,
        address _lpToken,
        address _rewarder
    ) external onlyOwner {
        uint64 poolAllocPoint = 0;
        uint256 size = lockTimes.length < _allocPoints.length
            ? lockTimes.length
            : _allocPoints.length;
        uint8 poolBitMask = 0;
        for (uint8 i = 0; i < size; i++) {
            if (_allocPoints[i] != 0) {
                poolAllocPoint += _allocPoints[i];
                poolBitMask |= uint8(1) << i;
            }
        }
        totalAllocPoint = totalAllocPoint + poolAllocPoint;
        lpToken.push(IERC20(_lpToken));
        rewarder.push(IRewarder(_rewarder));
        existingPoolBitMasks.push(poolBitMask);

        poolInfo.push(
            PoolInfo({
                allocPoint: poolAllocPoint,
                lastRewardTime: block.timestamp.to64(),
                accAdaSwapPerShare: 0,
                weight: 0
            })
        );

        for (uint8 i = 0; i < size; i++) {
            LockInfo storage lock = lockInfo[lpToken.length - 1][i];
            lock.allocPoint = _allocPoints[i];
        }

        emit LogPoolAddition(
            lpToken.length - 1,
            _allocPoints,
            IERC20(_lpToken),
            IRewarder(_rewarder)
        );
    }

    /// @notice Updates the given pool's ASW allocation point.
    /// @param _pid indexed of the LP ERC-20 token.
    /// @param _lid The lock time when the user will be able to withdraw or harvest ASW.
    /// @param _allocPoint New AP of the pool.
    function set(
        uint256 _pid,
        uint8 _lid,
        uint256 _allocPoint
    ) external onlyOwner {
        LockInfo storage lock = lockInfo[_pid][_lid];
        PoolInfo memory pool = updatePool(_pid);
        totalAllocPoint =
            totalAllocPoint -
            lock.allocPoint +
            _allocPoint;
        poolInfo[_pid].weight = pool.weight - lock.allocPoint*lock.supply + _allocPoint * lock.supply;
        lock.allocPoint = _allocPoint.to64();
        emit LogSetPool(_pid, _lid, _allocPoint.to64());
    }

    /// @notice Updates the given pool's `IRewarder` contract. Can only be called by the owner.
    /// @param _pid indexed of the LP ERC-20 token.
    /// @param _rewarder Address of the rewarder delegate.
    function setRewarder(uint256 _pid, address _rewarder) external onlyOwner {
        rewarder[_pid] = IRewarder(_rewarder);
        emit LogSetRewarder(_pid, IRewarder(_rewarder));
    }

    /// @notice Sets the adaswap per second value to be distributed. Can only be called by the owner.
    /// @param _adaswapPerSecond The amount of AdaSwap to be distributed per second.
    function setAdaSwapPerSecond(uint256 _adaswapPerSecond) external onlyOwner {
        adaswapPerSecond = _adaswapPerSecond;
        emit LogAdaSwapPerSecond(_adaswapPerSecond);
    }

    /// @notice Views function to see pending ASW on frontend.
    /// @param _pid indexed of the LP ERC-20 token.
    /// @param _user Address of the user.
    /// @param _lid The lock time when the user will be able to withdraw or harvest ASW.
    function pendingAdaSwap(
        uint256 _pid,
        uint8 _lid,
        address _user
    ) external view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_pid];
        LockInfo memory lock = lockInfo[_pid][_lid];
        UserInfo storage user = userInfo[_pid][_lid][_user];
        uint256 accAdaSwapPerShare = pool.accAdaSwapPerShare;
        if (block.timestamp > pool.lastRewardTime && pool.weight > 0) {
            uint256 timestamp = block.timestamp - pool.lastRewardTime;
            uint256 adaswapReward = (timestamp *
                adaswapPerSecond *
                pool.allocPoint) / totalAllocPoint;
            accAdaSwapPerShare =
                pool.accAdaSwapPerShare +
                (adaswapReward * ACC_ADASWAP_PRECISION) /
                pool.weight;
        }
        int256 accumulatedAdaSwap = int256(
            (user.amount * accAdaSwapPerShare) / ACC_ADASWAP_PRECISION
        );
        pending =
            (accumulatedAdaSwap - user.rewardDebt).toUInt256() *
            lock.allocPoint;
    }

    /// @notice Updates reward variables for all pools. Be careful of gas spending!
    /// @param pids Pool IDs of all to be updated. Make sure to update all active pools.
    function massUpdatePools(uint256[] calldata pids) external {
        uint256 len = pids.length;
        for (uint256 k = 0; k < len; ++k) {
            updatePool(pids[k]);
        }
    }

    /// @notice Updates reward variables of the given pool.
    /// @param _pid indexed of the LP ERC-20 token.
    function updatePool(uint256 _pid)
        public
        returns (PoolInfo memory pool)
    {
        pool = poolInfo[_pid];
        if (block.timestamp > pool.lastRewardTime) {
            if (pool.weight > 0) {
                uint256 timestamp = block.timestamp - pool.lastRewardTime;
                uint256 adaswapReward = (timestamp *
                    adaswapPerSecond *
                    pool.allocPoint) / totalAllocPoint;
                pool.accAdaSwapPerShare =
                    pool.accAdaSwapPerShare +
                    (adaswapReward * ACC_ADASWAP_PRECISION) /
                    pool.weight;
            }
            pool.lastRewardTime = block.timestamp.to64();
            poolInfo[_pid] = pool;
            emit LogUpdatePool(
                _pid,
                pool.lastRewardTime,
                pool.accAdaSwapPerShare,
                pool.weight
            );
        }
    }

    /// @notice Deposits LP tokens to MO for ASW allocation.
    /// @param _pid indexed of the LP ERC-20 token.
    /// @param _lid The lock time when the user will be able to withdraw or harvest his ASW.
    /// @param _amount LP token amount to deposit.
    /// @param _to The receiver of `amount` deposit benefit.
    function deposit(
        uint256 _pid,
        uint8 _lid,
        uint256 _amount,
        address _to
    ) external {
        require(isExistPool(_pid, _lid), "MasterAdaSwap: POOL_DOES_NOT_EXIST");
        updatePool(_pid);
        PoolInfo storage pool = poolInfo[_pid];
        LockInfo storage lock = lockInfo[_pid][_lid];
        UserInfo storage user = userInfo[_pid][_lid][_to];
        user.amount = user.amount + _amount;
        user.rewardDebt =
            user.rewardDebt +
            int256((_amount * pool.accAdaSwapPerShare) / ACC_ADASWAP_PRECISION);
        user.lastDepositTime = block.timestamp.to64();
        lock.supply += _amount;
        pool.weight += _amount * lock.allocPoint;
        IRewarder _rewarder = rewarder[_pid];
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(_pid, _lid, _to, _to, 0, _amount);
        }
        lpToken[_pid].safeTransferFrom(msg.sender, address(this), _amount);
        emit Deposit(msg.sender, _pid, _lid, _amount, _to);
    }

    /// @notice Withdraws LP tokens from MO.
    /// @param _pid indexed of the LP ERC-20 token.
    /// @param _lid The lock time when the user will be able to withdraw or harvest his ASW.
    /// @param _amount LP token amount to withdraw.
    /// @param _to Receiver of the LP tokens.
    function withdraw(
        uint256 _pid,
        uint8 _lid,
        uint256 _amount,
        address _to
    ) external {
        UserInfo storage user = userInfo[_pid][_lid][msg.sender];
        require(
            user.lastDepositTime + lockTimes[_lid] <= block.timestamp,
            "MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER"
        );
        updatePool(_pid);
        PoolInfo storage pool = poolInfo[_pid];
        LockInfo storage lock = lockInfo[_pid][_lid];
        user.amount = user.amount - _amount;
        user.rewardDebt =
            user.rewardDebt -
            int256((_amount * pool.accAdaSwapPerShare) / ACC_ADASWAP_PRECISION);
        lock.supply -= _amount;
        pool.weight -= _amount * lock.allocPoint;
        IRewarder _rewarder = rewarder[_pid];
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(_pid, _lid, msg.sender, _to, 0, _amount);
        }
        lpToken[_pid].safeTransfer(_to, _amount);
        emit Withdraw(msg.sender, _pid, _lid, _amount, _to);
    }

    /// @notice Harvests proceeds for transaction sender to `_to`.
    /// @param _pid indexed of the LP ERC-20 token.
    /// @param _lid The lock time when the user will be able to withdraw or harvest his ASW.
    /// @param _to Receiver of ASW rewards.
    function harvest(
        uint256 _pid,
        uint8 _lid,
        address _to
    ) external {
        UserInfo storage user = userInfo[_pid][_lid][msg.sender];
        require(
            user.lastDepositTime + lockTimes[_lid] <= block.timestamp,
            "MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER"
        );
        PoolInfo memory pool = updatePool(_pid);
        LockInfo memory lock = lockInfo[_pid][_lid];
        int256 accumulatedAdaSwap = int256(
            (user.amount * pool.accAdaSwapPerShare) / ACC_ADASWAP_PRECISION
        );
        uint256 _pendingAdaSwap =
            (accumulatedAdaSwap - user.rewardDebt).toUInt256() *
            lock.allocPoint;
        user.rewardDebt = accumulatedAdaSwap;
        if (_pendingAdaSwap != 0) {
            ASW.safeTransferFrom(AdaSwapTreasury, _to, _pendingAdaSwap);
        }
        IRewarder _rewarder = rewarder[_pid];
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(
                _pid,
                _lid,
                msg.sender,
                _to,
                _pendingAdaSwap,
                user.amount
            );
        }
        emit Harvest(msg.sender, _pid, _lid, _pendingAdaSwap);
    }

    /// @notice Withdraws LP tokens from MO and harvest proceeds for transaction sender to `to`.
    /// @param _pid indexed of the LP ERC-20 token.
    /// @param _lid The lock time when the user will be able to withdraw or harvest his ASW.
    /// @param _amount LP token amount to withdraw.
    /// @param _to Receiver of the LP tokens and ASW rewards.
    function withdrawAndHarvest(
        uint256 _pid,
        uint8 _lid,
        uint256 _amount,
        address _to
    ) external {
        UserInfo storage user = userInfo[_pid][_lid][msg.sender];
        require(
            user.lastDepositTime + lockTimes[_lid] <= block.timestamp,
            "MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER"
        );
        updatePool(_pid);
        PoolInfo storage pool = poolInfo[_pid];
        LockInfo storage lock = lockInfo[_pid][_lid];
        int256 accumulatedAdaSwap = int256(
            (user.amount * pool.accAdaSwapPerShare) / ACC_ADASWAP_PRECISION
        );
        uint256 _pendingAdaSwap = (accumulatedAdaSwap - user.rewardDebt)
            .toUInt256() * lock.allocPoint;
        user.rewardDebt =
            accumulatedAdaSwap -
            int256(_amount * pool.accAdaSwapPerShare / ACC_ADASWAP_PRECISION);
        user.amount -= _amount;
        lock.supply -= _amount;
        pool.weight -= _amount * lock.allocPoint;

        if (_pendingAdaSwap != 0) {
            ASW.safeTransferFrom(AdaSwapTreasury, _to, _pendingAdaSwap);
        }
        IRewarder _rewarder = rewarder[_pid];
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(
                _pid,
                _lid,
                msg.sender,
                _to,
                _pendingAdaSwap,
                user.amount
            );
        }
        lpToken[_pid].safeTransfer(_to, _amount);
        emit Withdraw(msg.sender, _pid, _lid, _amount, _to);
        emit Harvest(msg.sender, _pid, _lid, _pendingAdaSwap);
    }

    /// @notice Withdraws without caring about rewards. EMERGENCY ONLY.
    /// @param _pid indexed of the LP ERC-20 token.
    /// @param _to Receiver of the LP tokens.
    /// @param _lid The lock time when the user will be able to withdraw or harvest his ASW.
    function emergencyWithdraw(
        uint256 _pid,
        uint8 _lid,
        address _to
    ) external {
        updatePool(_pid);
        PoolInfo storage pool = poolInfo[_pid];
        LockInfo storage lock = lockInfo[_pid][_lid];
        UserInfo storage user = userInfo[_pid][_lid][msg.sender];
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        lock.supply -= amount;
        pool.weight -= amount * lock.allocPoint;
        IRewarder _rewarder = rewarder[_pid];
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(_pid, _lid, msg.sender, _to, 0, 0);
        }
        lpToken[_pid].safeTransfer(_to, amount);
        emit EmergencyWithdraw(msg.sender, _pid, _lid, amount, _to);
    }
}
