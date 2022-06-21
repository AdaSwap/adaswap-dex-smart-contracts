const AdaswapFactory = artifacts.require('AdaswapFactory')
const AdaswapPair = artifacts.require('AdaswapPair')
const TestERC20 = artifacts.require('test/TestERC20')
const solidity = require('./shared/solidity')
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

const { utils, eth } = web3
use(solidity)

const MINIMUM_LIQUIDITY = utils.toBN(10).pow(utils.toBN(3))
const TOKEN0_TOTAL_SUPPLY = expandTo18Decimals(2000)
const TOKEN1_TOTAL_SUPPLY = expandTo18Decimals(8000)

contract('AdaswapPair', accounts => {
  const overrides = {
    gas: 999999,
    from: accounts[0]
  }
  let factory, pair, token0, token1
  beforeEach(async () => {
    token0 = await TestERC20.new('Token 0', 'TK0', TOKEN0_TOTAL_SUPPLY)
    token1 = await TestERC20.new('Token 1', 'TK1', TOKEN1_TOTAL_SUPPLY)
    factory = await AdaswapFactory.new(accounts[0])
    await factory.createPair(token0.address, token1.address)
    const pairAddress = await factory.allPairs(0)
    pair = await AdaswapPair.at(pairAddress)
    // correct token0 and token1 in pair
    const token0Address = await pair.token0()
    if (token1.address == token0Address) {
      [token0, token1] = [token1, token0]
    }
  })

  it('mint', async () => {
    const token0Amount = expandTo18Decimals(1)
    const token1Amount = expandTo18Decimals(4)
    await token0.transfer(pair.address, token0Amount)
    await token1.transfer(pair.address, token1Amount)

    const expectedLiquidity = expandTo18Decimals(2)
    const tx = await pair.mint(accounts[0])
    expect(tx)
      .to.emit('Transfer', { from: addressZero, to: addressZero, value: MINIMUM_LIQUIDITY })
      .to.emit('Transfer', { from: addressZero, to: accounts[0], value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) })
      .to.emit('Sync', { reserve0: token0Amount, reserve1: token1Amount })
      .to.emit('Mint', { sender: accounts[0], amount0: token0Amount, amount1: token1Amount })

    expect((await pair.totalSupply()).toString()).to.eq(expectedLiquidity.toString())
    expect((await pair.balanceOf(accounts[0])).toString()).to.eq(expectedLiquidity.sub(MINIMUM_LIQUIDITY).toString())
    expect((await token0.balanceOf(pair.address)).toString()).to.eq(token0Amount.toString())
    expect((await token1.balanceOf(pair.address)).toString()).to.eq(token1Amount.toString())
    const reserves = await pair.getReserves()
    expect(reserves[0].toString()).to.eq(token0Amount.toString())
    expect(reserves[1].toString()).to.eq(token1Amount.toString())
  })

  async function addLiquidity(token0Amount, token1Amount) {
    await token0.transfer(pair.address, token0Amount)
    await token1.transfer(pair.address, token1Amount)
    await pair.mint(accounts[0])
  }

  const swapTestCases = [
    [1, 5, 10, '1662497915624478906'],
    [1, 10, 5, '453305446940074565'],

    [2, 5, 10, '2851015155847869602'],
    [2, 10, 5, '831248957812239453'],

    [1, 10, 10, '906610893880149131'],
    [1, 100, 100, '987158034397061298'],
    [1, 1000, 1000, '996006981039903216']
  ].map(a => a.map(n => (typeof n === 'string' ? utils.toBN(n) : expandTo18Decimals(n))))

  swapTestCases.forEach((swapTestCase, i) => {
    it(`getInputPrice:${i}`, async () => {
      const [swapAmount, token0Amount, token1Amount, expectedOutputAmount] = swapTestCase
      await addLiquidity(token0Amount, token1Amount)
      await token0.transfer(pair.address, swapAmount)
      let err
      try {
        await pair.swap(0, expectedOutputAmount.add(utils.toBN(1)), accounts[0], '0x', overrides)
      } catch (ex) {
        err = ex
      }
      expect(err).to.revertedWith("Adaswap: K")
      await pair.swap(0, expectedOutputAmount, accounts[0], '0x', overrides)
    })
  })

  it('swap:token0', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = utils.toBN('1662497915624478906')
    await token0.transfer(pair.address, swapAmount)
    const tx = await pair.swap(0, expectedOutputAmount, accounts[0], '0x', overrides)
    expect(tx)
      .to.emit('Transfer', { from: pair.address, to: accounts[0], value: expectedOutputAmount })
      .to.emit('Sync', { reserve0: token0Amount.add(swapAmount), reserve1: token1Amount.sub(expectedOutputAmount) })
      .to.emit('Swap', { sender: accounts[0], amount0In: swapAmount, amount1In: 0, amount0Out: 0, amount1Out: expectedOutputAmount, to: accounts[0] })

    const reserves = await pair.getReserves()
    expect(reserves[0].toString()).to.eq(token0Amount.add(swapAmount).toString())
    expect(reserves[1].toString()).to.eq(token1Amount.sub(expectedOutputAmount).toString())
    const pairToken0Balance = await token0.balanceOf(pair.address)
    const pairToken1Balance = await token1.balanceOf(pair.address)
    expect(pairToken0Balance.toString()).to.eq(token0Amount.add(swapAmount).toString())
    expect(pairToken1Balance.toString()).to.eq(token1Amount.sub(expectedOutputAmount).toString())
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    const token0Balance = await token0.balanceOf(accounts[0])
    const token1Balance = await token1.balanceOf(accounts[0])
    expect(token0Balance.toString()).to.eq(totalSupplyToken0.sub(token0Amount).sub(swapAmount).toString())
    expect(token1Balance.toString()).to.eq(totalSupplyToken1.sub(token1Amount).add(expectedOutputAmount).toString())
  })

  it('swap:token1', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = utils.toBN('453305446940074565')
    await token1.transfer(pair.address, swapAmount)
    const tx = await pair.swap(expectedOutputAmount, 0, accounts[0], '0x', overrides)
    expect(tx)
      .to.emit('Transfer', { from: pair.address, to: accounts[0], value: expectedOutputAmount })
      .to.emit('Sync', { reserve0: token0Amount.sub(expectedOutputAmount), reserve1: token1Amount.add(swapAmount) })
      .to.emit('Swap', { sender: accounts[0], amount0In: 0, amount1In: swapAmount, amount0Out: expectedOutputAmount, amount1Out: 0, to: accounts[0] })

    const reserves = await pair.getReserves()
    expect(reserves[0].toString()).to.eq(token0Amount.sub(expectedOutputAmount).toString())
    expect(reserves[1].toString()).to.eq(token1Amount.add(swapAmount).toString())
    const pairToken0Balance = await token0.balanceOf(pair.address)
    const pairToken1Balance = await token1.balanceOf(pair.address)
    expect(pairToken0Balance.toString()).to.eq(token0Amount.sub(expectedOutputAmount).toString())
    expect(pairToken1Balance.toString()).to.eq(token1Amount.add(swapAmount).toString())
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    const token0Balance = await token0.balanceOf(accounts[0])
    const token1Balance = await token1.balanceOf(accounts[0])
    expect(token0Balance.toString()).to.eq(totalSupplyToken0.sub(token0Amount).add(expectedOutputAmount).toString())
    expect(token1Balance.toString()).to.eq(totalSupplyToken1.sub(token1Amount).sub(swapAmount).toString())
  })

  it('swap:gas', async () => {
    const token0Amount = expandTo18Decimals(5)
    const token1Amount = expandTo18Decimals(10)
    await addLiquidity(token0Amount, token1Amount)

    // ensure that setting price{0,1}CumulativeLast for the first time doesn't affect our gas math
    await mineBlock((await eth.getBlock('latest')).timestamp + 1)
    await pair.sync(overrides)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = utils.toBN('453305446940074565')
    await token1.transfer(pair.address, swapAmount)
    await mineBlock((await eth.getBlock('latest')).timestamp + 1)
    const tx = await pair.swap(expectedOutputAmount, 0, accounts[0], '0x')
    const receipt = tx.receipt
    expect(receipt.gasUsed).to.eq(75766)
  })

  it('burn', async () => {
    const token0Amount = expandTo18Decimals(3)
    const token1Amount = expandTo18Decimals(3)
    await addLiquidity(token0Amount, token1Amount)

    const expectedLiquidity = expandTo18Decimals(3)
    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    const tx = await pair.burn(accounts[0])
    expect(tx)
      .to.emit('Transfer', { from: pair.address, to: addressZero, value: expectedLiquidity.sub(MINIMUM_LIQUIDITY) })
      .to.emit('Transfer', { from: pair.address, to: accounts[0], value: token0Amount.sub(utils.toBN(1000)) })
      .to.emit('Transfer', { from: pair.address, to: accounts[0], value: token0Amount.sub(utils.toBN(1000)) })
      .to.emit('Sync', { reserve0: utils.toBN(1000), reserve1: utils.toBN(1000) })
      .to.emit('Burn', { sender: accounts[0], amount0: token0Amount.sub(utils.toBN(1000)), amount1: token1Amount.sub(utils.toBN(1000)), to: accounts[0] })

    const balanceLP = await pair.balanceOf(accounts[0])
    expect(balanceLP.toString()).to.eq('0')
    const totalSupplyLP = await pair.totalSupply()
    expect(totalSupplyLP.toString()).to.eq(MINIMUM_LIQUIDITY.toString())
    const pairBalance0 = await token0.balanceOf(pair.address)
    const pairBalance1 = await token1.balanceOf(pair.address)
    expect(pairBalance0.toString()).to.eq('1000')
    expect(pairBalance1.toString()).to.eq('1000')
    const totalSupplyToken0 = await token0.totalSupply()
    const totalSupplyToken1 = await token1.totalSupply()
    const balance0 = await token0.balanceOf(accounts[0])
    const balance1 = await token1.balanceOf(accounts[0])
    expect(balance0.toString()).to.eq(totalSupplyToken0.sub(utils.toBN(1000)).toString())
    expect(balance1.toString()).to.eq(totalSupplyToken1.sub(utils.toBN(1000)).toString())
  })

  // @todo fix ganache issue
  // it('price{0,1}CumulativeLast', async () => {
    // const token0Amount = expandTo18Decimals(3)
    // const token1Amount = expandTo18Decimals(3)
    // await addLiquidity(token0Amount, token1Amount)

    // const rsv = await pair.getReserves()
    // const blockTimestamp = rsv[2]
    // await mineBlock(blockTimestamp.toNumber() + 1)
    // await pair.sync(overrides)

    // const initialPrice = encodePrice(token0Amount, token1Amount)
    // expect((await pair.price0CumulativeLast()).toString()).to.eq(initialPrice[0].toString())
    // expect((await pair.price1CumulativeLast()).toString()).to.eq(initialPrice[1].toString())
    // expect((await pair.getReserves())[2].toNumber()).to.eq(blockTimestamp.toNumber() + 1)

    // const swapAmount = expandTo18Decimals(3)
    // await token0.transfer(pair.address, swapAmount)
    // await mineBlock(blockTimestamp.add(utils.toBN(10)).toString())
    // // swap to a new price eagerly instead of syncing
    // await pair.swap(0, expandTo18Decimals(1), accounts[0], '0x') // make the price nice

    // expect((await pair.price0CumulativeLast()).toString()).to.eq(initialPrice[0].mul(utils.toBN(10)).toString())
    // expect((await pair.price1CumulativeLast()).toString()).to.eq(initialPrice[1].mul(utils.toBN(10)).toString())
    // expect((await pair.getReserves())[2].toString()).to.eq(blockTimestamp.add(utils.toBN(10)).toString())

    // await mineBlock(blockTimestamp.add(utils.toBN(20)).toString())
    // await pair.sync(overrides)

    // const newPrice = encodePrice(expandTo18Decimals(6), expandTo18Decimals(2))
    // expect((await pair.price0CumulativeLast()).toString()).to.eq(initialPrice[0].mul(utils.toBN(10)).add(newPrice[0].mul(utils.toBN(10))).toString())
    // expect((await pair.price1CumulativeLast()).toString()).to.eq(initialPrice[1].mul(utils.toBN(10)).add(newPrice[1].mul(utils.toBN(10))).toString())
    // expect((await pair.getReserves())[2].toString()).to.eq(blockTimestamp.add(utils.toBN(20)).toString())
  // })

  it('feeTo:off', async () => {
    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = utils.toBN('996006981039903216')
    await token1.transfer(pair.address, swapAmount)
    await pair.swap(expectedOutputAmount, 0, accounts[0], '0x')

    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pair.burn(accounts[0])
    expect((await pair.totalSupply()).toString()).to.eq(MINIMUM_LIQUIDITY.toString())
  })

  it('feeTo:on', async () => {
    await factory.setFeeTo(accounts[1])

    const token0Amount = expandTo18Decimals(1000)
    const token1Amount = expandTo18Decimals(1000)
    await addLiquidity(token0Amount, token1Amount)

    const swapAmount = expandTo18Decimals(1)
    const expectedOutputAmount = utils.toBN('996006981039903216')
    await token1.transfer(pair.address, swapAmount)
    await pair.swap(expectedOutputAmount, 0, accounts[0], '0x')

    const expectedLiquidity = expandTo18Decimals(1000)
    await pair.transfer(pair.address, expectedLiquidity.sub(MINIMUM_LIQUIDITY))
    await pair.burn(accounts[0])
    expect((await pair.totalSupply()).toString()).to.eq(MINIMUM_LIQUIDITY.add(utils.toBN('249750499251388')).toString())
    expect((await pair.balanceOf(accounts[1])).toString()).to.eq('249750499251388')

    // using 1000 here instead of the symbolic MINIMUM_LIQUIDITY because the amounts only happen to be equal...
    // ...because the initial liquidity amounts were equal
    expect((await token0.balanceOf(pair.address)).toString()).to.eq(utils.toBN(1000).add(utils.toBN('249501683697445')).toString())
    expect((await token1.balanceOf(pair.address)).toString()).to.eq(utils.toBN(1000).add(utils.toBN('250000187312969')).toString())
  })
})
