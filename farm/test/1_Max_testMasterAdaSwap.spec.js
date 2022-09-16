const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");
const { getBigNumber } = require("./shared/utils");
const { BigNumber } = require("ethers");

use(solidity);

const advanceIncreaseTime = async (time) => {
    await ethers.provider.send("evm_increaseTime", [time])
    await ethers.provider.send("evm_mine")
}

describe("MasterAdaSwap Use Cases", () => {
    let lpToken, chef, adaToken, rewarder, pool, ADMIN, ALICE, BOB, STEAVE, JOHN;

    before((done) => {
        setTimeout(done, 2000);
    })

    beforeEach(async () => {
        [ADMIN, ALICE, BOB, STEAVE, JOHN] = await ethers.getSigners();
        
        lpToken = await ethers.getContractFactory("ERC20Mock", ADMIN);
        adaToken = await ethers.getContractFactory("AdaSwapToken", ADMIN);
        chef = await ethers.getContractFactory("MasterAdaSwap", ADMIN);
        rewarder = await ethers.getContractFactory("RewarderMock", ADMIN);
    
        lpToken = await lpToken.deploy("LP Token", "LPT", getBigNumber(10000));
        adaToken = await adaToken.deploy();
        chef = await chef.deploy(adaToken.address, ALICE.address);
        rewarder = await rewarder.deploy(getBigNumber(1), adaToken.address, chef.address);
        
        await adaToken.connect(ADMIN).mint(ALICE.address, getBigNumber(12096000000));
        await adaToken.transferOwnership(chef.address);
        await lpToken.approve(chef.address, getBigNumber(100));
        await chef.setAdaSwapPerSecond(getBigNumber(10));
        await lpToken.transfer(BOB.address, getBigNumber(100));
        await lpToken.transfer(ALICE.address, getBigNumber(100));
        await lpToken.transfer(STEAVE.address, getBigNumber(100));
        await lpToken.transfer(JOHN.address, getBigNumber(100));
        await adaToken.connect(ALICE).approve(chef.address, getBigNumber(10000000000));
        await lpToken.connect(ALICE).approve(chef.address, getBigNumber(10000));
        await lpToken.connect(BOB).approve(chef.address, getBigNumber(10000));
        await lpToken.connect(STEAVE).approve(chef.address, getBigNumber(10000));
        await lpToken.connect(JOHN).approve(chef.address, getBigNumber(10000));
    })


    it('1. One staker already in pool, 2 entered and then exit positions.', async () => {
        await chef.add(15, lpToken.address, 0, rewarder.address)
        
        // One staker entered the pool
        const tx1 = await chef.connect(ALICE).deposit(lpToken.address, ALICE.address, getBigNumber(3), 0)
        let timestamp1 = (await ethers.provider.getBlock(tx1.blockNumber)).timestamp

        let pool = await chef.poolInfo(lpToken.address, 0)

        // The staker waits until lock time is over
        await advanceIncreaseTime(3600 * 24 * 7)
        
        // And harvests rewards
        const tx2 = await chef.connect(ALICE).harvest(lpToken.address, ALICE.address, 0)
        let timestamp2 = (await ethers.provider.getBlock(tx2.blockNumber)).timestamp
        
        let dt = BigNumber.from(timestamp2).sub(timestamp1)
        let adaReward = dt.mul(getBigNumber(10)).mul(15/15)
        let accAdaSwapPerShare = (pool.accAdaSwapPerShare).add(adaReward.mul(1e+12).div(getBigNumber(3)))
        let accumulatedAdaSwap = getBigNumber(3).mul(accAdaSwapPerShare).div(1e+12)
        let infoAfter = await chef.userInfo(ALICE.address, lpToken.address, 0)

        // Before check
        expect(infoAfter.rewardDebt).to.eq(accumulatedAdaSwap)
        
        // Two new stakers entered pool
        await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(4), 0)
        await chef.connect(STEAVE).deposit(lpToken.address, STEAVE.address, getBigNumber(13), 0)
        
        await advanceIncreaseTime(3600 * 24 * 7)

        // And then leave their positions
        await chef.connect(BOB).withdraw(lpToken.address, BOB.address, getBigNumber(4), 0)
        await chef.connect(STEAVE).withdraw(lpToken.address, STEAVE.address, getBigNumber(13), 0)

        let alice = await chef.userInfo(ALICE.address, lpToken.address, 0)
        
        // Initial staker harvests again
        await chef.connect(ALICE).harvest(lpToken.address, ALICE.address, 0)
        
        pool = await chef.poolInfo(lpToken.address, 0)
        accumulatedAdaSwap = alice.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        
        infoAfter = await chef.userInfo(ALICE.address, lpToken.address, 0)
        
        // Checking results
        expect(infoAfter.rewardDebt).to.eq(accumulatedAdaSwap)
    })

    it('2. Two stakers already in pool, 1 entered and then first two exit positions.', async () => {
        await chef.add(45, lpToken.address, 1, rewarder.address)
        // BOB
        // ALICE
        // STEAVE

        // Two stakers entered the pool
        await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(11), 1)
        await chef.connect(ALICE).deposit(lpToken.address, ALICE.address, getBigNumber(7), 1)

        await advanceIncreaseTime(3600 * 24 * 14)

        // New staker entered also        
        await chef.connect(STEAVE).deposit(lpToken.address, STEAVE.address, getBigNumber(23), 1)
        
        // They wait until lock time is over
        await advanceIncreaseTime(3600 * 24 * 14)

        // Before harvesting we gather user info for preliminary calculations
        let bob = await chef.userInfo(BOB.address, lpToken.address, 1)
        
        // BOB harvests rewards
        await chef.connect(BOB).harvest(lpToken.address, BOB.address, 1)

        let pool = await chef.poolInfo(lpToken.address, 1)

        // We precompute accumulated rewards
        let accumulatedAdaSwapBOB = bob.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        
        // Get actual data
        let infoAfterBOB = await chef.userInfo(BOB.address, lpToken.address, 1)
        
        // The same procedure is applied to ALICE and STEAVE
        let alice = await chef.userInfo(ALICE.address, lpToken.address, 1)
        await chef.connect(ALICE).harvest(lpToken.address, ALICE.address, 1)
        pool = await chef.poolInfo(lpToken.address, 1)
        let accumulatedAdaSwapALICE = alice.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        let infoAfterALICE = await chef.userInfo(ALICE.address, lpToken.address, 1)
        
        let steave = await chef.userInfo(STEAVE.address, lpToken.address, 1)
        await chef.connect(STEAVE).harvest(lpToken.address, STEAVE.address, 1)
        pool = await chef.poolInfo(lpToken.address, 1)
        let accumulatedAdaSwapSTEAVE = steave.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        let infoAfterSTEAVE = await chef.userInfo(STEAVE.address, lpToken.address, 1)
        
        // checking all results
        expect(infoAfterBOB.rewardDebt).to.eq(accumulatedAdaSwapBOB)
        expect(infoAfterALICE.rewardDebt).to.eq(accumulatedAdaSwapALICE)
        expect(infoAfterSTEAVE.rewardDebt).to.eq(accumulatedAdaSwapSTEAVE)

        
        // First two leave their positions
        await chef.connect(BOB).withdraw(lpToken.address, BOB.address, getBigNumber(11), 1)
        await chef.connect(ALICE).withdraw(lpToken.address, ALICE.address, getBigNumber(7), 1)

        // Third person waits again 14 days
        await advanceIncreaseTime(3600 * 24 * 14)

        // Checking results for STEAVE after BOB and ALICE left pool
        steave = await chef.userInfo(STEAVE.address, lpToken.address, 1)
        await chef.connect(STEAVE).harvest(lpToken.address, STEAVE.address, 1)
        pool = await chef.poolInfo(lpToken.address, 1)
        accumulatedAdaSwapSTEAVE = steave.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        infoAfterSTEAVE = await chef.userInfo(STEAVE.address, lpToken.address, 1)
        
        expect(infoAfterSTEAVE.rewardDebt).to.eq(accumulatedAdaSwapSTEAVE)
    })

    it('3. Two users are already staking and harvesting in different periods of time.', async () => {
        await chef.add(111, lpToken.address, 2, rewarder.address)

        // Two stakers entered the pool
        await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(11), 2)
        await chef.connect(ALICE).deposit(lpToken.address, ALICE.address, getBigNumber(27), 2)

        await advanceIncreaseTime(3600 * 24 * 30)

        // Harvesting after min (30 days) lock time  
        let bob = await chef.userInfo(BOB.address, lpToken.address, 2)
        
        await chef.connect(BOB).harvest(lpToken.address, BOB.address, 2)
        
        pool = await chef.poolInfo(lpToken.address, 2)
        let accumulatedAdaSwapBOB = bob.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        let infoAfterBOB = await chef.userInfo(BOB.address, lpToken.address, 2)
        
        let alice = await chef.userInfo(ALICE.address, lpToken.address, 2)
        
        await chef.connect(ALICE).harvest(lpToken.address, ALICE.address, 2)
        
        pool = await chef.poolInfo(lpToken.address, 2)
        let accumulatedAdaSwapALICE = alice.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        let infoAfterALICE = await chef.userInfo(ALICE.address, lpToken.address, 2)

        // checking all results
        expect(infoAfterBOB.rewardDebt).to.eq(accumulatedAdaSwapBOB)
        expect(infoAfterALICE.rewardDebt).to.eq(accumulatedAdaSwapALICE)


        // Harvesting after a random period of time (e.g 77 days)
        await advanceIncreaseTime(3600 * 24 * 77)

        bob = await chef.userInfo(BOB.address, lpToken.address, 2)
        
        await chef.connect(BOB).harvest(lpToken.address, BOB.address, 2)
        
        pool = await chef.poolInfo(lpToken.address, 2)
        accumulatedAdaSwapBOB = bob.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        infoAfterBOB = await chef.userInfo(BOB.address, lpToken.address, 2)
        

        alice = await chef.userInfo(ALICE.address, lpToken.address, 2)
        
        await chef.connect(ALICE).harvest(lpToken.address, ALICE.address, 2)
        
        pool = await chef.poolInfo(lpToken.address, 2)
        accumulatedAdaSwapALICE = alice.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        infoAfterALICE = await chef.userInfo(ALICE.address, lpToken.address, 2)

        // checking all results
        expect(infoAfterBOB.rewardDebt).to.eq(accumulatedAdaSwapBOB)
        expect(infoAfterALICE.rewardDebt).to.eq(accumulatedAdaSwapALICE)
    })

    it('4. Two users are staking, then other two user start staking. After that first two increase their staking amount.', async () => {
        await chef.add(111, lpToken.address, 3, rewarder.address)

        // Two stakers entered the pool
        await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(11), 3)
        await chef.connect(ALICE).deposit(lpToken.address, ALICE.address, getBigNumber(27), 3)

        // 13 days passes (rand time)
        await advanceIncreaseTime(3600 * 24 * 13)

        await chef.connect(STEAVE).deposit(lpToken.address, STEAVE.address, getBigNumber(6), 3)
        await chef.connect(JOHN).deposit(lpToken.address, JOHN.address, getBigNumber(3), 3)

        // First two stakers increase their staking amount
        await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(1), 3)
        await chef.connect(ALICE).deposit(lpToken.address, ALICE.address, getBigNumber(4), 3)

        // Lock time passes
        await advanceIncreaseTime(3600 * 24 * 60)

        // Checking harvested rewards for each user
        const bob = await chef.userInfo(BOB.address, lpToken.address, 3)
        await chef.connect(BOB).harvest(lpToken.address, BOB.address, 3)
        let pool = await chef.poolInfo(lpToken.address, 3)
        const accumulatedAdaSwapBOB = bob.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        const infoAfterBOB = await chef.userInfo(BOB.address, lpToken.address, 3)

        const alice = await chef.userInfo(ALICE.address, lpToken.address, 3)
        await chef.connect(ALICE).harvest(lpToken.address, ALICE.address, 3)
        pool = await chef.poolInfo(lpToken.address, 3)
        const accumulatedAdaSwapALICE = alice.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        const infoAfterALICE = await chef.userInfo(ALICE.address, lpToken.address, 3)        

        const steave = await chef.userInfo(STEAVE.address, lpToken.address, 3)
        await chef.connect(STEAVE).harvest(lpToken.address, STEAVE.address, 3)
        pool = await chef.poolInfo(lpToken.address, 3)
        const accumulatedAdaSwapSTEAVE = steave.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        const infoAfterSTEAVE = await chef.userInfo(STEAVE.address, lpToken.address, 3)        

        const john = await chef.userInfo(JOHN.address, lpToken.address, 3)
        await chef.connect(JOHN).harvest(lpToken.address, JOHN.address, 3)
        pool = await chef.poolInfo(lpToken.address, 3)
        const accumulatedAdaSwapJOHN = john.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
        const infoAfterJOHN = await chef.userInfo(JOHN.address, lpToken.address, 3)        

        // checking all results
        expect(infoAfterBOB.rewardDebt).to.eq(accumulatedAdaSwapBOB)
        expect(infoAfterALICE.rewardDebt).to.eq(accumulatedAdaSwapALICE)
        expect(infoAfterSTEAVE.rewardDebt).to.eq(accumulatedAdaSwapSTEAVE)
        expect(infoAfterJOHN.rewardDebt).to.eq(accumulatedAdaSwapJOHN)

    })
})