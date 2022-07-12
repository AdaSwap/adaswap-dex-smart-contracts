const { solidity } = require("ethereum-waffle");
const {
  use,
  expect
} = require('chai')
const {
  addressZero,
  expandTo18Decimals,
  mineBlock,
  encodePrice
} = require('./shared/utils')

const { ethers } = require("hardhat");
const { BigNumber, utils } = require("ethers");
use(solidity)

const MINIMUM_LIQUIDITY = BigNumber.from(10).pow(BigNumber.from(3))
const TOKEN0_TOTAL_SUPPLY = expandTo18Decimals('2000')
const TOKEN1_TOTAL_SUPPLY = expandTo18Decimals('8000')

// const  = {
//   gas: 999999,
//   from: accounts[0].address
// }

describe('AdaswapPair', () => {
  let accounts = []
  
  let factory, pair, token0, token1, provider
  beforeEach(async () => {
    accounts = await ethers.getSigners();
    let TokenFactory = await ethers.getContractFactory("TestERC20")
    token0 = await TokenFactory.deploy('Token 0', 'TK0', TOKEN0_TOTAL_SUPPLY)
    token1 = await TokenFactory.deploy('Token 1', 'TK1', TOKEN1_TOTAL_SUPPLY)
    factory = await ethers.getContractFactory("AdaswapFactory")
    factory = await factory.deploy(accounts[0].address)
    await factory.createPair(token0.address, token1.address)
    const pairAddress = await factory.allPairs(0)
    pair = await ethers.getContractFactory("AdaswapPair")
    pair = await pair.attach(pairAddress)
    // correct token0 and token1 in pair
    const token0Address = await pair.token0()
    if (token1.address == token0Address) {
      [token0, token1] = [token1, token0]
    }
  })

  it('mint', async () => {
    const token0Amount = expandTo18Decimals('1')
    const token1Amount = expandTo18Decimals('4')
    await token0.transfer(pair.address, token0Amount)
    await token1.transfer(pair.address, token1Amount)

    const expectedLiquidity = expandTo18Decimals('2')
    expect(await pair.mint(accounts[0].address))
      .to.emit(pair, 'Transfer').withArgs(addressZero, addressZero, MINIMUM_LIQUIDITY)
      .to.emit(pair, 'Transfer').withArgs(addressZero, accounts[0].address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
      .to.emit(pair, 'Sync').withArgs(token0Amount, token1Amount)
      .to.emit(pair, 'Mint').withArgs(accounts[0].address, token0Amount, token1Amount)
      // .to.emit('Sync', { reserve0: token0Amount, reserve1: token1Amount })
      // .to.emit('Mint', { sender: accounts[0].address, amount0: token0Amount, amount1: token1Amount })

    expect((await pair.totalSupply())).to.eq(expectedLiquidity)
    expect((await pair.balanceOf(accounts[0].address))).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    expect((await token0.balanceOf(pair.address))).to.eq(token0Amount)
    expect((await token1.balanceOf(pair.address))).to.eq(token1Amount)
    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount)
    expect(reserves[1]).to.eq(token1Amount)
  })

  async function addLiquidity(token0Amount, token1Amount) {
    await token0.transfer(pair.address, token0Amount)
    await token1.transfer(pair.address, token1Amount)
    await pair.mint(accounts[0].address)
  }

  const swapTestCases = [
    [1, 5, 10, '1662497915624478906'],
    [1, 10, 5, '453305446940074565'],

    [2, 5, 10, '2851015155847869602'],
    [2, 10, 5, '831248957812239453'],

    [1, 10, 10, '906610893880149131'],
    [1, 100, 100, '987158034397061298'],
    [1, 1000, 1000, '996006981039903216']
  ].map(a => a.map(n => (typeof n === 'string' ? BigNumber.from(n) : expandTo18Decimals(n.toString()))))

  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, async () => {
      const [swapAmount, token0Amount, token1Amount, expectedOutputAmount] = swapTestCase
      await addLiquidity(token0Amount, token1Amount)
      await token0.transfer(pair.address, swapAmount)

      await expect(
        pair.swap(0, expectedOutputAmount.add(BigNumber.from(1)), accounts[0].address, '0x')).
          to.be.revertedWith("Adaswap: K")
      await pair.swap(0, expectedOutputAmount, accounts[0].address, '0x')
    })
  })

  it('swap:token0', async () => {
    const token0Amount = expandTo18Decimals('5')
    const token1Amount = expandTo18Decimals('10')
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals('1')
    const expectedOutputAmount = BigNumber.from('1662497915624478906')
    await token0.transfer(pair.address, swapAmount)
    expect(await pair.swap(0, expectedOutputAmount, accounts[0].address, '0x', ))

    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount.add(swapAmount))
    expect(reserves[1]).to.eq(token1Amount.sub(expectedOutputAmount))
    const pairToken0Balance = await token0.balanceOf(pair.address)
    const pairToken1Balance = await token1.balanceOf(pair.address)
    expect(pairToken0Balance).to.eq(token0Amount.add(swapAmount))
    expect(pairToken1Balance).to.eq(token1Amount.sub(expectedOutputAmount))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    const token0Balance = await token0.balanceOf(accounts[0].address)
    const token1Balance = await token1.balanceOf(accounts[0].address)
    expect(token0Balance).to.eq(totalSupplyToken0.sub(token0Amount).sub(swapAmount))
    expect(token1Balance).to.eq(totalSupplyToken1.sub(token1Amount).add(expectedOutputAmount))
  })

  it('swap:token1', async () => {
    const token0Amount = expandTo18Decimals('5')
    const token1Amount = expandTo18Decimals('10')
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals('1')
    const expectedOutputAmount = BigNumber.from('453305446940074565')
    await token1.transfer(pair.address, swapAmount)
    expect(await pair.swap(expectedOutputAmount, 0, accounts[0].address, '0x'))
    const reserves = await pair.getReserves()
    expect(reserves[0]).to.eq(token0Amount.sub(expectedOutputAmount))
    expect(reserves[1]).to.eq(token1Amount.add(swapAmount))
    const pairToken0Balance = await token0.balanceOf(pair.address)
    const pairToken1Balance = await token1.balanceOf(pair.address)
    expect(pairToken0Balance).to.eq(token0Amount.sub(expectedOutputAmount))
    expect(pairToken1Balance).to.eq(token1Amount.add(swapAmount))
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    const token0Balance = await token0.balanceOf(accounts[0].address)
    const token1Balance = await token1.balanceOf(accounts[0].address)
    expect(token0Balance).to.eq(totalSupplyToken0.sub(token0Amount).add(expectedOutputAmount))
    expect(token1Balance).to.eq(totalSupplyToken1.sub(token1Amount).sub(swapAmount))
  })

  it('swap:gas', async () => {
    provider = await ethers.provider
    const token0Amount = expandTo18Decimals('5')
    const token1Amount = expandTo18Decimals('10')
    await addLiquidity(token0Amount, token1Amount)

    // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
    await mineBlock((await provider.getBlock(await provider.getBlockNumber())).timestamp + 1)
    await pair.sync()

    const swapAmount = expandTo18Decimals('1')
    const expectedOutputAmount = BigNumber.from('453305446940074565')
    await token1.transfer(pair.address, swapAmount)
    await mineBlock((await provider.getBlock(await provider.getBlockNumber())).timestamp + 1)
    const tx = await pair.swap(expectedOutputAmount, 0, accounts[0].address, '0x')

    const receipt = await tx.wait();
    expect(receipt.gasUsed).to.eq(74232)
  })

  it('burn', async () => {
    const token0Amount = expandTo18Decimals('3')
    const token1Amount = expandTo18Decimals('3')
    await addLiquidity(token0Amount, token1Amount)

    const expectedLiquidity = expandTo18Decimals('3')
    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    expect(await pair.burn(accounts[0].address))
      .to.emit(pair, 'Transfer').withArgs(
        pair.address, 
        addressZero, 
        expectedLiquidity.sub(MINIMUM_LIQUIDITY)
      )
      .to.emit(pair, 'Transfer').withArgs(
        pair.address, 
        addressZero, 
        token0Amount.sub(BigNumber.from(1000))
      )
      .to.emit(pair, 'Sync').withArgs(
        BigNumber.from(1000), 
        BigNumber.from(1000) 
      )
      .to.emit(pair, 'Burn').withArgs(
        accounts[0].address, 
        token0Amount.sub(BigNumber.from(1000)), 
        token1Amount.sub(BigNumber.from(1000)),
        accounts[0].address
      )
    const balanceLP = await pair.balanceOf(accounts[0].address)
    expect(balanceLP).to.eq('0')
    const totalSupplyLP = await pair.totalSupply()
    expect(totalSupplyLP).to.eq(MINIMUM_LIQUIDITY)
    const pairBalance0 = await token0.balanceOf(pair.address)
    const pairBalance1 = await token1.balanceOf(pair.address)
    expect(pairBalance0).to.eq('1000')
    expect(pairBalance1).to.eq('1000')
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    const balance0 = await token0.balanceOf(accounts[0].address)
    const balance1 = await token1.balanceOf(accounts[0].address)
    expect(balance0).to.eq(totalSupplyToken0.sub(BigNumber.from(1000)))
    expect(balance1).to.eq(totalSupplyToken1.sub(BigNumber.from(1000)))
  })

  // here is added extra multiplication when is calculated priceCumulativeLast, 
  // because of our local blockchain block mine: there is added +1 to block timestamp
  it('price{0,1}CumulativeLast', async () => {
    const token0Amount = expandTo18Decimals('3')
    const token1Amount = expandTo18Decimals('3')
    await addLiquidity(token0Amount, token1Amount)

    const blockTimestamp = (await pair.getReserves())[2]
    await mineBlock(blockTimestamp + 1)
    await pair.sync()
    const initialPrice = encodePrice(token0Amount, token1Amount)
    expect((await pair.price0CumulativeLast())).to.eq(initialPrice[1].mul(2))
    expect((await pair.price1CumulativeLast())).to.eq(initialPrice[1].mul(2))
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 2)

    const swapAmount = expandTo18Decimals('3')
    await token0.transfer(pair.address, swapAmount)
    await mineBlock(blockTimestamp + 10)
    // swap to a new price eagerly instead of syncing
    await pair.swap(0, expandTo18Decimals('1'), accounts[0].address, '0x') // make the price nice

    expect((await pair.price0CumulativeLast())).to.eq(initialPrice[0].mul(BigNumber.from(11)))
    expect((await pair.price1CumulativeLast())).to.eq(initialPrice[1].mul(BigNumber.from(11)))
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 11)

    await mineBlock(blockTimestamp + 20)
    await pair.sync()

    const newPrice = encodePrice(expandTo18Decimals('6'), expandTo18Decimals('2'))
    expect((await pair.price0CumulativeLast())).to.eq(initialPrice[0].mul(BigNumber.from(11)).add(newPrice[0].mul(BigNumber.from(10))))
    expect((await pair.price1CumulativeLast())).to.eq(initialPrice[1].mul(BigNumber.from(11)).add(newPrice[1].mul(BigNumber.from(10))))
    expect((await pair.getReserves())[2]).to.eq(blockTimestamp + 21)
  })

  it('feeTo:off', async () => {
    const token0Amount = expandTo18Decimals('1000')
    const token1Amount = expandTo18Decimals('1000')
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals('1')
    const expectedOutputAmount = BigNumber.from('996006981039903216')
    await token1.transfer(pair.address, swapAmount)
    await pair.swap(expectedOutputAmount, 0, accounts[0].address, '0x')

    const expectedLiquidity = expandTo18Decimals('1000')
    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pair.burn(accounts[0].address)
    expect((await pair.totalSupply())).to.eq(MINIMUM_LIQUIDITY)
  })

  it('feeTo:on', async () => {
    await factory.setFeeTo(accounts[1].address)

    const token0Amount = expandTo18Decimals('1000')
    const token1Amount = expandTo18Decimals('1000')
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals('1')
    const expectedOutputAmount = BigNumber.from('996006981039903216')
    await token1.transfer(pair.address, swapAmount)
    await pair.swap(expectedOutputAmount, 0, accounts[0].address, '0x')

    const expectedLiquidity = expandTo18Decimals('1000')
    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pair.burn(accounts[0].address)
    expect((await pair.totalSupply())).to.eq(MINIMUM_LIQUIDITY.add(BigNumber.from('249750499251388')))
    expect((await pair.balanceOf(accounts[1].address))).to.eq('249750499251388')

    // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
    // ...because the initial liquidity amounts were equal
    expect((await token0.balanceOf(pair.address))).to.eq(BigNumber.from(1000).add(BigNumber.from('249501683697445')))
    expect((await token1.balanceOf(pair.address))).to.eq(BigNumber.from(1000).add(BigNumber.from('250000187312969')))
  })
})
