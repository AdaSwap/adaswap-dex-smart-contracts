const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");
const { getBigNumber, ADDRESS_ZERO, advanceBlockWithTime } = require("./shared/utils");
const { BigNumber } = require("ethers");

use(solidity);

async function advanceIncreaseTime(time) {
    await ethers.provider.send("evm_increaseTime", [time])
    await ethers.provider.send("evm_mine")
}

describe("MasterAdaSwap", function () {
    let lpToken, chef, adaToken, rewarder, ADMIN, ALICE, BOB, STEAVE, SAM, TOM, GOR, TOR, YOR;
    let allocPoints = [10, 20, 40, 10, 10, 10, 0];
    let allocPoints1 = [40, 80, 160, 40, 40, 40, 0];
    before((done) => {
        setTimeout(done, 2000);
    });

    beforeEach(async () => {
        const [admin, alice, bob, steave, sam, tom, gor, tor, yor] = await ethers.getSigners();
        ADMIN = admin;
        ALICE = alice;
        BOB = bob;
        STEAVE = steave;
        SAM = sam;
        TOM = tom;
        GOR = gor;
        TOR = tor;
        YOR = yor;

        lpToken = await ethers.getContractFactory("ERC20Mock");
        lpToken1 = await ethers.getContractFactory("ERC20Mock");
        adaToken = await ethers.getContractFactory("AdaSwapToken");
        chef = await ethers.getContractFactory("MasterAdaSwap");
        rewarder = await ethers.getContractFactory("RewarderMock");

        lpToken = await lpToken.connect(ADMIN).deploy("LP Token", "LPT", getBigNumber(10000));
        lpToken1 = await lpToken1.connect(ADMIN).deploy("LP Token", "LPT", getBigNumber(10000));
        adaToken = await adaToken.connect(ADMIN).deploy();
        chef = await chef.connect(ADMIN).deploy(adaToken.address, alice.address);
        rewarder = await rewarder.connect(ADMIN).deploy(getBigNumber(1), adaToken.address, chef.address);
        await adaToken.connect(ADMIN).mint(ALICE.address, getBigNumber(12096000000));

        expect(lpToken.deployed);
        expect(lpToken1.deployed);
        expect(adaToken.deployed);
        expect(chef.deployed);
        expect(rewarder.deployed);

        await adaToken.transferOwnership(chef.address);
        await lpToken.approve(chef.address, getBigNumber(100));
        await chef.setAdaSwapPerSecond(getBigNumber(20));
        await lpToken.transfer(BOB.address, getBigNumber(500));
        await lpToken.transfer(ALICE.address, getBigNumber(500));
        await lpToken.transfer(STEAVE.address, getBigNumber(500));
        await lpToken.transfer(SAM.address, getBigNumber(100));
        await lpToken.transfer(TOM.address, getBigNumber(100));
        await lpToken.transfer(GOR.address, getBigNumber(30));
        await lpToken.transfer(TOR.address, getBigNumber(30));
        await lpToken.transfer(YOR.address, getBigNumber(30));
        await lpToken.connect(BOB).approve(chef.address, getBigNumber(10000));
        await lpToken.connect(ALICE).approve(chef.address, getBigNumber(10000));
        await lpToken.connect(STEAVE).approve(chef.address, getBigNumber(10000));
        await lpToken.connect(SAM).approve(chef.address, getBigNumber(10000));
        await lpToken.connect(TOM).approve(chef.address, getBigNumber(10000));
        await lpToken.connect(GOR).approve(chef.address, getBigNumber(10000));
        await lpToken.connect(TOR).approve(chef.address, getBigNumber(10000));
        await lpToken.connect(YOR).approve(chef.address, getBigNumber(10000));
        await adaToken.connect(ALICE).approve(chef.address, getBigNumber(100000000));

        await lpToken1.transfer(BOB.address, getBigNumber(100));
        await lpToken1.transfer(ALICE.address, getBigNumber(100));
        await lpToken1.transfer(STEAVE.address, getBigNumber(100));
        await lpToken1.transfer(SAM.address, getBigNumber(100));
        await lpToken1.transfer(TOM.address, getBigNumber(100));
        await lpToken1.transfer(GOR.address, getBigNumber(30));
        await lpToken1.transfer(TOR.address, getBigNumber(30));
        await lpToken1.transfer(YOR.address, getBigNumber(30));
        await lpToken1.approve(chef.address, getBigNumber(100));
        await lpToken1.connect(BOB).approve(chef.address, getBigNumber(10000));
        await lpToken1.connect(ALICE).approve(chef.address, getBigNumber(10000));
        await lpToken1.connect(STEAVE).approve(chef.address, getBigNumber(10000));
        await lpToken1.connect(SAM).approve(chef.address, getBigNumber(10000));
        await lpToken1.connect(TOM).approve(chef.address, getBigNumber(10000));
        await lpToken1.connect(GOR).approve(chef.address, getBigNumber(10000));
        await lpToken1.connect(TOR).approve(chef.address, getBigNumber(10000));
        await lpToken1.connect(YOR).approve(chef.address, getBigNumber(10000));

        await chef.connect(ADMIN).add(allocPoints, lpToken.address, rewarder.address);
        await chef.connect(ADMIN).add(allocPoints1, lpToken1.address, rewarder.address);

        await chef.connect(BOB).deposit(0, 0, getBigNumber(4), BOB.address);
        await chef.connect(ALICE).deposit(0, 0, getBigNumber(3), ALICE.address);
        await chef.connect(STEAVE).deposit(0, 0, getBigNumber(2), STEAVE.address);
        await chef.connect(SAM).deposit(0, 0, getBigNumber(1), SAM.address);

        await chef.connect(TOM).deposit(1, 0, getBigNumber(1), TOM.address);
        await chef.connect(GOR).deposit(1, 0, getBigNumber(2), GOR.address);
        await chef.connect(TOR).deposit(1, 0, getBigNumber(3), TOR.address);
        await chef.connect(YOR).deposit(1, 0, getBigNumber(4), YOR.address);
    });

    describe('Check rewards', async () => {
        it('19. testMasterAdaSwap: Stop Reward counting', async () => {

            let tomm = await chef.userInfo(1, 0, TOM.address);
            await chef.connect(TOM)
                .withdrawAndHarvest(1, 0, getBigNumber(1), TOM.address);
            let pool1 = await chef.poolInfo(1);

            const accumulatedAdaSwapTOM = (tomm.amount).mul(pool1.accAdaSwapPerShare).div(1e12);
            let expectedRewardDebt_1 = accumulatedAdaSwapTOM.sub(getBigNumber(1).mul(pool1.accAdaSwapPerShare).div(1e12));
            let infoAfterTOM = await chef.userInfo(1, 0, TOM.address);

            let gorr = await chef.userInfo(1, 0, GOR.address);
            await chef.connect(GOR)
                .withdrawAndHarvest(1, 0, getBigNumber(2), GOR.address);
            pool1 = await chef.poolInfo(1);
            const accumulatedAdaSwapGOR = gorr.amount.mul(pool1.accAdaSwapPerShare).div(1e12);
            let expectedRewardDebt_2 = accumulatedAdaSwapGOR.sub(getBigNumber(2).mul(pool1.accAdaSwapPerShare).div(1e12));
            const infoAfterGOR = await chef.userInfo(1, 0, GOR.address);

            let torr = await chef.userInfo(1, 0, TOR.address);
            await chef.connect(TOR)
                .withdrawAndHarvest(1, 0, getBigNumber(3), TOR.address);
            pool1 = await chef.poolInfo(1);
            const accumulatedAdaSwapTOR = torr.amount.mul(pool1.accAdaSwapPerShare).div(1e12)
            let expectedRewardDebt_3 = accumulatedAdaSwapTOR.sub(getBigNumber(3).mul(pool1.accAdaSwapPerShare).div(1e12));
            const infoAfterTOR = await chef.userInfo(1, 0, TOR.address);

            let yorr = await chef.userInfo(1, 0, YOR.address);
            await chef.connect(YOR)
                .withdrawAndHarvest(1, 0, getBigNumber(4), YOR.address);
            pool1 = await chef.poolInfo(1);
            const accumulatedAdaSwapYOR = yorr.amount.mul(pool1.accAdaSwapPerShare).div(1e12);
            let expectedRewardDebt_4 = accumulatedAdaSwapYOR.sub(getBigNumber(4).mul(pool1.accAdaSwapPerShare).div(1e12));
            const infoAfterYOR = await chef.userInfo(1, 0, YOR.address);

            let bobb = await chef.userInfo(0, 0, BOB.address);
            await chef.connect(BOB)
                .withdrawAndHarvest(0, 0, getBigNumber(4), BOB.address);
            let pool = await chef.poolInfo(0);
            const accumulatedAdaSwapBOB = (bobb.amount).mul(pool.accAdaSwapPerShare).div(1e12);
            let _expectedRewardDebt1 = accumulatedAdaSwapBOB.sub(getBigNumber(4).mul(pool.accAdaSwapPerShare).div(1e12));
            const infoAfterBOB = await chef.userInfo(0, 0, BOB.address);

            let alicee = await chef.userInfo(0, 0, ALICE.address);
            await chef.connect(ALICE)
                .withdrawAndHarvest(0, 0, getBigNumber(3), ALICE.address);
            pool = await chef.poolInfo(0);
            const accumulatedAdaSwapALICE = (alicee.amount).mul(pool.accAdaSwapPerShare).div(1e12);
            let _expectedRewardDebt2 = accumulatedAdaSwapALICE.sub(getBigNumber(3).mul(pool.accAdaSwapPerShare).div(1e12));
            const infoAfterALICE = await chef.userInfo(0, 0, ALICE.address)

            let steavee = await chef.userInfo(0, 0, STEAVE.address);
            await chef.connect(STEAVE)
                .withdrawAndHarvest(0, 0, getBigNumber(2), STEAVE.address);
            pool = await chef.poolInfo(0);
            const accumulatedAdaSwapSTEAVE = (steavee.amount).mul(pool.accAdaSwapPerShare).div(1e12);
            let _expectedRewardDebt3 = accumulatedAdaSwapSTEAVE.sub(getBigNumber(2).mul(pool.accAdaSwapPerShare).div(1e12));
            const infoAfterSTEAVE = await chef.userInfo(0, 0, STEAVE.address);

            let samm = await chef.userInfo(0, 0, SAM.address);
            await chef.connect(SAM)
                .withdrawAndHarvest(0, 0, getBigNumber(1), SAM.address);
            pool = await chef.poolInfo(0);
            const accumulatedAdaSwapSAM = (samm.amount).mul(pool.accAdaSwapPerShare).div(1e12);
            let _expectedRewardDebt4 = accumulatedAdaSwapSAM.sub(getBigNumber(1).mul(pool.accAdaSwapPerShare).div(1e12));
            const infoAfterSAM = await chef.userInfo(0, 0, SAM.address);

            expect(expectedRewardDebt_1).to.be.eq(infoAfterTOM.rewardDebt);
            expect(expectedRewardDebt_2).to.be.eq(infoAfterGOR.rewardDebt);
            expect(expectedRewardDebt_3).to.be.eq(infoAfterTOR.rewardDebt);
            expect(expectedRewardDebt_4).to.be.eq(infoAfterYOR.rewardDebt);

            expect(_expectedRewardDebt1).to.be.eq(infoAfterBOB.rewardDebt);
            expect(_expectedRewardDebt2).to.be.eq(infoAfterALICE.rewardDebt);
            expect(_expectedRewardDebt3).to.be.eq(infoAfterSTEAVE.rewardDebt);
            expect(_expectedRewardDebt4).to.be.eq(infoAfterSAM.rewardDebt);
        })
    });

    describe('Fake operations',async()=>{
        it("20. testMasterAdaSwap: Should revert if not Onlyowner", async()=>{
            await expect( chef.connect(ALICE).add(allocPoints, lpToken.address, rewarder.address))
            .to.be.revertedWith("Ownable: caller is not the owner");

        })

        it("21. testMasterAdaSwap: Should revert if 0 Address", async()=>{
            await expect( chef.connect('0x0').add(allocPoints, lpToken.address, rewarder.address))
            .to.be.reverted;

        })

        it("22. testMasterAdaSwap: Should revert if fake account", async()=>{
            advanceIncreaseTime(3600 * 24 * 14); // to unlock lock time

            await expect( chef.connect(TOM)
                .withdrawAndHarvest(0, 0, getBigNumber(1), TOM.address, 1)).to.be.reverted;
        })
    });
});
