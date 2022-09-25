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
    let lpToken, chef, adaToken, rewarder, fixedTimes, ADMIN, ALICE, BOB, STEAVE, SAM, TOM, GOR,TOR,YOR,J,K,L;

    before((done) => {
        setTimeout(done, 2000);
    });
    
    it("33. testMasterAdaSwap: Deploy contracts", async function(){
        const [admin, alice, bob, steave,sam,tom,gor,tor,yor,j,k,l] = await ethers.getSigners();
        ADMIN = admin;
        ALICE = alice;
        BOB = bob;
        STEAVE = steave;
        SAM= sam;
        TOM = tom;
        GOR= gor;
        TOR= tor;
        YOR= yor;
        J=j;
        K=k;
        L=l;


        lpToken = await ethers.getContractFactory("ERC20Mock");
        lpTokenSecond = await ethers.getContractFactory("ERC20Mock");
        lpTokenThird = await ethers.getContractFactory("ERC20Mock");
        adaToken = await ethers.getContractFactory("AdaSwapToken");
        chef = await ethers.getContractFactory("MasterAdaSwap");
        rewarder = await ethers.getContractFactory("RewarderMock");

        lpToken = await lpToken.connect(ADMIN).deploy("LP Token", "LPT", getBigNumber(10000));
        lpTokenSecond =await lpTokenSecond.connect(ADMIN).deploy("LP Toke", "LPE", getBigNumber(10000));
        lpTokenThird =await lpTokenThird.connect(ADMIN).deploy("LP TokeT", "LPW", getBigNumber(10000));
        adaToken = await adaToken.connect(ADMIN).deploy();
        chef = await chef.connect(ADMIN).deploy(adaToken.address, alice.address);
        rewarder = await rewarder.connect(ADMIN).deploy(getBigNumber(1), adaToken.address, chef.address);
        await adaToken.connect(ADMIN).mint(ALICE.address, getBigNumber(1209600000000));

        expect(lpToken.deployed);
        expect(lpTokenSecond.deployed);
        expect(lpTokenThird.deployed);
        expect(adaToken.deployed);
        expect(chef.deployed);
        expect(rewarder.deployed);
    });

    it("34. testMasterAdaSwap: prepare parametrs", async function(){
        await adaToken.transferOwnership(chef.address);
        await lpToken.approve(chef.address, getBigNumber(100));
        await chef.setAdaSwapPerSecond(getBigNumber(10));
        await lpToken.transfer(BOB.address, getBigNumber(100));
        await lpToken.transfer(ALICE.address, getBigNumber(100));
        await lpToken.transfer(STEAVE.address, getBigNumber(100));
        await lpToken.transfer(SAM.address, getBigNumber(100));
        await lpToken.transfer(TOM.address, getBigNumber(100));
        await lpToken.transfer(GOR.address, getBigNumber(30));
        await lpToken.transfer(TOR.address, getBigNumber(30));
        await lpToken.transfer(YOR.address, getBigNumber(30));
        await adaToken.connect(ALICE).approve(chef.address, getBigNumber(100000000000));


        await lpTokenSecond.approve(chef.address, getBigNumber(100));
        await lpTokenSecond.transfer(BOB.address, getBigNumber(100));
        await lpTokenSecond.transfer(ALICE.address, getBigNumber(100));
        await lpTokenSecond.transfer(STEAVE.address, getBigNumber(100));
        await lpTokenSecond.transfer(SAM.address, getBigNumber(100));
        await lpTokenSecond.transfer(TOM.address, getBigNumber(100));
        await lpTokenSecond.transfer(GOR.address, getBigNumber(30));
        await lpTokenSecond.transfer(TOR.address, getBigNumber(30));
        await lpTokenSecond.transfer(YOR.address, getBigNumber(30));

        await lpTokenThird.approve(chef.address, getBigNumber(10000000000000));
        await lpTokenThird.transfer(J.address, getBigNumber(3000));
        await lpTokenThird.transfer(K.address, getBigNumber(3000));
        await lpTokenThird.transfer(L.address, getBigNumber(3000));

        // fixedTimes = await chef.fixedTimes();
    });



    describe('Creating pools with different time lock', async()=>{

        it('35. testMasterAdaSwap: Pool with time lock - 14 days', async()=>{
            // first pool
            // lock time - 14 days
            await chef.connect(ADMIN).add(5, lpToken.address, 1, rewarder.address);

            expect((await chef.isExistPool(lpToken.address, 1))).to.be.equal(true);
            expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));

            await lpToken.connect(BOB).approve(chef.address, getBigNumber(15));
            await lpToken.connect(ALICE).approve(chef.address, getBigNumber(15));
            await lpToken.connect(STEAVE).approve(chef.address, getBigNumber(15));
    
         await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(5), 1);
         await chef.connect(ALICE).deposit(lpToken.address, ALICE.address, getBigNumber(4), 1);
         await chef.connect(STEAVE).deposit(lpToken.address, STEAVE.address, getBigNumber(3), 1);
     
        });

        it('36. testMasterAdaSwap: Pool with time lock - 60 days',async()=>{
            await chef.connect(ADMIN).add(10, lpTokenSecond.address, 3, rewarder.address);

            expect((await chef.isExistPool(lpTokenSecond.address, 3))).to.be.equal(true);
            expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));

            await lpTokenSecond.connect(TOM).approve(chef.address, getBigNumber(15));
            await lpTokenSecond.connect(GOR).approve(chef.address, getBigNumber(15));
            await lpTokenSecond.connect(TOR).approve(chef.address, getBigNumber(15));
            await lpTokenSecond.connect(YOR).approve(chef.address, getBigNumber(15));

            await chef.connect(TOM).deposit(lpTokenSecond.address, TOM.address, getBigNumber(1), 3);
            await chef.connect(GOR).deposit(lpTokenSecond.address, GOR.address, getBigNumber(2), 3);
            await chef.connect(TOR).deposit(lpTokenSecond.address, TOR.address, getBigNumber(3), 3);
            await chef.connect(YOR).deposit(lpTokenSecond.address, YOR.address, getBigNumber(4), 3);

        })

        it('37. testMasterAdaSwap: Pool with time lock - 365 days ', async()=>{

            await chef.connect(ADMIN).add(5, lpTokenThird.address, 5, rewarder.address);

            expect((await chef.isExistPool(lpTokenThird.address, 5))).to.be.equal(true);
            expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));

            await lpTokenThird.connect(J).approve(chef.address, getBigNumber(150000));
            await lpTokenThird.connect(K).approve(chef.address, getBigNumber(150000));
            await lpTokenThird.connect(L).approve(chef.address, getBigNumber(150000));

            await chef.connect(J).deposit(lpTokenThird.address, J.address, getBigNumber(5), 5);
            await chef.connect(K).deposit(lpTokenThird.address, K.address, getBigNumber(4), 5);
            await chef.connect(L).deposit(lpTokenThird.address, L.address, getBigNumber(3), 5);
  
        })

        it('38. testMasterAdaSwap: Check reward after 60 days', async()=>{
            advanceIncreaseTime(3600 * 24 * 60);

            let tom = await chef.userInfo(TOM.address, lpTokenSecond.address, 3)
            await chef.connect(TOM).harvest(lpTokenSecond.address, TOM.address, 3)     
            let pool1 = await chef.poolInfo(lpTokenSecond.address, 3)
            let accumulatedAdaSwapTOM = tom.amount.mul(pool1.accAdaSwapPerShare).div(1e+12)
            let infoAfterTOM = await chef.userInfo(TOM.address, lpTokenSecond.address, 3)
            

            let gor = await chef.userInfo(GOR.address, lpTokenSecond.address, 3)
            await chef.connect(GOR).harvest(lpTokenSecond.address, GOR.address, 3)
            pool1 = await chef.poolInfo(lpTokenSecond.address, 3)
            let accumulatedAdaSwapGOR = gor.amount.mul(pool1.accAdaSwapPerShare).div(1e+12)
            let infoAfterGOR = await chef.userInfo(GOR.address, lpTokenSecond.address, 3);

            let tor = await chef.userInfo(TOR.address, lpTokenSecond.address, 3) 
            await chef.connect(TOR).harvest(lpTokenSecond.address, TOR.address, 3)      
            pool1 = await chef.poolInfo(lpTokenSecond.address, 3)
            let accumulatedAdaSwapTOR = tor.amount.mul(pool1.accAdaSwapPerShare).div(1e+12)
            let infoAfterTOR = await chef.userInfo(TOR.address, lpTokenSecond.address, 3)

            let yor = await chef.userInfo(YOR.address, lpTokenSecond.address, 3) 
            await chef.connect(YOR).harvest(lpTokenSecond.address, YOR.address, 3)      
            pool1 = await chef.poolInfo(lpTokenSecond.address, 3)
            let accumulatedAdaSwapYOR = yor.amount.mul(pool1.accAdaSwapPerShare).div(1e+12)
            let infoAfterYOR = await chef.userInfo(YOR.address, lpTokenSecond.address, 3)

            expect(infoAfterTOM.rewardDebt).to.eq(accumulatedAdaSwapTOM);
            expect(infoAfterGOR.rewardDebt).to.eq(accumulatedAdaSwapGOR);
            expect(infoAfterTOR.rewardDebt).to.eq(accumulatedAdaSwapTOR);
            expect(infoAfterYOR.rewardDebt).to.eq(accumulatedAdaSwapYOR);

        });

        it('39. testMasterAdaSwap: Check reward after 14 days', async()=>{
            
            advanceIncreaseTime(3600 * 24 * 14);

            let bob = await chef.userInfo(BOB.address, lpToken.address, 1)
            await chef.connect(BOB).harvest(lpToken.address, BOB.address, 1)     
            let pool = await chef.poolInfo(lpToken.address, 1)
            let accumulatedAdaSwapBOB = bob.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
            let infoAfterBOB = await chef.userInfo(BOB.address, lpToken.address, 1)
            

            let alice = await chef.userInfo(ALICE.address, lpToken.address, 1)
            await chef.connect(ALICE).harvest(lpToken.address, ALICE.address, 1)
            pool = await chef.poolInfo(lpToken.address, 1)
            let accumulatedAdaSwapALICE = alice.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
            let infoAfterALICE = await chef.userInfo(ALICE.address, lpToken.address, 1);

            let steave = await chef.userInfo(STEAVE.address, lpToken.address, 1) 
            await chef.connect(STEAVE).harvest(lpToken.address, STEAVE.address, 1)      
            pool = await chef.poolInfo(lpToken.address, 1)
            let accumulatedAdaSwapSTEAVE = steave.amount.mul(pool.accAdaSwapPerShare).div(1e+12)
            let infoAfterSTEAVE = await chef.userInfo(STEAVE.address, lpToken.address, 1)

            expect(infoAfterBOB.rewardDebt).to.eq(accumulatedAdaSwapBOB);
            expect(infoAfterALICE.rewardDebt).to.eq(accumulatedAdaSwapALICE);
            expect(infoAfterSTEAVE.rewardDebt).to.eq(accumulatedAdaSwapSTEAVE);

        });

        
        it('40. testMasterAdaSwap: Check reward after 365 days', async()=>{
   
            advanceIncreaseTime(3600 * 24 * 365);

            let j = await chef.userInfo(J.address, lpTokenThird.address, 5);
            await chef.connect(J).harvest(lpTokenThird.address, J.address, 5);
            let pool3 = await chef.poolInfo(lpTokenThird.address, 5);
            let accumulatedAdaSwapBOB_ = j.amount.mul(pool3.accAdaSwapPerShare).div(1e+12);
            let infoAfterBOB_ = await chef.userInfo(J.address, lpTokenThird.address, 5);
            

            let k = await chef.userInfo(K.address, lpTokenThird.address, 5);
            await chef.connect(K).harvest(lpTokenThird.address, K.address, 5);
            pool3 = await chef.poolInfo(lpTokenThird.address, 5);
            let accumulatedAdaSwapALICE_ = k.amount.mul(pool3.accAdaSwapPerShare).div(1e+12);
            let infoAfterALICE_ = await chef.userInfo(K.address, lpTokenThird.address, 5);


            let l = await chef.userInfo(L.address, lpTokenThird.address, 5) 
            await chef.connect(L).harvest(lpTokenThird.address, L.address, 5)      
            pool3 = await chef.poolInfo(lpTokenThird.address, 5)
            let accumulatedAdaSwapSTEAVE_ = l.amount.mul(pool3.accAdaSwapPerShare).div(1e+12)
            let infoAfterSTEAVE_ = await chef.userInfo(L.address, lpTokenThird.address, 5)

            expect(infoAfterBOB_.rewardDebt).to.eq(accumulatedAdaSwapBOB_);
            expect(infoAfterALICE_.rewardDebt).to.eq(accumulatedAdaSwapALICE_);
            expect(infoAfterSTEAVE_.rewardDebt).to.eq(accumulatedAdaSwapSTEAVE_);

        });
    })
});