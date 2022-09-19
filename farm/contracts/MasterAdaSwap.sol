// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "hardhat/console.sol";
import "./libraries/Batchable.sol";
import "./libraries/Number.sol";
import "./interfaces/IRewarder.sol";
import "./interfaces/IMasterAdaSwap.sol";
import "./AdaSwapToken.sol";

/// @notice The MasterAdaSwap (MO) contract gives out a constant number of ASW tokens per second by minting right from the AdaSwapToken contract.
contract MasterAdaSwap is Ownable, Batchable {
    using SafeERC20 for IERC20;
    using UInt256 for uint256;
    using Int256 for int256;
    using UInt128 for uint128;

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

    /// @notice The fixedTimes could be able to use in each pools. first element 0 second also meaning the flexible farming.
    uint32[] public fixedTimes = [
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
        IRewarder rewarder;
        uint64 lastRewardTime;
        uint64 allocPoint;
    }

    /// @notice Address of AdaSwapTreasury contract.
    address public immutable AdaSwapTreasury;
    /// @notice Address of ASW contract.
    IERC20 public immutable ASW;

    /// @notice Info about each user that stakes LP tokens.
    // user -> lpToken -> fixedOptionId -> UserInfo
    mapping(address => mapping(address => mapping(uint8 => UserInfo)))
        public userInfo;
    // lp token -> staking option (locktime) -> poolInfo struct
    mapping(address => mapping(uint8 => PoolInfo))
        public poolInfo;
    /// @notice Info of each user that stakes LP tokens.
    mapping(address => uint8[])
        public existingPoolOptions;
    
    /// @dev Total amount of allocation points. Must be the sum of all allocation points from all pools.
    uint256 public totalAllocPoint = 0;

    uint256 private constant ACC_ADASWAP_PRECISION = 1e12;

    uint256 public adaswapPerSecond;

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

    /// @param _adaswapTreasury The contract address.
    constructor(address _adaswapToken, address _adaswapTreasury) {
        ASW = AdaSwapToken(_adaswapToken);
        AdaSwapTreasury = _adaswapTreasury;
    }

    function isAllocatedPool(
        address _lpToken,
        uint8 _lockTimeId
    ) public view returns (bool) {
        return poolInfo[_lpToken][_lockTimeId].allocPoint != 0; 
    }

    function isExistPool(
        address _lpToken,
        uint8 _lockTimeId
    ) public view returns (bool) {
        return poolInfo[_lpToken][_lockTimeId].lastRewardTime != 0; 
    }

    /// @notice Creates a new staking pool with fixed LP token. Can only be called by the owner.
    /// DO NOT add the same LP token more than once. Rewards will be messed up if you do.
    /// @param _allocPoint AP for new pool which are generated for each fixed time.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _lockTimeId The lock time when the user will be able to withdraw or harvest his ASW.
    /// @param _rewarder Address of the rewarder delegate.
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
                rewarder: IRewarder(_rewarder),
                lastRewardTime: block.timestamp.to64(),
                allocPoint: _allocPoint
            });

        existingPoolOptions[_lpToken].push(_lockTimeId);
        
        emit LogPoolAddition(
            _lockTimeId,
            _allocPoint,
            _lpToken,
            IRewarder(_rewarder)
        );
    }

    /// @notice Update the given pool's ASW allocation point and `IRewarder` contract. Can only be called by the owner.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _lockTimeId The lock time when the user will be able to withdraw or harvest his ASW.
    /// @param _allocPoint New AP of the pool.
    /// @param _rewarder Address of the rewarder delegate.
    /// @param overwrite True if _rewarder should be `set`. Otherwise `_rewarder` is ignored.
    function set(
        address _lpToken,
        uint8 _lockTimeId,
        uint256 _allocPoint, 
        IRewarder _rewarder, 
        bool overwrite
    ) public onlyOwner {
        totalAllocPoint = totalAllocPoint - poolInfo[_lpToken][_lockTimeId].allocPoint + _allocPoint;
        poolInfo[_lpToken][_lockTimeId].allocPoint = _allocPoint.to64();
        if (overwrite) { poolInfo[_lpToken][_lockTimeId].rewarder = _rewarder; }

        emit LogSetPool(
            _lpToken,
            _lockTimeId,
            _allocPoint.to64(),
            overwrite ? _rewarder : poolInfo[_lpToken][_lockTimeId].rewarder,
            overwrite
        );
    }

    /// @notice Sets the adaswap per second value to be distributed. Can only be called by the owner.
    /// @param _adaswapPerSecond The amount of AdaSwap to be distributed per second.
    function setAdaSwapPerSecond(uint256 _adaswapPerSecond) public onlyOwner {
        adaswapPerSecond = _adaswapPerSecond;
        emit LogAdaSwapPerSecond(_adaswapPerSecond);
    }

    /// @notice View function to see pending ASW on frontend.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _user Address of the user.
    /// @param _lockTimeId The lock time when the user will be able to withdraw or harvest his ASW.
    function pendingAdaSwap(
        address _lpToken,
        address _user,
        uint8 _lockTimeId
    ) external view returns (uint256 pending) {
        PoolInfo memory pool = poolInfo[_lpToken][_lockTimeId];
        UserInfo storage user = userInfo[_user][_lpToken][_lockTimeId];
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

    /// @notice Updates reward variables for all pools. Be careful of gas spending!
    /// @param _lpToken Address of the LP ERC-20 token.
    function massUpdatePools(address _lpToken) external {
        uint256 len = existingPoolOptions[_lpToken].length;
        for (uint256 i = 0; i < len; ++i) {
            updatePool(_lpToken, existingPoolOptions[_lpToken][i]);
        }
    }

    /// @notice Update reward variables of the given pool.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _lockTimeId The lock time when the user will be able to withdraw or harvest his ASW.
    function updatePool(
        address _lpToken,
        uint8 _lockTimeId
    ) public returns (PoolInfo memory pool) {
        pool = poolInfo[_lpToken][_lockTimeId];
        if (block.timestamp > pool.lastRewardTime) {
            uint256 lpSupply = pool.lpSupply;
            if (lpSupply > 0) {
                uint256 timestamp = block.timestamp - pool.lastRewardTime;
                uint256 adaReward = timestamp * adaswapPerSecond * pool.allocPoint / totalAllocPoint;
                pool.accAdaSwapPerShare = pool.accAdaSwapPerShare + (adaReward * ACC_ADASWAP_PRECISION / lpSupply).to128();
            }
            pool.lastRewardTime = block.timestamp.to64();
            poolInfo[_lpToken][_lockTimeId] = pool;
            emit LogUpdatePool(_lpToken, _lockTimeId, pool.lastRewardTime, lpSupply, pool.accAdaSwapPerShare);
        }
    }

    /// @notice Deposit LP tokens to MO for ASW allocation.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _amount LP token amount to deposit.
    /// @param _to The receiver of `amount` deposit benefit.
    /// @param _lockTimeId The lock time when the user will be able to withdraw or harvest his ASW.
    function deposit(
        address _lpToken,
        address _to,
        uint256 _amount,
        uint8 _lockTimeId
    ) public {
        require(isExistPool(_lpToken, _lockTimeId), 'MasterAdaSwap: POOL_DOES_NOT_EXIST');
        PoolInfo storage pool = poolInfo[_lpToken][_lockTimeId];
        UserInfo storage user = userInfo[_to][_lpToken][_lockTimeId];
        updatePool(_lpToken, _lockTimeId);

        // Effects
        user.amount = user.amount + _amount;
        user.rewardDebt = user.rewardDebt + int256(_amount * pool.accAdaSwapPerShare / ACC_ADASWAP_PRECISION);
        user.lastDepositTime = block.timestamp.to64();
        pool.lpSupply = pool.lpSupply + _amount;

        // Interactions
        IRewarder _rewarder = pool.rewarder;
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(_lpToken, _to, _to, 0, user.amount, _lockTimeId);
        }

        IERC20(_lpToken).safeTransferFrom(msg.sender, address(this), _amount);

        emit Deposit(msg.sender, _lpToken, _amount, _lockTimeId, _to);
    }

    /// @notice Withdraw LP tokens from MO.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _to Receiver of the LP tokens.
    /// @param _amount LP token amount to withdraw.
    /// @param _lockTimeId The lock time when the user will be able to withdraw or harvest his ASW.
    function withdraw(
        address _lpToken,
        address _to,
        uint256 _amount,
        uint8 _lockTimeId
    ) public {
        PoolInfo storage pool = poolInfo[_lpToken][_lockTimeId];
        UserInfo storage user = userInfo[msg.sender][_lpToken][_lockTimeId];
        updatePool(_lpToken, _lockTimeId);

        require(
            user.lastDepositTime + fixedTimes[_lockTimeId] <= block.timestamp,
            'MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER'
        );
        // Effects
        user.amount = user.amount - _amount;
        user.rewardDebt = user.rewardDebt - int256(_amount * pool.accAdaSwapPerShare / ACC_ADASWAP_PRECISION);
        pool.lpSupply -= _amount;
        
        // Interactions
        IRewarder _rewarder = pool.rewarder;
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(_lpToken, msg.sender, _to, 0, user.amount, _lockTimeId);
        }

        IERC20(_lpToken).safeTransfer(_to, _amount);

        emit Withdraw(msg.sender, _lpToken, _amount, _lockTimeId, _to);
    }

    /// @notice Harvest proceeds for transaction sender to `to`.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param to Receiver of ASW rewards.
    /// @param _lockTimeId The lock time when the user will be able to withdraw or harvest his ASW.
    function harvest(
        address _lpToken, 
        address to,
        uint8 _lockTimeId
    ) public {
        PoolInfo memory pool = updatePool(_lpToken, _lockTimeId);
        UserInfo storage user = userInfo[msg.sender][_lpToken][_lockTimeId];

        console.log('user.lastDepositTime: ', user.lastDepositTime);
        console.log('fixed time: ', fixedTimes[_lockTimeId]);
        console.log('NOW: ', block.timestamp);
        require(
            user.lastDepositTime + fixedTimes[_lockTimeId] <= block.timestamp,
            'MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER'
        );
        
        int256 accumulatedAdaSwap = int256(user.amount * pool.accAdaSwapPerShare / ACC_ADASWAP_PRECISION);
        uint256 _pendingAdaSwap = (accumulatedAdaSwap - user.rewardDebt)
            .toUInt256();

        // Effects
        user.rewardDebt = accumulatedAdaSwap;

        // Interactions
        if (_pendingAdaSwap != 0) {
            ASW.safeTransferFrom(AdaSwapTreasury, to, _pendingAdaSwap);
        }

        IRewarder _rewarder = pool.rewarder;
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(
                _lpToken,
                msg.sender,
                to,
                _pendingAdaSwap,
                user.amount,
                _lockTimeId
            );
        }

        emit Harvest(msg.sender, _lpToken, _pendingAdaSwap, _lockTimeId);
    }

    /// @notice Withdraw LP tokens from MO and harvest proceeds for transaction sender to `to`.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _amount LP token amount to withdraw.
    /// @param _to Receiver of the LP tokens and ASW rewards.
    /// @param _lockTimeId The lock time when the user will be able to withdraw or harvest his ASW.
    function withdrawAndHarvest(
        address _lpToken, 
        uint256 _amount,
        address _to,
        uint8 _lockTimeId
    ) public {
        PoolInfo storage pool = poolInfo[_lpToken][_lockTimeId];
        UserInfo storage user = userInfo[msg.sender][_lpToken][_lockTimeId];
        updatePool(_lpToken, _lockTimeId);

        require(
            user.lastDepositTime + fixedTimes[_lockTimeId] <= block.timestamp,
            'MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER'
        );

        int256 accumulatedAdaSwap = int256(
            user.amount * pool.accAdaSwapPerShare / ACC_ADASWAP_PRECISION
        );
        uint256 _pendingAdaSwap = uint256(accumulatedAdaSwap - user.rewardDebt);

        // Effects
        user.rewardDebt =
            accumulatedAdaSwap -
            int256(_amount * pool.accAdaSwapPerShare);
        user.amount -= _amount;
        pool.lpSupply -= _amount;

        // Interactions
        ASW.safeTransferFrom(AdaSwapTreasury, _to, _pendingAdaSwap);

        IRewarder _rewarder = pool.rewarder;
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward(
                _lpToken,
                msg.sender,
                _to,
                _pendingAdaSwap,
                user.amount,
                _lockTimeId
            );
        }

        IERC20(_lpToken).safeTransfer(_to, _amount);

        emit Withdraw(msg.sender, _lpToken, _amount,_lockTimeId , _to);
        emit Harvest(msg.sender, _lpToken, _pendingAdaSwap, _lockTimeId);
    }

    /// @notice Withdraw without caring about rewards. EMERGENCY ONLY.
    /// @param _lpToken Address of the LP ERC-20 token.
    /// @param _to Receiver of the LP tokens.
    /// @param _lockTimeId The lock time when the user will be able to withdraw or harvest his ASW.
    function emergencyWithdraw(
        address _lpToken, 
        address _to,        
        uint8 _lockTimeId
    ) public {
        PoolInfo storage pool = poolInfo[_lpToken][_lockTimeId];
        UserInfo storage user = userInfo[msg.sender][_lpToken][_lockTimeId];
        updatePool(_lpToken, _lockTimeId);
    
        uint256 amount = user.amount;
        user.amount = 0;
        user.rewardDebt = 0;
        pool.lpSupply -= amount;

        IRewarder _rewarder =  poolInfo[_lpToken][_lockTimeId].rewarder;
        if (address(_rewarder) != address(0)) {
            _rewarder.onAdaSwapReward( _lpToken, msg.sender, _to, 0, 0, _lockTimeId);
        }

        // Note: transfer can fail or succeed if `amount` is zero.
        IERC20(_lpToken).safeTransfer(_to, amount);
        emit EmergencyWithdraw(msg.sender, _lpToken, amount, _lockTimeId, _to);
    }
}
