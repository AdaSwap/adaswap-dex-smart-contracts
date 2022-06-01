const ERC20 = artifacts.require('test/ERC20')
const { ecsign } = require('ethereumjs-util')
const { use, expect } = require('chai')
const { utils, eth } = web3
const solidity = require('./shared/solidity')

use(solidity)

const TOTAL_SUPPLY = utils.toBN(1000).mul(utils.toBN(10).pow(utils.toBN(18)))
const TEST_AMOUNT = utils.toBN(10).mul(utils.toBN(10).pow(utils.toBN(18)))
const MAX_UINT256 = (utils.toBN(2).pow(utils.toBN(256))).sub(utils.toBN(1))
const PERMIT_TYPEHASH = utils.keccak256(
  utils.stringToHex('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
)

function getDomainSeparator(
  name,
  tokenAddress
) {
  return utils.keccak256(
    eth.abi.encodeParameters(
      ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
      [
        utils.keccak256(
          utils.stringToHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
        ),
        utils.keccak256(utils.stringToHex(name)),
        utils.keccak256(utils.stringToHex('1')),
        1,
        tokenAddress
      ]
    )
  )
}

function getApprovalDigest(
  tokenName,
  tokenAddress,
  approve,
  nonce,
  deadline
) {
  const DOMAIN_SEPARATOR = getDomainSeparator(tokenName, tokenAddress)
  return utils.soliditySha3(
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
      type: 'bytes32', value: utils.keccak256(
        eth.abi.encodeParameters(
          ['bytes32', 'address', 'address', 'uint256', 'uint256', 'uint256'],
          [PERMIT_TYPEHASH, approve.owner, approve.spender, approve.value, nonce, deadline]
        )
      )
    }
  )
}

contract('AdaswapERC20', async accounts => {
  let instance
  beforeEach(async () => {
    instance = await ERC20.new(TOTAL_SUPPLY)
  })
  it('name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH', async () => {
    expect(await instance.name()).to.eq('Adaswap LP Token', 'token name')
    expect(await instance.symbol()).to.eq('ALP', 'token symbol')
    const decimals = await instance.decimals()
    expect(decimals.toNumber()).to.eq(18, 'token decimals')
    const totalSupply = await instance.totalSupply()
    expect(totalSupply.toString()).to.eq(TOTAL_SUPPLY.toString(), 'total supply')
    const balance0 = await instance.balanceOf(accounts[0])
    expect(balance0.toString()).to.eq(TOTAL_SUPPLY.toString(), 'initial account balance')
    expect(await instance.DOMAIN_SEPARATOR()).to.eq(
      utils.keccak256(
        eth.abi.encodeParameters(
          ['bytes32', 'bytes32', 'bytes32', 'uint256', 'address'],
          [
            utils.keccak256(
              utils.stringToHex('EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)')
            ),
            utils.keccak256(utils.stringToHex('Adaswap LP Token')),
            utils.keccak256(utils.stringToHex('1')),
            1,
            instance.address
          ]
        )
      ),
      'domain seperator'
    )
    expect(await instance.PERMIT_TYPEHASH()).to.eq(
      utils.keccak256(
        utils.stringToHex('Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)')
      ),
      'permit typehash'
    )
  })

  it('approve', async () => {
    let tx = await instance.approve(accounts[1], TEST_AMOUNT)
    expect(tx).to.emit('Approval', {owner: accounts[0], spender: accounts[1], value: TEST_AMOUNT})

    let allowance = await instance.allowance(accounts[0], accounts[1])
    expect(allowance.toString()).to.eq(TEST_AMOUNT.toString(), 'allowance')
  })

  it('transfer', async () => {
    let tx = await instance.transfer(accounts[1], TEST_AMOUNT)
    expect(tx).to.emit('Transfer', {from: accounts[0], to: accounts[1], value: TEST_AMOUNT})

    let balance0 = await instance.balanceOf(accounts[0])
    let balance1 = await instance.balanceOf(accounts[1])
    expect(balance0.toString()).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT).toString(), 'balance 0')
    expect(balance1.toString()).to.eq(TEST_AMOUNT.toString(), 'balance 1')
  })

  it('transfer:fail', async () => {
    let err

    try {
      await instance.transfer(accounts[1], TOTAL_SUPPLY.add(utils.toBN(1)))
    } catch (ex) {
      err = ex
    }

    expect(err).to.reverted
  })

  it('transferFrom', async () => {
    // approve step
    let tx = await instance.approve(accounts[1], TEST_AMOUNT)
    expect(tx).to.emit('Approval', {owner: accounts[0], spender: accounts[1], value: TEST_AMOUNT})

    let allowance = await instance.allowance(accounts[0], accounts[1])
    expect(allowance.toString()).to.eq(TEST_AMOUNT.toString(), 'allowance')

    // transfer from
    tx = await instance.transferFrom(accounts[0], accounts[2], TEST_AMOUNT, { from: accounts[1] })
    expect(tx).to.emit('Transfer', {from: accounts[0], to: accounts[2], value: TEST_AMOUNT})

    let balance0 = await instance.balanceOf(accounts[0])
    let balance2 = await instance.balanceOf(accounts[2])
    expect(balance0.toString()).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT).toString(), 'balance 0')
    expect(balance2.toString()).to.eq(TEST_AMOUNT.toString(), 'balance 2')
  })

  it('transferFrom:max', async () => {
    let tx = await instance.approve(accounts[1], MAX_UINT256)
    expect(tx).to.emit('Approval', {owner: accounts[0], spender: accounts[1], value: MAX_UINT256})

    let allowance = await instance.allowance(accounts[0], accounts[1])
    expect(allowance.toString()).to.eq(MAX_UINT256.toString(), 'allowance')

    // transfer from
    tx = await instance.transferFrom(accounts[0], accounts[2], TEST_AMOUNT, { from: accounts[1] })
    expect(tx).to.emit('Transfer', {from: accounts[0], to: accounts[2], value: TEST_AMOUNT})
    
    let balance0 = await instance.balanceOf(accounts[0])
    let balance2 = await instance.balanceOf(accounts[2])
    expect(balance0.toString()).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT).toString(), 'balance 0')
    expect(balance2.toString()).to.eq(TEST_AMOUNT.toString(), 'balance 2')
  })

  it('permit', async () => {

    const wallets = await eth.accounts.wallet.create(1)

    let nonce = await instance.nonces(wallets[0].address)
    const deadline = MAX_UINT256
    const name = await instance.name()
    const digest = await getApprovalDigest(
      name,
      instance.address,
      { owner: wallets[0].address, spender: accounts[1], value: TEST_AMOUNT },
      nonce,
      deadline
    )
    const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from(wallets[0].privateKey.slice(2), 'hex'))
    const tx = await instance.permit(wallets[0].address, accounts[1], TEST_AMOUNT, deadline, Number(v), r, s)
    expect(tx).to.emit('Approval', {owner: wallets[0].address, spender: accounts[1], value: TEST_AMOUNT})

    const allowance = await instance.allowance(wallets[0].address, accounts[1])
    nonce = await instance.nonces(wallets[0].address)
    expect(allowance.toString()).to.eq(TEST_AMOUNT.toString(), 'allowance')
    expect(nonce.toString()).to.eq('1', 'nonce')
  })
})
