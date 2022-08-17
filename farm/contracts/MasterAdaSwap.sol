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
  uint32[] public fixedTimes = [0 seconds, 7 days, 14 days, 30 days, 60 days, 90 days, 365 days];

  /// @notice Info of each MO pool.
  /// `allocPoint` The amount of allocation points assigned to the pool.
  /// Also known as the amount of ASW to distribute per seconds.
  struct PoolInfo {
    uint64 lastRewardTime;
    uint64 allocPoint;
    uint8 allowedFixedTimeBitMask;
    uint256 totalWeight;
  }

  /// @notice Address of AdaSwapTreasury contract.
  address public immutable AdaSwapTreasury;
  /// @notice Address of ASW contract.
  IERC20 public immutable ASW;

  /// @notice Info of each MO pool.
  PoolInfo[] public poolInfo;
  /// @notice Address of the LP token for each MO pool.
  IERC20[] public lpToken;
  /// @notice Address of each `IRewarder` contract in MO.
  IRewarder[] public rewarder;

  struct FixedPoolInfo {
    uint256 accAdaSwapPerShare;
    uint64 allocPoint;
    uint256 totalAmount;
    uint256 weight;
  }

  /// @notice the allocation point of each fixed time in pool over the total allocation point as the pool liquidity.
  mapping (uint256 => mapping (uint8 => FixedPoolInfo)) public fixedPoolInfo;

  /// @notice Info of each user that stakes LP tokens.
  mapping (uint256 => mapping (address => UserInfo)) public userInfo;
  /// @dev Total allocation points. Must be the sum of all allocation points in all pools.
  uint256 public totalAllocPoint = 0;

  uint256 public adaswapPerSecond;

  event Deposit(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
  event Withdraw(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
  event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
  event Harvest(address indexed user, uint256 indexed pid, uint256 amount);
  event LogPoolAddition(uint256 indexed pid, uint64[] allocPoints, IERC20 indexed lpToken, IRewarder indexed rewarder, uint8 allowedFixedTime);
  event LogSetPool(uint256 indexed pid, uint64[] allocPoints, IRewarder indexed rewarder, uint8 allowedFixedTime, bool overwrite);
  event LogUpdatePool(uint256 indexed pid, uint64 lastRewardTime, uint256 lpSupply, uint256 totalWeight);
  event LogAdaSwapPerSecond(uint256 adaswapPerSecond);

  /// @param _adaswapTreasury The AdaSwapTreasury contract address.
  constructor(AdaSwapToken _adaswapToken, address _adaswapTreasury) {
    ASW = _adaswapToken;
    AdaSwapTreasury = _adaswapTreasury;
  }

  /// @notice Returns the number of MO pools.
  function poolLength() public view returns (uint256 pools) {
    pools = poolInfo.length;
  }

  /// @notice Add a new LP to the pool. Can only be called by the owner.
  /// DO NOT add the same LP token more than once. Rewards will be messed up if you do.
  /// @param _allocPoints AP list of the new pool for each fixed time.
  /// @param _lpToken Address of the LP ERC-20 token.
  /// @param _rewarder Address of the rewarder delegate.
  function add(uint64[] memory _allocPoints, IERC20 _lpToken, IRewarder _rewarder, uint8 _allowedFixedTimeBitMask) public onlyOwner {
    require(_allowedFixedTimeBitMask > 1, "MasterAdaSwap: invalid allowedFixedTimeBitMask.");
    require(_allocPoints.length == fixedTimes.length, "MasterAdaSwap: invalid allocPoints.");
    uint64 poolAllocPoint = 0;
    for (uint8 i = 0; i < _allocPoints.length; i++) {
      poolAllocPoint += _allocPoints[i];
    }
    totalAllocPoint += poolAllocPoint;
    lpToken.push(_lpToken);
    rewarder.push(_rewarder);
  
    poolInfo.push(PoolInfo({
      allocPoint: poolAllocPoint,
      lastRewardTime: block.timestamp.to64(),
      allowedFixedTimeBitMask: _allowedFixedTimeBitMask,
      totalWeight: 0
    }));

    for (uint8 i = 0; i < fixedTimes.length; i++) {
      FixedPoolInfo storage fixedTimeInfo = fixedPoolInfo[poolInfo.length - 1][i];
      fixedTimeInfo.weight = fixedTimeInfo.totalAmount * _allocPoints[i];
      fixedTimeInfo.allocPoint = _allocPoints[i];
    }

    emit LogPoolAddition(lpToken.length - 1, _allocPoints, _lpToken, _rewarder, _allowedFixedTimeBitMask);
  }

  /// @notice Update the given pool's ASW allocation point and `IRewarder` contract. Can only be called by the owner.
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @param _allocPoints New AP of the pool.
  /// @param _rewarder Address of the rewarder delegate.
  /// @param overwrite True if _rewarder should be `set`. Otherwise `_rewarder` is ignored.
  function set(uint256 _pid, uint64[] memory _allocPoints, IRewarder _rewarder, uint8 _allowedFixedTimeBitMask, uint128 _fixedTimeMultiplierRatio, bool overwrite) public onlyOwner {
    require(_allowedFixedTimeBitMask > 1, "MasterAdaSwap: invalid allowedFixedTimeBitMask.");
    require(_allocPoints.length == fixedTimes.length, "MasterAdaSwap: invalid allocPoints.");
    uint64 poolAllocPoint = 0;
    for (uint8 i = 0; i < _allocPoints.length; i++) {
      poolAllocPoint += _allocPoints[i];
    }
    totalAllocPoint = totalAllocPoint - poolInfo[_pid].allocPoint + poolAllocPoint;
    poolInfo[_pid].allocPoint = poolAllocPoint;
    poolInfo[_pid].allowedFixedTimeBitMask = _allowedFixedTimeBitMask;

    for (uint8 i = 0; i < fixedTimes.length; i++) {
      FixedPoolInfo storage fixedTimeInfo = fixedPoolInfo[poolInfo.length - 1][i];
      fixedTimeInfo.weight = fixedTimeInfo.totalAmount * _allocPoints[i];
      fixedTimeInfo.allocPoint = _allocPoints[i];
    }

    if (overwrite) {
      rewarder[_pid] = _rewarder;
    }
    emit LogSetPool(_pid, _allocPoints, overwrite ? _rewarder : rewarder[_pid], _allowedFixedTimeBitMask, overwrite);
  }

  /// @notice Sets the adaswap per second to be distributed. Can only be called by the owner.
  /// @param _adaswapPerSecond The amount of AdaSwap to be distributed per second.
  function setAdaSwapPerSecond(uint256 _adaswapPerSecond) public onlyOwner {
    adaswapPerSecond = _adaswapPerSecond;
    emit LogAdaSwapPerSecond(_adaswapPerSecond);
  }

  /// @notice View function to see pending ASW on frontend.
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @param _user Address of user.
  /// @return pending ASW reward for a given user.
  function pendingAdaSwap(uint256 _pid, address _user, uint8 _fixedLockId) external view returns (uint256 pending) {
    PoolInfo memory pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];
    uint256 accAdaSwapPerShare = fixedPoolInfo[_pid][_fixedLockId].accAdaSwapPerShare;
    uint256 fixedPoolTotalAmount = fixedPoolInfo[_pid][_fixedLockId].totalAmount;
    uint256 lpSupply = lpToken[_pid].balanceOf(address(this));
    if (block.timestamp > pool.lastRewardTime && lpSupply > 0 && pool.totalWeight > 0 && lpSupply > fixedPoolTotalAmount) {
      uint256 time = block.timestamp - pool.lastRewardTime;
      uint256 adaswapReward = time * adaswapPerSecond * fixedPoolInfo[_pid][_fixedLockId].allocPoint * pool.allocPoint / (pool.totalWeight * totalAllocPoint);
      accAdaSwapPerShare += adaswapReward / fixedPoolInfo[_pid][_fixedLockId].totalAmount;
    }
    pending = (int256(user.amount * accAdaSwapPerShare) - user.rewardDebt).toUInt256();
  }

  /// @notice Update reward variables for all pools. Be careful of gas spending!
  /// @param pids Pool IDs of all to be updated. Make sure to update all active pools.
  function massUpdatePools(uint256[] calldata pids) external {
    uint256 len = pids.length;
    for (uint256 i = 0; i < len; ++i) {
      updatePool(pids[i]);
    }
  }

  /// @notice Update reward variables of the given pool.
  /// @param pid The index of the pool. See `poolInfo`.
  /// @return pool Returns the pool that was updated.
  function updatePool(uint256 pid) public returns (PoolInfo memory pool) {
    pool = poolInfo[pid];
    if (block.timestamp > pool.lastRewardTime) {
      uint256 lpSupply = lpToken[pid].balanceOf(address(this));
      uint256 totalWeight = 0;
      for (uint8 i = 0; i < fixedTimes.length; i++) {
        FixedPoolInfo storage fixedTimeInfo = fixedPoolInfo[pid][i];
        totalWeight += fixedTimeInfo.weight;
      }
      if (lpSupply > 0 && totalWeight > 0) {
        uint256 time = block.timestamp - pool.lastRewardTime;
        for (uint8 i = 0; i < fixedTimes.length; i++) {
          FixedPoolInfo storage fixedTimeInfo = fixedPoolInfo[pid][i];
          uint256 adaswapReward = time * adaswapPerSecond * fixedTimeInfo.allocPoint * pool.allocPoint / (totalWeight * totalAllocPoint);
          fixedTimeInfo.accAdaSwapPerShare += (adaswapReward / fixedTimeInfo.totalAmount).to128();
        }
      }
      pool.totalWeight = totalWeight;
      pool.lastRewardTime = block.timestamp.to64();
      poolInfo[pid] = pool;
      emit LogUpdatePool(pid, pool.lastRewardTime, lpSupply, pool.totalWeight);
    }
  }

  /// @notice Deposit LP tokens to MO for ASW allocation.
  /// @param pid The index of the pool. See `poolInfo`.
  /// @param amount LP token amount to deposit.
  /// @param to The receiver of `amount` deposit benefit.
  function deposit(uint256 pid, uint8 lockTimeId, uint256 amount, address to) public {
    require(lockTimeId < fixedTimes.length && ((poolInfo[pid].allowedFixedTimeBitMask >> lockTimeId) & 1) == 1, "MasterAdaSwap: invalid lock time id.");
    PoolInfo memory pool = updatePool(pid);
    UserInfo storage user = userInfo[pid][to];
    
    if ( lockTimeId != user.lockTimeId ) {
      // Migrate fixed lock
      FixedPoolInfo storage fixedTimeInfo = fixedPoolInfo[pid][user.lockTimeId];
      fixedTimeInfo.totalAmount -= user.amount;
      fixedTimeInfo.weight = fixedTimeInfo.totalAmount * fixedTimeInfo.allocPoint;
    }

    FixedPoolInfo storage fixedTimeInfo = fixedPoolInfo[pid][lockTimeId];
    // Effects
    user.amount += amount;
    user.lockTimeId = lockTimeId;
    user.rewardDebt += int256(amount * fixedPoolInfo[pid][lockTimeId].accAdaSwapPerShare);
    fixedTimeInfo.totalAmount += amount;
    fixedTimeInfo.weight = fixedTimeInfo.totalAmount * fixedTimeInfo.allocPoint;

    // Interactions
    IRewarder _rewarder = rewarder[pid];
    if (address(_rewarder) != address(0)) {
      _rewarder.onAdaSwapReward(pid, to, to, 0, user.amount);
    }

    lpToken[pid].safeTransferFrom(msg.sender, address(this), amount);

    emit Deposit(msg.sender, pid, amount, to);
  }

  /// @notice Withdraw LP tokens from MO.
  /// @param pid The index of the pool. See `poolInfo`.
  /// @param amount LP token amount to withdraw.
  /// @param to Receiver of the LP tokens.
  function withdraw(uint256 pid, uint256 amount, address to) public {
    PoolInfo memory pool = updatePool(pid);
    UserInfo storage user = userInfo[pid][msg.sender];
    FixedPoolInfo storage fixedTimeInfo = fixedPoolInfo[pid][user.lockTimeId];

    // Effects
    user.rewardDebt -= int256(amount * fixedTimeInfo.accAdaSwapPerShare);
    user.amount -= amount;
    fixedTimeInfo.totalAmount -= amount;

    // Interactions
    IRewarder _rewarder = rewarder[pid];
    if (address(_rewarder) != address(0)) {
      _rewarder.onAdaSwapReward(pid, msg.sender, to, 0, user.amount);
    }
    
    lpToken[pid].safeTransfer(to, amount);

    emit Withdraw(msg.sender, pid, amount, to);
  }

  /// @notice Harvest proceeds for transaction sender to `to`.
  /// @param pid The index of the pool. See `poolInfo`.
  /// @param to Receiver of ASW rewards.
  function harvest(uint256 pid, address to) public {
    PoolInfo memory pool = updatePool(pid);
    UserInfo storage user = userInfo[pid][msg.sender];
  
    int256 accumulatedAdaSwap = int256(user.amount * fixedPoolInfo[pid][user.lockTimeId].accAdaSwapPerShare);
    uint256 _pendingAdaSwap = (accumulatedAdaSwap - user.rewardDebt).toUInt256();

    // Effects
    user.rewardDebt = accumulatedAdaSwap;

    // Interactions
    if (_pendingAdaSwap != 0) {
      // TODO: update this if there is another way to reward users.
      ASW.safeTransferFrom(AdaSwapTreasury, to, _pendingAdaSwap);
    }

    IRewarder _rewarder = rewarder[pid];
    if (address(_rewarder) != address(0)) {
      _rewarder.onAdaSwapReward( pid, msg.sender, to, _pendingAdaSwap, user.amount);
    }

    emit Harvest(msg.sender, pid, _pendingAdaSwap);
  }
  
  /// @notice Withdraw LP tokens from MO and harvest proceeds for transaction sender to `to`.
  /// @param pid The index of the pool. See `poolInfo`.
  /// @param amount LP token amount to withdraw.
  /// @param to Receiver of the LP tokens and ASW rewards.
  function withdrawAndHarvest(uint256 pid, uint256 amount, address to) public {
    PoolInfo memory pool = updatePool(pid);
    UserInfo storage user = userInfo[pid][msg.sender];
    FixedPoolInfo storage fixedTimeInfo = fixedPoolInfo[pid][user.lockTimeId];

    int256 accumulatedAdaSwap = int256(user.amount * fixedTimeInfo.accAdaSwapPerShare);
    uint256 _pendingAdaSwap = uint256(accumulatedAdaSwap - user.rewardDebt);

    // Effects
    user.rewardDebt = accumulatedAdaSwap - int256(amount * fixedTimeInfo.accAdaSwapPerShare);
    user.amount -= amount;
    fixedTimeInfo.totalAmount -= amount;
    
    // Interactions
    // TODO: update this if there is another way to reward
    ASW.safeTransferFrom(AdaSwapTreasury, to, _pendingAdaSwap);

    IRewarder _rewarder = rewarder[pid];
    if (address(_rewarder) != address(0)) {
      _rewarder.onAdaSwapReward(pid, msg.sender, to, _pendingAdaSwap, user.amount);
    }

    lpToken[pid].safeTransfer(to, amount);

    emit Withdraw(msg.sender, pid, amount, to);
    emit Harvest(msg.sender, pid, _pendingAdaSwap);
  }

  /// @notice Withdraw without caring about rewards. EMERGENCY ONLY.
  /// @param pid The index of the pool. See `poolInfo`.
  /// @param to Receiver of the LP tokens.
  function emergencyWithdraw(uint256 pid, address to) public {
    UserInfo storage user = userInfo[pid][msg.sender];
    uint256 amount = user.amount;
    user.amount = 0;
    user.rewardDebt = 0;

    IRewarder _rewarder = rewarder[pid];
    if (address(_rewarder) != address(0)) {
      _rewarder.onAdaSwapReward(pid, msg.sender, to, 0, 0);
    }

    // Note: transfer can fail or succeed if `amount` is zero.
    lpToken[pid].safeTransfer(to, amount);
    emit EmergencyWithdraw(msg.sender, pid, amount, to);
  }
}
