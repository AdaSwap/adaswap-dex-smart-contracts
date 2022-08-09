// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./libraries/Batchable.sol";
import "./libraries/NumberConverter.sol";
import "./interfaces/IRewarder.sol";
import "./interfaces/IMasterAdaSwap.sol";
import "./AdaSwapToken.sol";

/// @notice The MasterAdaSwap (MO) contract gives out a constant number of ADASWAP tokens per second by minting right from ADASWAP token contract.
contract MasterAdaSwap is Ownable, Batchable {
  using SafeERC20 for IERC20;
  using UInt256 for uint256;
  using Int256 for int256;
  using UInt128 for uint128;

  /// @notice Info of each MO user.
  /// `amount` LP token amount the user has provided.
  /// `rewardDebt` The amount of ADASWAP entitled to the user.
  struct UserInfo {
    uint256 amount;
    int256 rewardDebt;
  }

  /// @notice Info of each MO pool.
  /// `allocPoint` The amount of allocation points assigned to the pool.
  /// Also known as the amount of ADASWAP to distribute per block.
  struct PoolInfo {
    uint128 accAdaSwapPerShare;
    uint64 lastRewardTime;
    uint64 allocPoint;
  }

  /// @notice Address of ADASWAP contract.
  AdaSwapToken public immutable ADASWAP;

  /// @notice Info of each MO pool.
  PoolInfo[] public poolInfo;
  /// @notice Address of the LP token for each MO pool.
  IERC20[] public lpToken;
  /// @notice Address of each `IRewarder` contract in MO.
  IRewarder[] public rewarder;

  /// @notice Info of each user that stakes LP tokens.
  mapping (uint256 => mapping (address => UserInfo)) public userInfo;
  /// @dev Total allocation points. Must be the sum of all allocation points in all pools.
  uint256 public totalAllocPoint = 0;

  uint256 public adaswapPerSecond;

  event Deposit(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
  event Withdraw(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
  event EmergencyWithdraw(address indexed user, uint256 indexed pid, uint256 amount, address indexed to);
  event Harvest(address indexed user, uint256 indexed pid, uint256 amount);
  event LogPoolAddition(uint256 indexed pid, uint256 allocPoint, IERC20 indexed lpToken, IRewarder indexed rewarder);
  event LogSetPool(uint256 indexed pid, uint64 allocPoint, IRewarder indexed rewarder, bool overwrite);
  event LogUpdatePool(uint256 indexed pid, uint64 lastRewardTime, uint256 lpSupply, uint256 accAdaSwapPerShare);
  event LogAdaSwapPerSecond(uint256 adaswapPerSecond);

  /// @param _adaswap The ADASWAP token contract address.
  constructor(AdaSwapToken _adaswap) {
    ADASWAP = _adaswap;
  }

  /// @notice Returns the number of MO pools.
  function poolLength() public view returns (uint256 pools) {
    pools = poolInfo.length;
  }

  /// @notice Add a new LP to the pool. Can only be called by the owner.
  /// DO NOT add the same LP token more than once. Rewards will be messed up if you do.
  /// @param allocPoint AP of the new pool.
  /// @param _lpToken Address of the LP ERC-20 token.
  /// @param _rewarder Address of the rewarder delegate.
  function add(uint64 allocPoint, IERC20 _lpToken, IRewarder _rewarder) public onlyOwner {
    totalAllocPoint += allocPoint;
    lpToken.push(_lpToken);
    rewarder.push(_rewarder);

    poolInfo.push(PoolInfo({
      allocPoint: allocPoint,
      lastRewardTime: block.timestamp.to64(),
      accAdaSwapPerShare: 0
    }));
    emit LogPoolAddition(lpToken.length - 1, allocPoint, _lpToken, _rewarder);
  }

  /// @notice Update the given pool's ADASWAP allocation point and `IRewarder` contract. Can only be called by the owner.
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @param _allocPoint New AP of the pool.
  /// @param _rewarder Address of the rewarder delegate.
  /// @param overwrite True if _rewarder should be `set`. Otherwise `_rewarder` is ignored.
  function set(uint256 _pid, uint64 _allocPoint, IRewarder _rewarder, bool overwrite) public onlyOwner {
    totalAllocPoint = totalAllocPoint - poolInfo[_pid].allocPoint + _allocPoint;
    poolInfo[_pid].allocPoint = _allocPoint;
    if (overwrite) { rewarder[_pid] = _rewarder; }
    emit LogSetPool(_pid, _allocPoint, overwrite ? _rewarder : rewarder[_pid], overwrite);
  }

  /// @notice Sets the adaswap per second to be distributed. Can only be called by the owner.
  /// @param _adaswapPerSecond The amount of AdaSwap to be distributed per second.
  function setAdaSwapPerSecond(uint256 _adaswapPerSecond) public onlyOwner {
    adaswapPerSecond = _adaswapPerSecond;
    emit LogAdaSwapPerSecond(_adaswapPerSecond);
  }

  /// @notice View function to see pending ADASWAP on frontend.
  /// @param _pid The index of the pool. See `poolInfo`.
  /// @param _user Address of user.
  /// @return pending ADASWAP reward for a given user.
  function pendingAdaSwap(uint256 _pid, address _user) external view returns (uint256 pending) {
    PoolInfo memory pool = poolInfo[_pid];
    UserInfo storage user = userInfo[_pid][_user];
    uint256 accAdaSwapPerShare = pool.accAdaSwapPerShare;
    uint256 lpSupply = lpToken[_pid].balanceOf(address(this));
    if (block.timestamp > pool.lastRewardTime && lpSupply != 0) {
      uint256 time = block.timestamp - pool.lastRewardTime;
      uint256 adaswapReward = time * adaswapPerSecond * pool.allocPoint / totalAllocPoint;
      accAdaSwapPerShare += adaswapReward / lpSupply;
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
      if (lpSupply > 0) {
        uint256 time = block.timestamp - pool.lastRewardTime;
        uint256 adaswapReward = time * adaswapPerSecond * pool.allocPoint / totalAllocPoint;
        pool.accAdaSwapPerShare += (adaswapReward / lpSupply).to128();
      }
      pool.lastRewardTime = block.timestamp.to64();
      poolInfo[pid] = pool;
      emit LogUpdatePool(pid, pool.lastRewardTime, lpSupply, pool.accAdaSwapPerShare);
    }
  }

  /// @notice Deposit LP tokens to MO for ADASWAP allocation.
  /// @param pid The index of the pool. See `poolInfo`.
  /// @param amount LP token amount to deposit.
  /// @param to The receiver of `amount` deposit benefit.
  function deposit(uint256 pid, uint256 amount, address to) public {
    PoolInfo memory pool = updatePool(pid);
    UserInfo storage user = userInfo[pid][to];

    // Effects
    user.amount += amount;
    user.rewardDebt += int256(amount * pool.accAdaSwapPerShare);

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

    // Effects
    user.rewardDebt -= int256(amount * pool.accAdaSwapPerShare);
    user.amount -= amount;

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
  /// @param to Receiver of ADASWAP rewards.
  function harvest(uint256 pid, address to) public {
    PoolInfo memory pool = updatePool(pid);
    UserInfo storage user = userInfo[pid][msg.sender];
    int256 accumulatedAdaSwap = int256(user.amount * pool.accAdaSwapPerShare);
    uint256 _pendingAdaSwap = (accumulatedAdaSwap - user.rewardDebt).toUInt256();

    // Effects
    user.rewardDebt = accumulatedAdaSwap;

    // Interactions
    if (_pendingAdaSwap != 0) {
      // TODO: update this if there is another way to reward users.
      ADASWAP.mint(to, _pendingAdaSwap);
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
  /// @param to Receiver of the LP tokens and ADASWAP rewards.
  function withdrawAndHarvest(uint256 pid, uint256 amount, address to) public {
    PoolInfo memory pool = updatePool(pid);
    UserInfo storage user = userInfo[pid][msg.sender];
    int256 accumulatedAdaSwap = int256(user.amount * pool.accAdaSwapPerShare);
    uint256 _pendingAdaSwap = uint256(accumulatedAdaSwap - user.rewardDebt);

    // Effects
    user.rewardDebt = accumulatedAdaSwap - int256(amount * pool.accAdaSwapPerShare);
    user.amount -= amount;
    
    // Interactions
    // TODO: update this if there is another way to reward
    ADASWAP.mint(to, _pendingAdaSwap);

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
