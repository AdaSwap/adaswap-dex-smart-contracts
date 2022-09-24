// SPDX-License-Identifier: MIT
pragma solidity >=0.8.0 <0.9.0;
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
  ) external onlyMCV2 {
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
