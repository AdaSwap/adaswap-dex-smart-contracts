const { expect, assert } = require("chai");
const { advanceBlock, advanceBlockTo, advanceNextBlockTime, prepare, deploy, getBigNumber, ADDRESS_ZERO } = require("./shared/utils");
const { BigNumber } = require("ethers");
const { ethers } = require("hardhat");

describe("MasterAdaSwap", function () {
  before(async function () {
    await prepare(this, ['MasterAdaSwap', 'AdaSwapToken', 'ERC20Mock', 'RewarderMock', 'RewarderBrokenMock'])
    await deploy(this, [
      ["brokenRewarder", this.RewarderBrokenMock]
    ])
  })

  beforeEach(async function () {
    await deploy(this, [
      ["adaswap", this.AdaSwapToken],
    ])

    await deploy(this,
      [["lp", this.ERC20Mock, ["LP Token", "LPT", getBigNumber(10)]],
      ["dummy", this.ERC20Mock, ["Dummy", "DummyT", getBigNumber(10)]],
      ['chef', this.MasterAdaSwap, [this.adaswap.address]],
      ["rlp", this.ERC20Mock, ["LP", "rLPT", getBigNumber(10)]],
      ["r", this.ERC20Mock, ["Reward", "RewardT", getBigNumber(100000)]],
      ])
    await deploy(this, [["rewarder", this.RewarderMock, [getBigNumber(1), this.r.address, this.chef.address]]])

    await this.adaswap.transferOwnership(this.chef.address)
    await this.lp.approve(this.chef.address, getBigNumber(10))
    await this.chef.setAdaSwapPerSecond("10000000000000000")
    await this.rlp.transfer(this.bob.address, getBigNumber(1))
  })

  describe("PoolLength", function () {
    it("PoolLength should execute", async function () {
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      expect((await this.chef.poolLength())).to.be.equal(1);
    })
  })

  describe("Set", function () {
    it("Should emit event LogSetPool", async function () {
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await expect(this.chef.set(0, 10, this.dummy.address, false))
        .to.emit(this.chef, "LogSetPool")
        .withArgs(0, 10, this.rewarder.address, false)
      await expect(this.chef.set(0, 10, this.dummy.address, true))
        .to.emit(this.chef, "LogSetPool")
        .withArgs(0, 10, this.dummy.address, true)
    })

    it("Should revert if invalid pool", async function () {
      let err;
      try {
        await this.chef.set(0, 10, this.rewarder.address, false)
      } catch (e) {
        err = e;
      }

      assert.equal(err.toString(), "Error: VM Exception while processing transaction: reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)")
    })
  })

  describe("PendingAdaSwap", function() {
    it("PendingAdaSwap should equal ExpectedAdaSwap", async function () {
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await this.rlp.approve(this.chef.address, getBigNumber(10))
      let log = await this.chef.deposit(0, getBigNumber(1), this.alice.address)
      let timestamp = (await ethers.provider.getBlock(log.blockNumber)).timestamp
      await advanceNextBlockTime(timestamp + 86400)
      let log2 = await this.chef.updatePool(0)
      let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp
      let expectedAdaSwap = BigNumber.from("10000000000000000").mul(timestamp2 - timestamp)
      let pendingAdaSwap = await this.chef.pendingAdaSwap(0, this.alice.address)
      expect(pendingAdaSwap).to.be.equal(expectedAdaSwap)
    })
    it("When time is lastRewardTime", async function () {
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await this.rlp.approve(this.chef.address, getBigNumber(10))
      let log = await this.chef.deposit(0, getBigNumber(1), this.alice.address)
      let timestamp = (await ethers.provider.getBlock(log.blockNumber)).timestamp
      await advanceNextBlockTime(timestamp + 86400)
      let log2 = await this.chef.updatePool(0)
      let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp
      let expectedAdaSwap = BigNumber.from("10000000000000000").mul(timestamp2 - timestamp)
      let pendingAdaSwap = await this.chef.pendingAdaSwap(0, this.alice.address)
      expect(pendingAdaSwap).to.be.equal(expectedAdaSwap)
    })
  })

  describe("MassUpdatePools", function () {
    it("Should call updatePool", async function () {
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await advanceBlockTo(1)
      await this.chef.massUpdatePools([0])
      //expect('updatePool').to.be.calledOnContract(); //not suported by hardhat
      //expect('updatePool').to.be.calledOnContractWith(0); //not suported by hardhat

    })

    it("Updating invalid pools should fail", async function () {
      let err;
      try {
        await this.chef.massUpdatePools([0, 10000, 100000])
      } catch (e) {
        err = e;
      }

      assert.equal(err.toString(), "Error: VM Exception while processing transaction: reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)")
    })
  })

  describe("Add", function () {
    it("Should add pool with reward token multiplier", async function () {
      await expect(this.chef.add(10, this.rlp.address, this.rewarder.address))
        .to.emit(this.chef, "LogPoolAddition")
        .withArgs(0, 10, this.rlp.address, this.rewarder.address)
    })
  })

  describe("UpdatePool", function () {
    it("Should emit event LogUpdatePool", async function () {
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await advanceBlockTo(1)
      const log = await this.chef.updatePool(0)
      expect(log)
        .to.emit(this.chef, "LogUpdatePool")
        .withArgs(0, (await this.chef.poolInfo(0)).lastRewardTime,
          (await this.rlp.balanceOf(this.chef.address)),
          (await this.chef.poolInfo(0)).accAdaSwapPerShare)
    })

    it("Should take else path", async function () {
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await advanceBlockTo(1)
      await this.chef.batch(
        [
          this.chef.interface.encodeFunctionData("updatePool", [0]),
          this.chef.interface.encodeFunctionData("updatePool", [0]),
        ],
        true
      )
    })
  })

  describe("Deposit", function () {
    it("Depositing 0 amount", async function () {
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await this.rlp.approve(this.chef.address, getBigNumber(10))
      await expect(this.chef.deposit(0, getBigNumber(0), this.alice.address))
        .to.emit(this.chef, "Deposit")
        .withArgs(this.alice.address, 0, 0, this.alice.address)
    })

    it("Depositing into non-existent pool should fail", async function () {
      let err;
      try {
        await this.chef.deposit(1001, getBigNumber(0), this.alice.address)
      } catch (e) {
        err = e;
      }

      assert.equal(err.toString(), "Error: VM Exception while processing transaction: reverted with panic code 0x32 (Array accessed at an out-of-bounds or negative index)")
    })
  })

  describe("Withdraw", function () {
    it("Withdraw 0 amount", async function () {
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await expect(this.chef.withdraw(0, getBigNumber(0), this.alice.address))
        .to.emit(this.chef, "Withdraw")
        .withArgs(this.alice.address, 0, 0, this.alice.address)
    })
  })

  describe("Harvest", function () {
    it("Should give back the correct amount of ADASWAP and reward", async function () {
      await this.r.transfer(this.rewarder.address, getBigNumber(100000))
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await this.rlp.approve(this.chef.address, getBigNumber(10))
      expect(await this.chef.lpToken(0)).to.be.equal(this.rlp.address)
      let log = await this.chef.deposit(0, getBigNumber(1), this.alice.address)
      let timestamp = (await ethers.provider.getBlock(log.blockNumber)).timestamp
      await advanceNextBlockTime(timestamp + 86400)
      let log2 = await this.chef.withdraw(0, getBigNumber(1), this.alice.address)
      let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp
      let expectedAdaSwap = BigNumber.from("10000000000000000").mul(timestamp2 - timestamp)
      expect((await this.chef.userInfo(0, this.alice.address)).rewardDebt).to.be.equal("-"+expectedAdaSwap)
      await this.chef.harvest(0, this.alice.address)
      expect(await this.adaswap.balanceOf(this.alice.address)).to.be.equal(await this.r.balanceOf(this.alice.address)).to.be.equal(expectedAdaSwap)
    })
    it("Harvest with empty user balance", async function () {
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await this.chef.harvest(0, this.alice.address)
    })

    /*
    ** NOTE: this test is failing on hardhat provider the hardhat miner is not able to mine the block with not incresing timestamp.
    ** However, the test is passing on the local ganache provider
    */
    // it("Harvest for ADASWAP-only pool", async function () {
    //   await this.chef.add(10, this.rlp.address, ADDRESS_ZERO)
    //   await this.rlp.approve(this.chef.address, getBigNumber(10))
    //   expect(await this.chef.lpToken(0)).to.be.equal(this.rlp.address)
    //   let log = await this.chef.deposit(0, getBigNumber(1), this.alice.address)
    //   let timestamp = (await ethers.provider.getBlock(log.blockNumber)).timestamp
    //   await advanceBlock()
    //   let log2 = await this.chef.withdraw(0, getBigNumber(1), this.alice.address)
    //   let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp
    //   let expectedAdaSwap = BigNumber.from("10000000000000000").mul(timestamp2 - timestamp)
    //   expect((await this.chef.userInfo(0, this.alice.address)).rewardDebt).to.be.equal("-" + expectedAdaSwap)
    //   await this.chef.harvest(0, this.alice.address)
    //   expect(await this.adaswap.balanceOf(this.alice.address)).to.be.equal(expectedAdaSwap)
    // })
  })

  describe("EmergencyWithdraw", function () {
    it("Should emit event EmergencyWithdraw", async function () {
      await this.r.transfer(this.rewarder.address, getBigNumber(100000))
      await this.chef.add(10, this.rlp.address, this.rewarder.address)
      await this.rlp.approve(this.chef.address, getBigNumber(10))
      await this.chef.deposit(0, getBigNumber(1), this.bob.address)
      //await this.chef.emergencyWithdraw(0, this.alice.address)
      await expect(this.chef.connect(this.bob).emergencyWithdraw(0, this.bob.address))
        .to.emit(this.chef, "EmergencyWithdraw")
        .withArgs(this.bob.address, 0, getBigNumber(1), this.bob.address)
    })
  })
})
