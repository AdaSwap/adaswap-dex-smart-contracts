const { solidity } = require("ethereum-waffle");
const AdaswapFactoryJson = require('../../core/artifacts/contracts/AdaswapFactory.sol/AdaswapFactory.json')
const AdaswapPairJson = require('../../core/artifacts/contracts/AdaswapPair.sol/AdaswapPair.json')
const { use, expect } = require('chai')
const {
  ecsign
} = require('ethereumjs-util')
const {
  expandTo18Decimals,
  getApprovalDigest,
  MINIMUM_LIQUIDITY,
  maxUint256
} = require('../../lib/shared/utils')

const { Wallet, utils, Contract, ContractFactory, BigNumber } = require("ethers");
const { ethers } = require("hardhat");
use(solidity)

const TOKEN0_TOTAL_SUPPLY = expandTo18Decimals('2000')
const TOKEN1_TOTAL_SUPPLY = expandTo18Decimals('8000')
const AdaswapFactoryInterface = AdaswapFactoryJson.abi
const AdaswapFactoryByteCode = AdaswapFactoryJson.bytecode

describe('AdaswapRouter02', () => {

  let token0, token1, router
  let accounts = []
  beforeEach(async function () {
    accounts = await ethers.getSigners();
    let TokenFactory = await ethers.getContractFactory("TestERC20")
    token0 = await TokenFactory.deploy('Token 0', 'TK0', TOKEN0_TOTAL_SUPPLY)
    token1 = await TokenFactory.deploy('Token 1', 'TK1', TOKEN1_TOTAL_SUPPLY)

    let interface = new utils.Interface(AdaswapFactoryJson.abi)
    // console.log(interface)
    let factory = new ContractFactory(interface, AdaswapFactoryByteCode, accounts[0])
    factory = await factory.deploy(accounts[0].address)
    await factory.createPair(token0.address, token1.address)
    let ich = await factory.pairCodeHash()
    let codeHash = utils.keccak256(AdaswapPairJson.bytecode)
    expect(ich).to.eq(codeHash)
    const pairAddress = await factory.allPairs(0)
    const pair = new Contract(pairAddress, AdaswapPairJson.abi, accounts[0])
    // correct token0 and token1 in pair
    const token0Address = await pair.token0()
    if (token1.address == token0Address) {
      [token0, token1] = [token1, token0]
    }

    let weth = await ethers.getContractFactory("TestWETH")
    weth = await weth.deploy()
    router = await ethers.getContractFactory("AdaswapRouter02")
    router = await router.deploy(factory.address, weth.address)
  })

  it('quote', async () => {
    const quote1 = await router.quote(BigNumber.from(1), BigNumber.from(100), BigNumber.from(200))
    expect(quote1.toString()).to.eq('2')
    const quote2 = await router.quote(BigNumber.from(2), BigNumber.from(200), BigNumber.from(100))
    expect(quote2.toString()).to.eq('1')
    
    await expect(
      router.quote(BigNumber.from(0), BigNumber.from(100), BigNumber.from(200)))
        .to.be.revertedWith(
      'AdaswapLibrary: INSUFFICIENT_AMOUNT'
    )

    await expect(
      router.quote(BigNumber.from(1), BigNumber.from(0), BigNumber.from(200)))
        .to.be.revertedWith(
      'AdaswapLibrary: INSUFFICIENT_LIQUIDITY'
    )

    await expect(
      router.quote(BigNumber.from(1), BigNumber.from(100), BigNumber.from(0)))
        .to.be.revertedWith(
      'AdaswapLibrary: INSUFFICIENT_LIQUIDITY'
    )
  })

  it('getAmountOut', async () => {
    const amountOut = await router.getAmountOut(BigNumber.from(2), BigNumber.from(100), BigNumber.from(100))
    expect(amountOut.toString()).to.eq('1')

    await expect(
      router.getAmountOut(BigNumber.from(0), BigNumber.from(100), BigNumber.from(100)))
        .to.be.revertedWith(
      'AdaswapLibrary: INSUFFICIENT_INPUT_AMOUNT'
    )

    await expect(
      router.getAmountOut(BigNumber.from(2), BigNumber.from(0), BigNumber.from(100)))
        .to.be.revertedWith(
      'AdaswapLibrary: INSUFFICIENT_LIQUIDITY'
    )

    await expect(
      router.getAmountOut(BigNumber.from(2), BigNumber.from(100), BigNumber.from(0)))
        .to.be.revertedWith(
      'AdaswapLibrary: INSUFFICIENT_LIQUIDITY'
    )
  })

  it('getAmountIn', async () => {
    const amountIn = await router.getAmountIn(BigNumber.from(1), BigNumber.from(100), BigNumber.from(100))
    expect(amountIn.toString()).to.eq('2')

    await expect(
      router.getAmountIn(BigNumber.from(0), BigNumber.from(100), BigNumber.from(100)))
        .to.be.revertedWith(
      'AdaswapLibrary: INSUFFICIENT_OUTPUT_AMOUNT'
    )

    await expect(
      router.getAmountIn(BigNumber.from(1), BigNumber.from(0), BigNumber.from(100)))
        .to.be.revertedWith(
      'AdaswapLibrary: INSUFFICIENT_LIQUIDITY'
    )

    await expect(
      router.getAmountIn(BigNumber.from(1), BigNumber.from(100), BigNumber.from(0)))
        .to.be.revertedWith(
      'AdaswapLibrary: INSUFFICIENT_LIQUIDITY'
    )
  })

  it('getAmountsOut', async () => {
    await token0.approve(router.address, maxUint256)
    await token1.approve(router.address, maxUint256)
    await router.addLiquidity(
      token0.address,
      token1.address,
      BigNumber.from(10000),
      BigNumber.from(10000),
      0,
      0,
      accounts[0].address,
      maxUint256
    )

    await expect(
      router.getAmountsOut(BigNumber.from(2), [token0.address]))
        .to.be.revertedWith(
      'AdaswapLibrary: INVALID_PATH'
    )

    const path = [token0.address, token1.address]
    const amountsOut = await router.getAmountsOut(BigNumber.from(2), path)
    expect(amountsOut[0].toString()).to.eq('2')
    expect(amountsOut[1].toString()).to.eq('1')
  })

  it('getAmountsIn', async () => {
    await token0.approve(router.address, maxUint256)
    await token1.approve(router.address, maxUint256)
    await router.addLiquidity(
      token0.address,
      token1.address,
      BigNumber.from(10000),
      BigNumber.from(10000),
      0,
      0,
      accounts[0].address,
      maxUint256,
      
    )

    await expect(
      router.getAmountsIn(BigNumber.from(1), [token0.address]))
        .to.be.revertedWith(
      'AdaswapLibrary: INVALID_PATH'
    )
    const path = [token0.address, token1.address]
    const amountsIn = await router.getAmountsIn(BigNumber.from(1), path)
    expect(amountsIn[0].toString()).to.eq('2')
    expect(amountsIn[1].toString()).to.eq('1')
  })
})


describe('fee-on-transfer tokens', () => {

  let dtt, weth, router, pair
  let accounts = []
  beforeEach(async function () {
    
    weth = await TestWETH.new()
    dtt = await DeflatingERC20.new(expandTo18Decimals('10000'))
    const factory = await new eth.Contract(AdaswapFactoryInterface).deploy({ data: AdaswapFactoryByteCode, arguments: [accounts[0].address] }).send({ from: accounts[0].address, gas: 4710000 })
    await factory.methods.createPair(dtt.address, weth.address).send({ from: accounts[0].address, gas: 4710000 })
    let ich = await factory.methods.pairCodeHash().call()
    expect(ich).to.eq('0x2a3a9e0090eb58d4478aa215093c7ded7ee372eac924c25d729ad0f74cd31bf5')
    const pairAddress = await factory.methods.allPairs(0).call()
    pair = await IAdaswapPair.at(pairAddress)

    router = await AdaswapRouter02.new(factory._address, weth.address)
  })

  afterEach(async function () {
    const routerBalance = await eth.getBalance(router.address)
    expect(routerBalance.toString()).to.eq('0')
  })

  async function addLiquidity(DTTAmount, WETHAmount) {
    await dtt.approve(router.address, maxUint256)
    await router.addLiquidityETH(dtt.address, DTTAmount, DTTAmount, WETHAmount, accounts[0].address, maxUint256, {
      ...,
      value: WETHAmount
    })
  }

  it('removeLiquidityETHSupportingFeeOnTransferTokens', async () => {
//     const DTTAmount = expandTo18Decimals('1')
//     const ETHAmount = expandTo18Decimals('4')
//     await addLiquidity(DTTAmount, ETHAmount)

//     const DTTInPair = await dtt.balanceOf(pair.address)
//     const WETHInPair = await weth.balanceOf(pair.address)
//     const liquidity = await pair.balanceOf(accounts[0].address)
//     const totalSupply = await pair.totalSupply()
//     const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply)
//     const WETHExpected = WETHInPair.mul(liquidity).div(totalSupply)

//     await pair.approve(router.address, maxUint256)
//     await router.removeLiquidityETHSupportingFeeOnTransferTokens(
//       dtt.address,
//       liquidity,
//       NaiveDTTExpected,
//       WETHExpected,
//       accounts[0].address,
//       maxUint256,
      
//     )
//   })

//   it('removeLiquidityETHWithPermitSupportingFeeOnTransferTokens', async () => {

//     const DTTAmount = expandTo18Decimals('1')
//       .mul(BigNumber.from(100))
//       .div(BigNumber.from(99))
//     const ETHAmount = expandTo18Decimals('4')
//     addLiquidity
//     await addLiquidity(DTTAmount, ETHAmount)
//     const expectedLiquidity = expandTo18Decimals('2')

//     const deadline = maxUint256
//     const nonce = await pair.nonces(accounts[0].address)
//     const digest = await getApprovalDigest(
//       'Adaswap LP Token',
//       pair.address,
//       { owner: accounts[0].address, spender: router.address, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) },
//       nonce,
//       deadline
//     )
//     const { v, r, s } = ecsign(Buffer.from(digest.slice(2), 'hex'), Buffer.from('0x2bac0f8e27296e81289099a0229a0c2fa6d2da03501fd09c9937b10c464209e6'.slice(2), 'hex'))

//     const DTTInPair = await dtt.balanceOf(pair.address)
//     const WETHInPair = await weth.balanceOf(pair.address)
//     const liquidity = await pair.balanceOf(accounts[0].address)
//     const totalSupply = await pair.totalSupply()
//     const NaiveDTTExpected = DTTInPair.mul(liquidity).div(totalSupply)
//     const WETHExpected = WETHInPair.mul(liquidity).div(totalSupply)

//     await pair.approve(router.address, maxUint256)
//     await router.removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
//       dtt.address,
//       liquidity,
//       NaiveDTTExpected,
//       WETHExpected,
//       accounts[0].address,
//       maxUint256,
//       false,
//       v,
//       r,
//       s,
      
//     )
//   })

//   describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
//     const DTTAmount = expandTo18Decimals('5')
//       .mul(BigNumber.from(100))
//       .div(BigNumber.from(99))
//     const ETHAmount = expandTo18Decimals('10')
//     const amountIn = expandTo18Decimals('1')

//     beforeEach(async () => {
//       await addLiquidity(DTTAmount, ETHAmount)
//     })

//     it('DTT -> WETH', async () => {
//       await dtt.approve(router.address, maxUint256)

//       await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
//         amountIn,
//         0,
//         [dtt.address, weth.address],
//         accounts[0].address,
//         maxUint256,
        
//       )
//     })

//     // WETH -> DTT
//     it('WETH -> DTT', async () => {
//       await weth.deposit({ value: amountIn }) // mint WETH
//       await weth.approve(router.address, maxUint256)

//       await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
//         amountIn,
//         0,
//         [weth.address, dtt.address],
//         accounts[0].address,
//         maxUint256,
        
//       )
//     })
//   })

//   // ETH -> DTT
//   it('swapExactETHForTokensSupportingFeeOnTransferTokens', async () => {
//     const DTTAmount = expandTo18Decimals('10')
//       .mul(BigNumber.from(100))
//       .div(BigNumber.from(99))
//     const ETHAmount = expandTo18Decimals('5')
//     const swapAmount = expandTo18Decimals('1')
//     await addLiquidity(DTTAmount, ETHAmount)

//     await router.swapExactETHForTokensSupportingFeeOnTransferTokens(
//       0,
//       [weth.address, dtt.address],
//       accounts[0].address,
//       maxUint256,
//       {
//         ...,
//         value: swapAmount
//       }
//     )
//   })

//   // DTT -> ETH
//   it('swapExactTokensForETHSupportingFeeOnTransferTokens', async () => {
//     const DTTAmount = expandTo18Decimals('5')
//       .mul(BigNumber.from(100))
//       .div(BigNumber.from(99))
//     const ETHAmount = expandTo18Decimals('10')
//     const swapAmount = expandTo18Decimals('1')

//     await addLiquidity(DTTAmount, ETHAmount)
//     await dtt.approve(router.address, maxUint256)

//     await router.swapExactTokensForETHSupportingFeeOnTransferTokens(
//       swapAmount,
//       0,
//       [dtt.address, weth.address],
//       accounts[0].address,
//       maxUint256,
      
//     )
//   })
// })

// contract('fee-on-transfer tokens: reloaded', accounts => {
//   const  = {
//     gasLimit: 9999999,
//     from: accounts[0].address
//   }

//   let dtt, weth, dtt2, router, pair
//   beforeEach(async function () {
//     weth = await TestWETH.new()
//     dtt = await DeflatingERC20.new(expandTo18Decimals('10000'))
//     dtt2 = await DeflatingERC20.new(expandTo18Decimals('10000'))
//     const factory = await new eth.Contract(AdaswapFactoryInterface).deploy({ data: AdaswapFactoryByteCode, arguments: [accounts[0].address] }).send({ from: accounts[0].address, gas: 4710000 })
//     await factory.methods.createPair(dtt.address, dtt2.address).send({ from: accounts[0].address, gas: 4710000 })
//     let ich = await factory.methods.pairCodeHash().call()
//     expect(ich).to.eq('0x2a3a9e0090eb58d4478aa215093c7ded7ee372eac924c25d729ad0f74cd31bf5')
//     const pairAddress = await factory.methods.allPairs(0).call()
//     pair = await IAdaswapPair.at(pairAddress)

//     router = await AdaswapRouter02.new(factory._address, weth.address)
//   })

//   afterEach(async function () {
//     const routerBalance = await eth.getBalance(router.address)
//     expect(routerBalance.toString()).to.eq('0')
//   })

//   async function addLiquidity(DTTAmount, DTT2Amount) {
//     await dtt.approve(router.address, maxUint256)
//     await dtt2.approve(router.address, maxUint256)
//     await router.addLiquidity(
//       dtt.address,
//       dtt2.address,
//       DTTAmount,
//       DTT2Amount,
//       DTTAmount,
//       DTT2Amount,
//       accounts[0].address,
//       maxUint256,
      
//     )
//   }

//   describe('swapExactTokensForTokensSupportingFeeOnTransferTokens', () => {
//     const DTTAmount = expandTo18Decimals('5')
//       .mul(BigNumber.from(100))
//       .div(BigNumber.from(99))
//     const DTT2Amount = expandTo18Decimals('5')
//     const amountIn = expandTo18Decimals('1')

//     beforeEach(async () => {
//       await addLiquidity(DTTAmount, DTT2Amount)
//     })

//     it('DTT -> DTT2', async () => {
//       await dtt.approve(router.address, maxUint256)

//       await router.swapExactTokensForTokensSupportingFeeOnTransferTokens(
//         amountIn,
//         0,
//         [dtt.address, dtt2.address],
//         accounts[0].address,
//         maxUint256,
        
//       )
//     })
  })
})