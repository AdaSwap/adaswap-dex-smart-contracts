const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");
const {getBigNumber, ADDRESS_ZERO, advanceBlockWithTime } = require("./shared/utils");
const { BigNumber } = require("ethers");

use(solidity);

async function advanceIncreaseTime(time) {
    await ethers.provider.send("evm_increaseTime", [time])
    await ethers.provider.send("evm_mine")
}

describe("MasterAdaSwap", function(){
    let lpToken, chef, adaToken, rewarder, fixedTimes, ADMIN, ALICE, BOB, STEAVE, SAM, TOM, GOR,TOR,YOR, pool, pool1;
    const adaswapPerSecond = getBigNumber(10);
    before((done) => {
        setTimeout(done, 2000);
    });
    
    it("1. testMasterAdaSwap: Deploy contracts", async function(){
        const [admin, alice, bob, steave,sam,tom,gor,tor,yor] = await ethers.getSigners();
        ADMIN = admin;
        ALICE = alice;
        BOB = bob;
        STEAVE = steave;
        SAM= sam;
        TOM = tom;
        GOR= gor;
        TOR= tor;
        YOR= yor;

        lpToken = await ethers.getContractFactory("ERC20Mock");
        lpTokenSecond = await ethers.getContractFactory("ERC20Mock");
        adaToken = await ethers.getContractFactory("AdaSwapToken");
        chef = await ethers.getContractFactory("MasterAdaSwap");
        rewarder = await ethers.getContractFactory("RewarderMock");

        lpToken = await lpToken.connect(ADMIN).deploy("LP Token", "LPT", getBigNumber(10000));
        lpTokenSecond =await lpTokenSecond.connect(ADMIN).deploy("LP Toke", "LPE", getBigNumber(10000));
        adaToken = await adaToken.connect(ADMIN).deploy();
        chef = await chef.connect(ADMIN).deploy(adaToken.address, alice.address);
        rewarder = await rewarder.connect(ADMIN).deploy(getBigNumber(1), adaToken.address, chef.address);
        await adaToken.connect(ADMIN).mint(ALICE.address, getBigNumber(12096000000));

        expect(lpToken.deployed);
        expect(lpTokenSecond.deployed);
        expect(adaToken.deployed);
        expect(chef.deployed);
        expect(rewarder.deployed);
    });

    it("2. testMasterAdaSwap: prepare parametrs", async function(){
        await adaToken.transferOwnership(chef.address);
        await lpToken.approve(chef.address, getBigNumber(100));
        await chef.setAdaSwapPerSecond(getBigNumber(10));
        await lpToken.transfer(BOB.address, getBigNumber(500));
        await lpToken.transfer(ALICE.address, getBigNumber(500));
        await lpToken.transfer(STEAVE.address, getBigNumber(500));
        await lpToken.transfer(SAM.address, getBigNumber(100));
        await lpToken.transfer(TOM.address, getBigNumber(100));
        await lpToken.transfer(GOR.address, getBigNumber(30));
        await lpToken.transfer(TOR.address, getBigNumber(30));
        await lpToken.transfer(YOR.address, getBigNumber(30));
        await adaToken.connect(ALICE).approve(chef.address, getBigNumber(100000000));

        await lpTokenSecond.approve(chef.address, getBigNumber(100));
        await lpTokenSecond.transfer(BOB.address, getBigNumber(100));
        await lpTokenSecond.transfer(ALICE.address, getBigNumber(100));
        await lpTokenSecond.transfer(STEAVE.address, getBigNumber(100));
        await lpTokenSecond.transfer(SAM.address, getBigNumber(100));
        await lpTokenSecond.transfer(TOM.address, getBigNumber(100));
        await lpTokenSecond.transfer(GOR.address, getBigNumber(30));
        await lpTokenSecond.transfer(TOR.address, getBigNumber(30));
        await lpTokenSecond.transfer(YOR.address, getBigNumber(30));

        // fixedTimes = await chef.fixedTimes();
    });

    describe('2. Creating pools with different allocation points',()=>{
        it('Create pool with 2-4 users', async()=>{
            // first pool
            // advanceIncreaseTime(3600 * 24 * 7);
            await chef.connect(ADMIN).add(5, lpTokenSecond.address, 0, rewarder.address);

            expect((await chef.isExistPool(lpTokenSecond.address, 0))).to.be.equal(true);
            expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));

            await lpTokenSecond.connect(BOB).approve(chef.address, getBigNumber(10000));
            await lpTokenSecond.connect(ALICE).approve(chef.address, getBigNumber(10000));
            await lpTokenSecond.connect(STEAVE).approve(chef.address, getBigNumber(10000));
            await lpTokenSecond.connect(SAM).approve(chef.address, getBigNumber(10000));

            await chef.connect(BOB).deposit(lpTokenSecond.address, BOB.address, getBigNumber(4), 0);
            await chef.connect(ALICE).deposit(lpTokenSecond.address, ALICE.address, getBigNumber(3), 0);
            await chef.connect(STEAVE).deposit(lpTokenSecond.address, STEAVE.address, getBigNumber(2), 0);
            await chef.connect(SAM).deposit(lpTokenSecond.address, SAM.address, getBigNumber(1), 0);

            await advanceIncreaseTime(1);

            pendingAdaSwap1 = await chef.pendingAdaSwap(lpTokenSecond.address, BOB.address, 0);
            pendingAdaSwap2 = await chef.pendingAdaSwap(lpTokenSecond.address, ALICE.address, 0);
            pendingAdaSwap3 = await chef.pendingAdaSwap(lpTokenSecond.address, STEAVE.address, 0);
            pendingAdaSwap4 = await chef.pendingAdaSwap(lpTokenSecond.address, SAM.address, 0);

        });

        it('Create another pool',async()=>{
            //second pool
            await chef.connect(ADMIN).add(10, lpToken.address, 0, rewarder.address);

            expect((await chef.isExistPool(lpToken.address, 0))).to.be.equal(true);
            expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));

            await lpToken.connect(TOM).approve(chef.address, getBigNumber(10));
            await lpToken.connect(GOR).approve(chef.address, getBigNumber(10));
            await lpToken.connect(TOR).approve(chef.address, getBigNumber(10));
            await lpToken.connect(YOR).approve(chef.address, getBigNumber(10));

            await chef.connect(TOM).deposit(lpToken.address, TOM.address, getBigNumber(1), 0);
            await chef.connect(GOR).deposit(lpToken.address, GOR.address, getBigNumber(2), 0);
            await chef.connect(TOR).deposit(lpToken.address, TOR.address, getBigNumber(3), 0);
            await chef.connect(YOR).deposit(lpToken.address, YOR.address, getBigNumber(4), 0);

            await advanceIncreaseTime(1);

            pendingAdaSwap1_ = await chef.pendingAdaSwap(lpToken.address, TOM.address, 0);
            pendingAdaSwap2_ = await chef.pendingAdaSwap(lpToken.address, GOR.address, 0);
            pendingAdaSwap3_ = await chef.pendingAdaSwap(lpToken.address, TOR.address, 0);
            pendingAdaSwap4_ = await chef.pendingAdaSwap(lpToken.address, YOR.address, 0);

        });

    });

    describe('3.Check rewards', async()=>{
        it('Stop Reward counting',async()=>{

            advanceIncreaseTime(3600 * 24 * 7); // to unlock lock time

            let tomm = await chef.userInfo(TOM.address, lpToken.address, 0)
            await chef.connect(TOM)
                .withdrawAndHarvest(lpToken.address, getBigNumber(1), TOM.address,  0);
            pool1 = await chef.poolInfo(lpToken.address, 0)
          
            const accumulatedAdaSwapTOM = (tomm.amount).mul(pool1.accAdaSwapPerShare).div(1e+12)
            let pendingAdaSwap_1 = (accumulatedAdaSwapTOM).sub(getBigNumber(1).mul(pool1.accAdaSwapPerShare));
            
            let infoAfterTOM = await chef.userInfo(TOM.address, lpToken.address, 0);


            let gorr = await chef.userInfo(GOR.address, lpToken.address, 0)
            await chef.connect(GOR)
                .withdrawAndHarvest(lpToken.address, getBigNumber(2), GOR.address, 0);
            pool1 = await chef.poolInfo(lpToken.address, 0)
            const accumulatedAdaSwapGOR = gorr.amount.mul(pool1.accAdaSwapPerShare).div(1e+12)
            let pendingAdaSwap_2 = (accumulatedAdaSwapGOR).sub(getBigNumber(2).mul(pool1.accAdaSwapPerShare));
            const infoAfterGOR = await chef.userInfo(GOR.address, lpToken.address, 0)   


            let torr = await chef.userInfo(TOR.address, lpToken.address, 0)
            await chef.connect(TOR)
                .withdrawAndHarvest(lpToken.address, getBigNumber(3), TOR.address, 0);
            pool1 = await chef.poolInfo(lpToken.address, 0)
            const accumulatedAdaSwapTOR = torr.amount.mul(pool1.accAdaSwapPerShare).div(1e+12)
            let pendingAdaSwap_3 = (accumulatedAdaSwapTOR).sub(getBigNumber(3).mul(pool1.accAdaSwapPerShare));
            const infoAfterTOR = await chef.userInfo(TOR.address, lpToken.address, 0) 


            let yorr = await chef.userInfo(YOR.address, lpToken.address, 0)
            await chef.connect(YOR)
                .withdrawAndHarvest(lpToken.address,getBigNumber(4), YOR.address,  0) ;  
            pool1 = await chef.poolInfo(lpToken.address, 0)
            const accumulatedAdaSwapYOR = yorr.amount.mul(pool1.accAdaSwapPerShare).div(1e+12)
            let pendingAdaSwap_4 = (accumulatedAdaSwapYOR).sub(getBigNumber(4).mul(pool1.accAdaSwapPerShare));
            const infoAfterYOR = await chef.userInfo(YOR.address, lpToken.address, 0) 
//////////////////////////////

            let bobb = await chef.userInfo(BOB.address, lpTokenSecond.address, 0)
            await chef.connect(BOB)
                .withdrawAndHarvest(lpTokenSecond.address, getBigNumber(4), BOB.address,  0);
            pool = await chef.poolInfo(lpTokenSecond.address, 0)
            const accumulatedAdaSwapBOB = (bobb.amount).mul(pool.accAdaSwapPerShare).div(1e+12)
            let _pendingAdaSwap1 = (accumulatedAdaSwapBOB).sub(getBigNumber(4).mul(pool.accAdaSwapPerShare));
            const infoAfterBOB = await chef.userInfo(BOB.address, lpTokenSecond.address, 0)


            let alicee = await chef.userInfo(ALICE.address, lpTokenSecond.address, 0)
            await chef.connect(ALICE)
                .withdrawAndHarvest(lpTokenSecond.address, getBigNumber(3), ALICE.address, 0);
            pool = await chef.poolInfo(lpTokenSecond.address, 0)
            const accumulatedAdaSwapALICE = (alicee.amount).mul(pool.accAdaSwapPerShare).div(1e+12)
            let _pendingAdaSwap2 = (accumulatedAdaSwapALICE).sub(getBigNumber(3).mul(pool.accAdaSwapPerShare));
            const infoAfterALICE = await chef.userInfo(ALICE.address, lpTokenSecond.address, 0)


            let steavee = await chef.userInfo(STEAVE.address, lpTokenSecond.address, 0)
            await chef.connect(STEAVE)
                .withdrawAndHarvest(lpTokenSecond.address, getBigNumber(2), STEAVE.address, 0);
            pool = await chef.poolInfo(lpTokenSecond.address, 0)
            const accumulatedAdaSwapSTEAVE = (steavee.amount).mul(pool.accAdaSwapPerShare).div(1e+12)
            let _pendingAdaSwap3 = (accumulatedAdaSwapSTEAVE).sub(getBigNumber(2).mul(pool.accAdaSwapPerShare));
            const infoAfterSTEAVE = await chef.userInfo(STEAVE.address, lpTokenSecond.address, 0)


            let samm = await chef.userInfo(SAM.address, lpTokenSecond.address, 0)
            await chef.connect(SAM)
                .withdrawAndHarvest(lpTokenSecond.address,getBigNumber(1), SAM.address,  0) ;  
            pool = await chef.poolInfo(lpTokenSecond.address, 0)
            const accumulatedAdaSwapSAM = (samm.amount).mul(pool.accAdaSwapPerShare).div(1e+12)
            let _pendingAdaSwap4 = (accumulatedAdaSwapSAM).sub(getBigNumber(1).mul(pool.accAdaSwapPerShare));
            const infoAfterSAM = await chef.userInfo(SAM.address, lpTokenSecond.address, 0)

            expect(pendingAdaSwap_1).to.be.eq(infoAfterTOM.rewardDebt);
            expect(pendingAdaSwap_2).to.be.eq(infoAfterGOR.rewardDebt);
            expect(pendingAdaSwap_3).to.be.eq(infoAfterTOR.rewardDebt);
            expect(pendingAdaSwap_4).to.be.eq(infoAfterYOR.rewardDebt);

            expect(_pendingAdaSwap1).to.be.eq(infoAfterBOB.rewardDebt);
            expect(_pendingAdaSwap2).to.be.eq(infoAfterALICE.rewardDebt);
            expect(_pendingAdaSwap3).to.be.eq(infoAfterSTEAVE.rewardDebt);
            expect(_pendingAdaSwap4).to.be.eq(infoAfterSAM.rewardDebt);


        })
        
    })

    describe('4.Fake operations',async()=>{

        it("Should revert if not Onlyowner", async()=>{
            await expect( chef.connect(ALICE).add(15, lpToken.address, 0, rewarder.address))
            .to.be.revertedWith("Ownable: caller is not the owner");

        })

        it("Should revert if 0 Address", async()=>{
            await expect( chef.connect('0x0').add(15, lpToken.address, 0, rewarder.address))
            .to.be.reverted;

        })

        it("Should revert if fake account", async()=>{
            advanceIncreaseTime(3600 * 24 * 14); // to unlock lock time

            pendingAdaSwap1 = await chef.pendingAdaSwap(lpToken.address, BOB.address, 1);
            console.log("1", pendingAdaSwap1);
            await expect( chef.connect(TOM)
                .withdrawAndHarvest(lpToken.address,getBigNumber(10), TOM.address, 1)).to.be.reverted;

        })
    });
});     