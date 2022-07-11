const { ethers } = require("hardhat");
const { constants, Wallet, BigNumber, utils, providers } = require("ethers");
const maxUint256 = constants.MaxUint256
const provider = providers.getDefaultProvider()
const addressZero = constants.AddressZero

const expandTo18Decimals = function (number) {
  return utils.parseEther(number)
}

const getDomainSeparator = function (
  name,
  tokenAddress
) {
  return utils.keccak256(
    utils.defaultAbiCoder.encode(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        utils.keccak256(
          utils.toUtf8Bytes('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
        ),
        utils.keccak256(utils.toUtf8Bytes(name)),
        utils.keccak256(utils.toUtf8Bytes('1')),
        ethers.provider._network.chainId,
        tokenAddress
      ]
    )
  )
}

const getApprovalDigest = function (
  tokenName,
  tokenAddress,
  approve,
  nonce,
  deadline
) {
  const DOMAIN_SEPARATOR = getDomainSeparator(tokenName, tokenAddress)
  const digest = utils.keccak256(
    utils.solidityPack(
        ['bytes1', 'bytes1', 'bytes32', 'bytes32'],
        [
          '0x19',
          '0x01',
          DOMAIN_SEPARATOR,
          utils.keccak256(
            utils.defaultAbiCoder.encode(
              ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
              [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
            )
          )
        ]
      )
    );
  return digest
}

const PERMIT_TYPEHASH = utils.keccak256(
  utils.toUtf8Bytes('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

const mineBlock = async function (timestamp) {
  // await ethers.provider.send("evm_increaseTime", [timestamp]);
  await ethers.provider.send("evm_mine", [timestamp]);
}

const encodePrice = function (reserve0, reserve1) {
  return [reserve1.mul(BigNumber.from(2).pow(BigNumber.from(112))).div(reserve0), reserve0.mul(BigNumber.from(2).pow(BigNumber.from(112))).div(reserve1)]
}

const getCreate2Address = function (
  creatorAddress,
  [tokenA, tokenB],
  bytecode
) {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]

  return `0x${utils.keccak256(`0x${[
    'ff',
    creatorAddress,
    utils.keccak256(
      utils.solidityPack(
        ['address', 'address'],
        [
          token0,
          token1
        ]
      )
    ),
    utils.keccak256(bytecode)
  ].map(x => x.replace(/0x/, ''))
  .join('')}`).slice(-40)}`
}

module.exports = {
  maxUint256,
  expandTo18Decimals,
  getDomainSeparator,
  getApprovalDigest,
  mineBlock,
  encodePrice,
  getCreate2Address,
  PERMIT_TYPEHASH,
  addressZero
}
