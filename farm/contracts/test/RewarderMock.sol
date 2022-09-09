// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;
import "../interfaces/IRewarder.sol";
import "../interfaces/IRewarder.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract RewarderMock is IRewarder {
  using SafeERC20 for IERC20;

  uint256 private immutable rewardMultiplier;
  IERC20 private immutable rewardToken;
  uint256 private constant REWARD_TOKEN_DIVISOR = 1e18;
  address private immutable MASTERADASWAP;

  constructor(
    uint256 _rewardMultiplier,
    IERC20 _rewardToken,
    address _MASTERADASWAP
  ) {
    rewardMultiplier = _rewardMultiplier;
    rewardToken = _rewardToken;
    MASTERADASWAP = _MASTERADASWAP;
  }

  function onAdaSwapReward(
    address lpToken, 
    address user, 
    address recipient, 
    uint256 adaswapAmount, 
    uint256 newLpAmount, 
    uint8 lockTimeId
  ) external override onlyMCV2 {
    uint256 pendingReward = adaswapAmount * rewardMultiplier / REWARD_TOKEN_DIVISOR;
    uint256 rewardBal = rewardToken.balanceOf(address(this));
    if (pendingReward > rewardBal) {
      rewardToken.safeTransfer(recipient, rewardBal);
    } else {
      rewardToken.safeTransfer(recipient, pendingReward);
    }
  }

  function pendingTokens(
    uint256 pid,
    address user, 
    uint256 adaswapAmount
  )
    external
    view
    override
    returns (IERC20[] memory rewardTokens, uint256[] memory rewardAmounts)
  {
    IERC20[] memory _rewardTokens = new IERC20[](1);
    _rewardTokens[0] = (rewardToken);
    uint256[] memory _rewardAmounts = new uint256[](1);
    _rewardAmounts[0] =
      adaswapAmount * rewardMultiplier / REWARD_TOKEN_DIVISOR;
    return (_rewardTokens, _rewardAmounts);
  }

  modifier onlyMCV2() {
    require(
      msg.sender == MASTERADASWAP,
      "Only MCV2 can call this function."
    );
    _;
  }
}


// pragma solidity >=0.8.0 <0.9.0;

// import "../interfaces/IRewarder.sol";
// import "@openzeppelin/contracts/access/Ownable.sol";
// import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
// import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
// import "hardhat/console.sol";
// import "../libraries/Batchable.sol";
// import "../libraries/Number.sol";
// import "../interfaces/IRewarder.sol";
// import "../MasterAdaSwap.sol";
// import "../AdaSwapToken.sol";

// contract RewarderMock is IRewarder {
//     using SafeERC20 for IERC20;
//     using UInt256 for uint256;
//     using Int256 for int256;
//     using UInt128 for uint128;

//     /// @notice Info of each MO user.
//     /// `amount` LP token amount the user has provided.
//     /// `rewardDebt` The amount of ASW entitled to the user.
//     /// `lockTimeId` The lock time when the user will be able to withdraw or harvest his ASW
//     /// This value referrence to index fixedTime on PoolInfo.
//     struct UserInfo {
//         uint256 amount;
//         int256 rewardDebt;
//         uint8 lockTimeId;
//         uint64 lastDepositTime;
//     }

//     /// @notice The fixedTimes could be able to use in each pools. first element 0 second also meaning the flexible farming.
//     uint32[] public fixedTimes = [
//         7 days,
//         14 days,
//         30 days,
//         60 days,
//         90 days,
//         365 days
//     ];

//     /// @notice Info of each MO pool.
//     /// `allocPoint` The amount of allocation points assigned to the pool.
//     /// Also known as the amount of ASW to distribute per seconds.
//     struct PoolInfo {
//         uint256 lpSupply;
//         uint256 accAdaSwapPerShare;
//         IRewarder rewarder;
//         uint64 lastRewardTime;
//         uint64 allocPoint;
//     }

//     /// @notice Address of AdaSwapTreasury contract.
//     address public immutable rewardTokenTreasury;

//     /// @notice Address of ASW contract.
//     IERC20 private immutable rewardToken;

//     /// @notice Info of each user that stakes LP tokens.
//     // user -> lpToken -> fixedOptionId -> UserInfo
//     mapping(address => mapping(address => mapping(uint8 => UserInfo)))
//         public userInfo;
//     // lp token -> staking oprtion (locktime) -> poolInfo struct
//     mapping(address => mapping(uint8 => PoolInfo))
//         public poolInfo;
//     /// @notice Info of each user that stakes LP tokens.
//     mapping(address => uint8[])
//         public existingPoolOptions;
//     /// @dev Total allocation points. Must be the sum of all allocation points in all pools.
//     uint256 public totalAllocPoint = 0;

//     uint256 private constant ACC_ADASWAP_PRECISION = 1e12;

//     address private immutable MASTERADASWAP;

//     uint256 public adaswapPerSecond;

//     event LogPoolAddition(
//         uint8 lockTimeId,
//         uint64 allocPoint,
//         address indexed lpToken,
//         IRewarder indexed rewarder
//     );
//     event LogSetPool(
//         address indexed lpToken,
//         uint8 lockTimeId,
//         uint64 allocPoint,
//         IRewarder indexed rewarder,
//         bool overwrite
//     );
//     event LogUpdatePool(
//         address indexed lpToken,
//         uint8 _lockTimeId,
//         uint64 lastRewardTime,
//         uint256 lpSupply,
//         uint256 totalWeight
//     );
//     event LogAdaSwapPerSecond(uint256 adaswapPerSecond);

//     /// @param _rewardTokenTreasury The RewardTokenTreasury contract address.
//     constructor(address _rewardToken, address _rewardTokenTreasury, address _MASTERADASWAP) {
//         rewardToken = IERC20(_rewardToken);
//         rewardTokenTreasury = _rewardTokenTreasury;
//         MASTERADASWAP = _MASTERADASWAP;
//     }

//     // / @notice Add a new LP to the pool. Can only be called by the owner.
//     // / DO NOT add the same LP token more than once. Rewards will be messed up if you do.
//     // / @param _allocPoints AP list of the new pool for each fixed time.
//     // / @param _lpToken Address of the LP ERC-20 token.
//     // / @param _rewarder Address of the rewarder delegate.
//     function add(
//         uint64 _allocPoint,
//         address _lpToken,
//         uint8 _lockTimeId,
//         address _rewarder
//     ) public onlyOwner {
//         totalAllocPoint += _allocPoint;
//         poolInfo[_lpToken][_lockTimeId] = 
//             PoolInfo({
//                 lpSupply: 0,
//                 accAdaSwapPerShare: 0,
//                 rewarder: IRewarder(_rewarder),
//                 lastRewardTime: block.timestamp.to64(),
//                 allocPoint: _allocPoint
//             });

//         existingPoolOptions[_lpToken].push(_lockTimeId);
        
//         emit LogPoolAddition(
//             _lockTimeId,
//             _allocPoint,
//             _lpToken,
//             IRewarder(_rewarder)
//         );
//     }

//     // / @notice Update the given pool's ASW allocation point and `IRewarder` contract. Can only be called by the owner.
//     // / @param _pid The index of the pool. See `poolInfo`.1
//     // / @param _allocPoints New AP of the pool.
//     // / @param _rewarder Address of the rewarder delegate.
//     // / @param overwrite True if _rewarder should be `set`. Otherwise `_rewarder` is ignored.
//     function set(
//         address _lpToken,
//         uint8 _lockTimeId,
//         uint256 _allocPoint, 
//         IRewarder _rewarder, 
//         bool overwrite
//     ) public onlyOwner {
//         totalAllocPoint = totalAllocPoint - poolInfo[_lpToken][_lockTimeId].allocPoint + _allocPoint;
//         poolInfo[_lpToken][_lockTimeId].allocPoint = _allocPoint.to64();
//         if (overwrite) { poolInfo[_lpToken][_lockTimeId].rewarder = _rewarder; }

//         emit LogSetPool(
//             _lpToken,
//             _lockTimeId,
//             _allocPoint.to64(),
//             overwrite ? _rewarder : poolInfo[_lpToken][_lockTimeId].rewarder,
//             overwrite
//         );
//     }

//     /// @notice Sets the adaswap per second to be distributed. Can only be called by the owner.
//     /// @param _adaswapPerSecond The amount of AdaSwap to be distributed per second.
//     function setAdaSwapPerSecond(uint256 _adaswapPerSecond) public onlyOwner {
//         adaswapPerSecond = _adaswapPerSecond;
//         emit LogAdaSwapPerSecond(_adaswapPerSecond);
//     }

//     // / @notice View function to see pending ASW on frontend.
//     // / @param _pid The index of the pool. See `poolInfo`.
//     // / @param _user Address of user.
//     // / @return pending ASW reward for a given user.
//     function pendingAdaSwap(
//         address _lpToken,
//         address _user,
//         uint8 _lockTimeId
//     ) external view returns (uint256 pending) {
//         PoolInfo memory pool = poolInfo[_lpToken][_lockTimeId];
//         UserInfo storage user = userInfo[_user][_lpToken][_lockTimeId];
//         uint256 accAdaSwapPerShare = pool.accAdaSwapPerShare;
//         uint256 lpSupply = pool.lpSupply;
//         console.log('block.timestamp :', block.timestamp);
//         console.log('pool.lastRewardTime :', pool.lastRewardTime);
//         if (
//             block.timestamp > pool.lastRewardTime &&
//             lpSupply > 0
//         ) {
//             uint256 time = block.timestamp - pool.lastRewardTime;
//             uint256 adaswapReward = (time * adaswapPerSecond * pool.allocPoint) / totalAllocPoint;
//             accAdaSwapPerShare = accAdaSwapPerShare + (adaswapReward * ACC_ADASWAP_PRECISION / lpSupply);

//             console.log('time: ',time);
//             console.log('adaswapPerSecond: ', adaswapPerSecond);
//             console.log('totalAllocPoint: ', totalAllocPoint);
//             console.log('pool.allocPoin: ', pool.allocPoint);
//             console.log('accAdaSwapPerShare: ', accAdaSwapPerShare);
//         }
//         pending = (int256(user.amount * accAdaSwapPerShare / ACC_ADASWAP_PRECISION) - user.rewardDebt)
//             .toUInt256();
//     }

//     // / @notice Update reward variables for all pools. Be careful of gas spending!
//     // / @param pids Pool IDs of all to be updated. Make sure to update all active pools.
//     function massUpdatePools(address _lpToken) external {
//         uint256 len = existingPoolOptions[_lpToken].length;
//         for (uint256 i = 0; i < len; ++i) {
//             updatePool(_lpToken, existingPoolOptions[_lpToken][i]);
//         }
//     }

//     // change to mapping
//     // / @notice Update reward variables of the given pool.
//     // / @param pid The index of the pool. See `poolInfo`.
//     // / @return pool Returns the pool that was updated.
//     function updatePool(
//         address _lpToken,
//         uint8 _lockTimeId
//     ) public returns (PoolInfo memory pool) {
//         pool = poolInfo[_lpToken][_lockTimeId];
//         require(pool.lastRewardTime != 0, 'Pool does not exist');
//         if (block.timestamp > pool.lastRewardTime) {
//             uint256 lpSupply = pool.lpSupply;
//             if (lpSupply > 0) {
//                 uint256 timestamp = block.timestamp - pool.lastRewardTime;
//                 uint256 adaReward = timestamp * adaswapPerSecond * pool.allocPoint / totalAllocPoint;
//                 pool.accAdaSwapPerShare = pool.accAdaSwapPerShare + (adaReward * ACC_ADASWAP_PRECISION / lpSupply).to128();
//             }
//             pool.lastRewardTime = block.timestamp.to64();
//             poolInfo[_lpToken][_lockTimeId] = pool;
//             emit LogUpdatePool(_lpToken, _lockTimeId, pool.lastRewardTime, lpSupply, pool.accAdaSwapPerShare);
//         }
//     }
// }
