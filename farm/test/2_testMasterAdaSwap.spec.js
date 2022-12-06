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
    let lpToken, chef, adaToken, rewarder, ADMIN, ALICE, BOB, STEAVE, JOHN;
    const adaswapPerSecond = getBigNumber(10);
    let allocPoints = [10, 20, 40, 10, 10, 10, 0];

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
        await chef.add(allocPoints, lpToken.address, rewarder.address);
    })

    it('24. testMasterAdaSwap: One staker already in pool, 2 entered and then exit positions', async () => {
        // One staker entered the pool
        const tx1 = await chef.connect(ALICE).deposit(0, 1, getBigNumber(2), ALICE.address);
        let timestamp1 = (await ethers.provider.getBlock(tx1.blockNumber)).timestamp;

        // The staker waits until lock time is over
        await advanceIncreaseTime(3600 * 24 * 7);

        let pool = await chef.poolInfo(0);

        // And harvests rewards
        const tx2 = await chef.connect(ALICE).harvest(0, 1, ALICE.address);
        let timestamp2 = (await ethers.provider.getBlock(tx2.blockNumber)).timestamp;

        let dt = BigNumber.from(timestamp2).sub(timestamp1);
        let infoAfter = await chef.userInfo(0, 1, ALICE.address);
        let aliceRewards = dt.mul(adaswapPerSecond).mul(getBigNumber(2)).mul(allocPoints[1]).div(pool.weight);
        // Before check
        expect(infoAfter.rewardDebt.mul(allocPoints[1])).to.eq(aliceRewards);

        // Two new stakers entered pool
        await chef.connect(BOB).deposit(0, 1, getBigNumber(4), BOB.address);
        await chef.connect(STEAVE).deposit(0, 1, getBigNumber(13), STEAVE.address);

        await advanceIncreaseTime(3600 * 24 * 7);

        // And then leave their positions
        await chef.connect(BOB).withdraw(0, 1, getBigNumber(4), BOB.address);
        await chef.connect(STEAVE).withdraw(0, 1, getBigNumber(13), STEAVE.address);

        let alice = await chef.userInfo(0, 1, ALICE.address);

        // Initial staker harvests again
        await chef.connect(ALICE).harvest(0, 1, ALICE.address);

        pool = await chef.poolInfo(0);
        accumulatedAdaSwap = alice.amount.mul(pool.accAdaSwapPerShare).div(1e12);

        infoAfter = await chef.userInfo(0, 1, ALICE.address);

        // Checking results
        expect(infoAfter.rewardDebt).to.eq(accumulatedAdaSwap);
    })

    it('25. testMasterAdaSwap: Two stakers already in pool, 1 entered and then first two exit positions', async () => {
        // Two stakers entered the pool
        await chef.connect(BOB).deposit(0, 1, getBigNumber(11), BOB.address);
        await chef.connect(ALICE).deposit(0, 1, getBigNumber(7), ALICE.address);

        await advanceIncreaseTime(3600 * 24 * 14);

        // New staker entered
        await chef.connect(STEAVE).deposit(0, 1, getBigNumber(23), STEAVE.address,);

        // They wait until lock time is over
        await advanceIncreaseTime(3600 * 24 * 14);

        // Before harvesting we gather user info for preliminary calculations
        let bob = await chef.userInfo(0, 1, BOB.address);

        // BOB harvests rewards
        await chef.connect(BOB).harvest(0, 1, BOB.address);

        let pool = await chef.poolInfo(0);
        // We precompute accumulated rewards
        let accAdaSwapBOB = bob.amount.mul(pool.accAdaSwapPerShare).div(1e12);

        // Get actual data
        let infoAfterBOB = await chef.userInfo(0, 1, BOB.address);

        // The same procedure is applied to ALICE and STEAVE
        let alice = await chef.userInfo(0, 1, ALICE.address)
        await chef.connect(ALICE).harvest(0, 1, ALICE.address)
        pool = await chef.poolInfo(0)
        let accAdaSwapALICE = alice.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        let infoAfterALICE = await chef.userInfo(0, 1, ALICE.address);

        let steave = await chef.userInfo(0, 1, STEAVE.address);
        await chef.connect(STEAVE).harvest(0, 1, STEAVE.address);
        pool = await chef.poolInfo(0);
        let accAdaSwapSTEAVE = steave.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        let infoAfterSTEAVE = await chef.userInfo(0, 1, STEAVE.address);

        expect(infoAfterBOB.rewardDebt).to.eq(accAdaSwapBOB);
        expect(infoAfterALICE.rewardDebt).to.eq(accAdaSwapALICE);
        expect(infoAfterSTEAVE.rewardDebt).to.eq(accAdaSwapSTEAVE);


        // First two leave their positions
        await chef.connect(BOB).withdraw(0, 1, getBigNumber(11), BOB.address);
        await chef.connect(ALICE).withdraw(0, 1, getBigNumber(7), ALICE.address);

        // Third person waits again 14 days
        await advanceIncreaseTime(3600 * 24 * 14);

        // Checking results for STEAVE after BOB and ALICE left pool
        steave = await chef.userInfo(0, 1, STEAVE.address);
        await chef.connect(STEAVE).harvest(0, 1, STEAVE.address);
        pool = await chef.poolInfo(0);
        accAdaSwapSTEAVE = steave.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        infoAfterSTEAVE = await chef.userInfo(0, 1, STEAVE.address);

        expect(infoAfterSTEAVE.rewardDebt).to.eq(accAdaSwapSTEAVE);
    })

    it('26. testMasterAdaSwap: Two users are already staking and harvesting in different periods of time', async () => {
        // Two stakers entered the pool
        await chef.connect(BOB).deposit(0, 3, getBigNumber(11), BOB.address);
        await chef.connect(ALICE).deposit(0, 3, getBigNumber(27), ALICE.address);

        await advanceIncreaseTime(3600 * 24 * 30);

        // Harvesting after min (30 days) lock time  
        let bob = await chef.userInfo(0, 3, BOB.address);

        await chef.connect(BOB).harvest(0, 3, BOB.address)

        pool = await chef.poolInfo(0);
        let accumulatedAdaSwapBOB = bob.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        let infoAfterBOB = await chef.userInfo(0, 3, BOB.address);

        let alice = await chef.userInfo(0, 3, ALICE.address);

        await chef.connect(ALICE).harvest(0, 3, ALICE.address);

        pool = await chef.poolInfo(0);
        let accumulatedAdaSwapALICE = alice.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        let infoAfterALICE = await chef.userInfo(0, 3, ALICE.address);

        // checking all results
        expect(infoAfterBOB.rewardDebt).to.eq(accumulatedAdaSwapBOB);
        expect(infoAfterALICE.rewardDebt).to.eq(accumulatedAdaSwapALICE);


        // Harvesting after a random period of time (e.g 77 days)
        await advanceIncreaseTime(3600 * 24 * 77);

        bob = await chef.userInfo(0, 3, BOB.address);

        await chef.connect(BOB).harvest(0, 3, BOB.address);

        pool = await chef.poolInfo(0);
        accumulatedAdaSwapBOB = bob.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        infoAfterBOB = await chef.userInfo(0, 3, BOB.address);


        alice = await chef.userInfo(0, 3, ALICE.address);

        await chef.connect(ALICE).harvest(0, 3, ALICE.address);

        pool = await chef.poolInfo(0);
        accumulatedAdaSwapALICE = alice.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        infoAfterALICE = await chef.userInfo(0, 3, ALICE.address);

        // checking all results
        expect(infoAfterBOB.rewardDebt).to.eq(accumulatedAdaSwapBOB);
        expect(infoAfterALICE.rewardDebt).to.eq(accumulatedAdaSwapALICE);
    });

    it('27. testMasterAdaSwap: Two users are staking, then other two users start staking. After that first two increase their staking amount', async () => {
        // Two stakers entered the pool
        await chef.connect(BOB).deposit(0, 4, getBigNumber(11), BOB.address);
        await chef.connect(ALICE).deposit(0, 4, getBigNumber(27), ALICE.address);

        // 13 days passes (rand time)
        await advanceIncreaseTime(3600 * 24 * 13);

        await chef.connect(STEAVE).deposit(0, 4, getBigNumber(6), STEAVE.address);
        await chef.connect(JOHN).deposit(0, 4, getBigNumber(3), JOHN.address);

        // First two stakers increase their staking amount
        await chef.connect(BOB).deposit(0, 4, getBigNumber(1), BOB.address);
        await chef.connect(ALICE).deposit(0, 4, getBigNumber(4), ALICE.address);

        // Lock time passes
        await advanceIncreaseTime(3600 * 24 * 60);

        // Checking harvested rewards for each user
        const bob = await chef.userInfo(0,4, BOB.address);
        await chef.connect(BOB).harvest(0, 4, BOB.address);
        let pool = await chef.poolInfo(0);
        const accumulatedAdaSwapBOB = bob.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        const infoAfterBOB = await chef.userInfo(0,4, BOB.address);

        const alice = await chef.userInfo(0,4, ALICE.address);
        await chef.connect(ALICE).harvest(0, 4, ALICE.address);
        pool = await chef.poolInfo(0);
        const accumulatedAdaSwapALICE = alice.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        const infoAfterALICE = await chef.userInfo(0,4, ALICE.address);        

        const steave = await chef.userInfo(0,4, STEAVE.address);
        await chef.connect(STEAVE).harvest(0, 4, STEAVE.address);
        pool = await chef.poolInfo(0);
        const accumulatedAdaSwapSTEAVE = steave.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        const infoAfterSTEAVE = await chef.userInfo(0,4, STEAVE.address);        

        const john = await chef.userInfo(0,4, JOHN.address);
        await chef.connect(JOHN).harvest(0, 4, JOHN.address);
        pool = await chef.poolInfo(0);
        const accumulatedAdaSwapJOHN = john.amount.mul(pool.accAdaSwapPerShare).div(1e12);
        const infoAfterJOHN = await chef.userInfo(0,4, JOHN.address);        

        // checking all results
        expect(infoAfterBOB.rewardDebt).to.eq(accumulatedAdaSwapBOB);
        expect(infoAfterALICE.rewardDebt).to.eq(accumulatedAdaSwapALICE);
        expect(infoAfterSTEAVE.rewardDebt).to.eq(accumulatedAdaSwapSTEAVE);
        expect(infoAfterJOHN.rewardDebt).to.eq(accumulatedAdaSwapJOHN);
    });
})