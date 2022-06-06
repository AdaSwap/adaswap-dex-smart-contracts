const AdaswapFactory = artifacts.require('AdaswapFactory')
const solidity = require('./shared/solidity')
const AdaswapPair = require('../build/contracts/AdaswapPair.json')
const {
  use,
  expect
} = require('chai')
const {
  addressZero,
  getCreate2Address
} = require('./shared/utils')

const { utils, eth } = web3
use(solidity)

const TEST_ADDRESSES = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000'
]

contract('AdaswapFactory', accounts => {
  let factory
  beforeEach(async () => {
    factory = await AdaswapFactory.new(accounts[0])
  })

  it('feeTo, feeToSetter, allPairsLength', async () => {
    expect(await factory.feeTo()).to.eq(addressZero)
    expect(await factory.feeToSetter()).to.eq(accounts[0])
    expect((await factory.allPairsLength()).toNumber()).to.eq(0)
  })

  async function createPair(tokens) {
    const bytecode = AdaswapPair.bytecode
    const create2Address = getCreate2Address(factory.address, tokens, bytecode)
    const tx = await factory.createPair(...tokens)
    expect(tx)
      .to.emit('PairCreated', { token0: TEST_ADDRESSES[0], token1: TEST_ADDRESSES[1], pair: create2Address, '3': utils.toBN(1) }, { address: ["pair"] })

    let err
    try {
      await factory.createPair(...tokens)
    } catch (ex) {
      err = ex
    }
    expect(err).to.revertedWith("Adaswap: PAIR_EXISTS")

    let err1
    try {
      await factory.createPair(...tokens.slice().reverse())
    } catch (ex) {
      err1 = ex
    }
    expect(err1).to.revertedWith("Adaswap: PAIR_EXISTS")

    expect((await factory.getPair(...tokens)).toLowerCase()).to.eq(create2Address)
    expect((await factory.getPair(...tokens.slice().reverse())).toLowerCase()).to.eq(create2Address)
    expect((await factory.allPairs(0)).toLowerCase()).to.eq(create2Address)
    expect((await factory.allPairsLength()).toNumber()).to.eq(1)

    const pair = new eth.Contract(AdaswapPair.abi, create2Address);
    expect(await pair.methods.factory().call()).to.eq(factory.address)
    expect(await pair.methods.token0().call()).to.eq(TEST_ADDRESSES[0])
    expect(await pair.methods.token1().call()).to.eq(TEST_ADDRESSES[1])
  }

  it('createPair', async () => {
    await createPair(TEST_ADDRESSES)
  })

  it('createPair:reverse', async () => {
    await createPair(TEST_ADDRESSES.slice().reverse())
  })

  it('createPair:gas', async () => {
    const tx = await factory.createPair(...TEST_ADDRESSES)
    expect(tx.receipt.gasUsed).to.eq(3558703)
  })

  it('setFeeTo', async () => {
    let err
    try {
      await factory.setFeeTo(accounts[1], {from: accounts[1]})
    } catch (ex) {
      err = ex
    }
    expect(err).to.revertedWith('Adaswap: FORBIDDEN')
    await factory.setFeeTo(accounts[0])
    expect(await factory.feeTo()).to.eq(accounts[0])
  })

  it('setFeeToSetter', async () => {
    let err, err1
    try {
      await factory.setFeeToSetter(accounts[1], {from: accounts[1]})
    } catch (ex) {
      err = ex
    }
    expect(err).to.revertedWith('Adaswap: FORBIDDEN')
    await factory.setFeeToSetter(accounts[1])
    expect(await factory.feeToSetter()).to.eq(accounts[1])
    try {
      await factory.setFeeToSetter(accounts[0])
    } catch (ex) {
      err1 = ex
    }
    expect(err1).to.revertedWith('Adaswap: FORBIDDEN')
  })
})