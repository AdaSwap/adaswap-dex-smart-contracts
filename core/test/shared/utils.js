const maxUint256 = (web3.utils.toBN(2).pow(web3.utils.toBN(256))).sub(web3.utils.toBN(1))

const addressZero = "0x0000000000000000000000000000000000000000"

const expandTo18Decimals = function (number) {
  return web3.utils.toBN(number).mul(web3.utils.toBN(10).pow(web3.utils.toBN(18)))
}

const getDomainSeparator = function (
  name,
  tokenAddress
) {
  return web3.utils.keccak256(
    web3.eth.abi.encodeParameters(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        web3.utils.keccak256(
          web3.utils.stringToHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
        ),
        web3.utils.keccak256(web3.utils.stringToHex(name)),
        web3.utils.keccak256(web3.utils.stringToHex('1')),
        1,
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
  return web3.utils.soliditySha3(
    {
      type: 'bytes1', value: '0x19'
    },
    {
      type: 'bytes1', value: '0x01'
    },
    {
      type: 'bytes32', value: DOMAIN_SEPARATOR
    },
    {
      type: 'bytes32', value: web3.utils.keccak256(
        web3.eth.abi.encodeParameters(
          ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
          [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
        )
      )
    }
  )
}

const PERMIT_TYPEHASH = web3.utils.keccak256(
  web3.utils.stringToHex('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

const mineBlock = async function (timestamp) {
  await new Promise(async (resolve, reject) => {
    web3.currentProvider.send(
      { id: 1, jsonrpc: '2.0', method: 'evm_mine', params: [timestamp] },
      (error, result) => {
        if (error) {
          reject(error)
        } else {
          resolve(result)
        }
      }
    )
  })
}

const encodePrice = function (reserve0, reserve1) {
  return [reserve1.mul(web3.utils.toBN(2).pow(web3.utils.toBN(112))).div(reserve0), reserve0.mul(web3.utils.toBN(2).pow(web3.utils.toBN(112))).div(reserve1)]
}

const getCreate2Address = function (
  creatorAddress,
  [tokenA, tokenB],
  bytecode
) {
  const [token0, token1] = tokenA < tokenB ? [tokenA, tokenB] : [tokenB, tokenA]

  return `0x${web3.utils.sha3(`0x${[
    'ff',
    creatorAddress,
    web3.utils.soliditySha3(
      {
        type: 'address', value: token0
      },
      {
        type: 'address', value: token1
      }
    ),
    web3.utils.sha3(bytecode)
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
