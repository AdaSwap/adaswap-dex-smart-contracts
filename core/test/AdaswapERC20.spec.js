const { solidity } = require("ethereum-waffle");
const {
  ecsign
} = require('ethereumjs-util')
const {
  use,
  expect
} = require('chai')
const {
  expandTo18Decimals,
  maxUint256,
  getApprovalDigest,
  getDomainSeparator,
  PERMIT_TYPEHASH
} = require('../../lib/shared/utils')

const { Wallet } = require("ethers");
const { ethers } = require("hardhat");
use(solidity)

const TOTAL_SUPPLY = expandTo18Decimals('1000')
const TEST_AMOUNT = expandTo18Decimals('10')

describe('AdaswapERC20', () => {
  let instance 
  let accounts = []
  
  it('name, symbol, decimals, totalSupply, balanceOf, DOMAIN_SEPARATOR, PERMIT_TYPEHASH', async () => {
    accounts = await ethers.getSigners();
    instance = await ethers.getContractFactory("TestAdaswapERC20")
    instance = await instance.deploy(TOTAL_SUPPLY)

    
    expect(await instance.name()).to.eq('Adaswap LP Token')
    expect(await instance.symbol()).to.eq('ALP')
    const decimals = await instance.decimals()
    expect(decimals).to.eq(18)
    const totalSupply = await instance.totalSupply()
    expect(totalSupply).to.eq(TOTAL_SUPPLY)
    const balance0 = await instance.balanceOf(accounts[0].address)
    expect(balance0).to.eq(TOTAL_SUPPLY)
    expect(await instance.DOMAIN_SEPARATOR()).to.eq(
      getDomainSeparator('Adaswap LP Token', instance.address)
    )
    
    expect(await instance.PERMIT_TYPEHASH()).to.eq(
      PERMIT_TYPEHASH
    )
  })

  it('approve', async () => {
    await expect(
        await instance.approve(accounts[1].address, TEST_AMOUNT)
    ).to.emit(instance, 'Approval').withArgs(
        accounts[0].address, 
        accounts[1].address, 
        TEST_AMOUNT
    )

    let allowance = await instance.allowance(accounts[0].address, accounts[1].address)
    expect(allowance.toString()).to.eq(TEST_AMOUNT.toString())
  })

  it('transfer', async () => {
    expect(
        await instance.transfer(accounts[1].address, TEST_AMOUNT)
    ).to.emit(instance, 'Transfer').withArgs(
        accounts[0].address,
        accounts[1].address,
        TEST_AMOUNT
    )

    let balance0 = await instance.balanceOf(accounts[0].address)
    let balance1 = await instance.balanceOf(accounts[1].address)
    expect(balance0.toString()).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT))
    expect(balance1.toString()).to.eq(TEST_AMOUNT)
  })

  it('transfer:fail', async () => {
    expect(
        instance.transfer(accounts[1].address, TOTAL_SUPPLY.add(1))
    ).to.be.reverted;
  })

  it('transferFrom', async () => {
    // approve step
    let tx = await instance.approve(accounts[1].address, TEST_AMOUNT)

    let allowance = await instance.allowance(accounts[0].address, accounts[1].address)
    expect(allowance).to.eq(TEST_AMOUNT)

    // transfer from
    expect(
        await instance.connect(accounts[1]).transferFrom(
            accounts[0].address, 
            accounts[2].address, 
            TEST_AMOUNT
        )
    ).to.emit(instance, 'Transfer').withArgs(
        accounts[0].address,
        accounts[2].address,
        TEST_AMOUNT
    )

    let balance0 = await instance.balanceOf(accounts[0].address)
    let balance2 = await instance.balanceOf(accounts[2].address)
    expect(balance0).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT.mul(2)))
    expect(balance2).to.eq(TEST_AMOUNT)
  })

  it('transferFrom:max', async () => {
    await instance.approve(accounts[1].address, maxUint256)

    let allowance = await instance.allowance(accounts[0].address, accounts[1].address)
    expect(allowance).to.eq(maxUint256)

    // transfer from
    await instance.connect(accounts[1]).transferFrom(accounts[0].address, accounts[2].address, TEST_AMOUNT)
    
    let balance0 = await instance.balanceOf(accounts[0].address)
    let balance2 = await instance.balanceOf(accounts[2].address)
    expect(balance0).to.eq(TOTAL_SUPPLY.sub(TEST_AMOUNT.mul(3)))
    expect(balance2).to.eq(TEST_AMOUNT.mul(2))
  })

  it('permit', async () => {

    const wallet = Wallet.createRandom().connect(ethers.provider)

    let nonce = await instance.nonces(wallet.address)
    const deadline = maxUint256
    const name = await instance.name()
    const digest = getApprovalDigest(
      name,
      instance.address,
      { owner: wallet.address, spender: accounts[1].address, value: TEST_AMOUNT },
      nonce,
      deadline
    )
    const { v, r, s } = ecsign(
        Buffer.from(digest.slice(2), 'hex'), 
        Buffer.from(wallet.privateKey.slice(2), 'hex')
    )
    expect(
        await instance.permit(
            wallet.address, 
            accounts[1].address, 
            TEST_AMOUNT, 
            deadline, 
            Number(v), 
            r, 
            s
        )
    ).to.emit(instance, 'Approval').withArgs(
        wallet.address,
        accounts[1].address,
        TEST_AMOUNT
    )

    const allowance = await instance.allowance(wallet.address, accounts[1].address)
    nonce = await instance.nonces(wallet.address)
    expect(allowance).to.eq(TEST_AMOUNT)
    expect(nonce).to.eq('1')
  })
})
