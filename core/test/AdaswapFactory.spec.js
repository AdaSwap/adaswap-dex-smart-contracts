const { solidity } = require("ethereum-waffle");
const {
  use,
  expect
} = require('chai')
const {
  addressZero,
  getCreate2Address
} = require('./shared/utils')

const { ethers, provider } = require("hardhat");
const { BigNumber, Wallet, utils, Contract } = require("ethers");
const exp = require("constants");
use(solidity)

const TEST_ADDRESSES = [
  '0x1000000000000000000000000000000000000000',
  '0x2000000000000000000000000000000000000000'
]

describe('AdaswapFactory', () => {
    let accounts = []
    let factory
    beforeEach(async () => {
        accounts = await ethers.getSigners();
        factory = await ethers.getContractFactory("AdaswapFactory")
        factory = await factory.deploy(accounts[0].address)
    })

    it('feeTo, feeToSetter, allPairsLength', async () => {
        expect(await factory.feeTo()).to.eq(addressZero)
        expect(await factory.feeToSetter()).to.eq(accounts[0].address)
        expect((await factory.allPairsLength()).toNumber()).to.eq(0)
    })

    async function createPair(tokens) {
        const { abi } = require('../artifacts/contracts/AdaswapPair.sol/AdaswapPair.json')
        let pairFactory = await ethers.getContractFactory("AdaswapPair")
        let bytecode = pairFactory.bytecode
        
        const create2Address = getCreate2Address(factory.address, tokens, bytecode)
        expect(await factory.createPair(...tokens))
            .to.emit(factory, 'PairCreated').withArgs(
                TEST_ADDRESSES[0], 
                TEST_ADDRESSES[1], 
                utils.getAddress(create2Address), 
                1
            )

        await expect(factory.createPair(...tokens))
            .to.be.revertedWith("Adaswap: PAIR_EXISTS")

        await expect(factory.createPair(...tokens.slice().reverse()))
            .to.be.revertedWith("Adaswap: PAIR_EXISTS")

        expect((await factory.getPair(...tokens)).toLowerCase()).to.eq(create2Address)
        expect((await factory.getPair(...tokens.slice().reverse())).toLowerCase()).to.eq(create2Address)
        expect((await factory.allPairs(0)).toLowerCase()).to.eq(create2Address)
        expect((await factory.allPairsLength()).toNumber()).to.eq(1)

        const pair = new Contract(create2Address, abi, accounts[0]);
        expect(await pair.factory()).to.eq(factory.address)
        expect(await pair.token0()).to.eq(TEST_ADDRESSES[0])
        expect(await pair.token1()).to.eq(TEST_ADDRESSES[1])
    }

    it('createPair', async () => {
        await createPair(TEST_ADDRESSES)
    })

    it('createPair:reverse', async () => {
        await createPair(TEST_ADDRESSES.slice().reverse())
    })

    it('createPair:gas', async () => {
        const tx = await factory.createPair(...TEST_ADDRESSES)
        const receipt = await tx.wait();
        expect(receipt.gasUsed).to.eq(2513197)
    })

    it('setFeeTo', async () => {
        
        await expect(
            factory.connect(accounts[1]).setFeeTo(accounts[1].address)
        ).to.be.revertedWith('Adaswap: FORBIDDEN')
        await factory.setFeeTo(accounts[0].address)
        expect(await factory.feeTo()).to.eq(accounts[0].address)
    })

    it('setFeeToSetter', async () => {
        await expect(
            factory.connect(accounts[1]).setFeeToSetter(accounts[1].address)
        ).to.be.revertedWith('Adaswap: FORBIDDEN')
        await factory.setFeeToSetter(accounts[1].address)
        expect(await factory.feeToSetter()).to.eq(accounts[1].address)
        await expect(
            factory.setFeeToSetter(accounts[1].address)
        ).to.be.revertedWith('Adaswap: FORBIDDEN')
    })

    it('pairCodeHash', async () => {
        let pairFactory = await ethers.getContractFactory("AdaswapPair")
        let bytecode = pairFactory.bytecode
        const pairInitialCodeHash = await factory.pairCodeHash()
        expect(pairInitialCodeHash).to.eq(utils.keccak256(bytecode))
    })
})