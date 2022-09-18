const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");
const {getBigNumber, ADDRESS_ZERO, advanceBlockWithTime } = require("./shared/utils");


use(solidity);

async function advanceIncreaseTime(time) {
    await ethers.provider.send("evm_increaseTime", [time])
    await ethers.provider.send("evm_mine")
}

describe("MasterAdaSwap", function(){
    let lpToken, chef, adaToken, rewarder, fixedTimes, ADMIN, ALICE, BOB, STEAVE, SAM, TOM, GOR,TOR,YOR;

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
        adaToken = await ethers.getContractFactory("AdaSwapToken");
        chef = await ethers.getContractFactory("MasterAdaSwap");
        rewarder = await ethers.getContractFactory("RewarderMock");

        lpToken = await lpToken.connect(ADMIN).deploy("LP Token", "LPT", getBigNumber(10000));
        adaToken = await adaToken.connect(ADMIN).deploy();
        chef = await chef.connect(ADMIN).deploy(adaToken.address, alice.address);
        rewarder = await rewarder.connect(ADMIN).deploy(getBigNumber(1), adaToken.address, chef.address);
        await adaToken.connect(ADMIN).mint(ALICE.address, getBigNumber(12096000000));

        expect(lpToken.deployed);
        expect(adaToken.deployed);
        expect(chef.deployed);
        expect(rewarder.deployed);
    });

    it("2. testMasterAdaSwap: prepare parametrs", async function(){
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
        await adaToken.connect(ALICE).approve(chef.address, getBigNumber(100000000));

        // fixedTimes = await chef.fixedTimes();
    });

    describe('2. Creating pools with different allocation points',()=>{
        it('Create pool with 2-4 users', async()=>{
            // first pool
            // advanceIncreaseTime(3600 * 24 * 14);
            await chef.connect(ADMIN).add(5, lpToken.address, 0, rewarder.address);

            expect((await chef.isExistPool(lpToken.address, 0))).to.be.equal(true);
            expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));

            await lpToken.connect(BOB).approve(chef.address, getBigNumber(10));
            await lpToken.connect(ALICE).approve(chef.address, getBigNumber(10));
            await lpToken.connect(STEAVE).approve(chef.address, getBigNumber(10));
            await lpToken.connect(SAM).approve(chef.address, getBigNumber(10));

            await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(4), 0);
            await chef.connect(ALICE).deposit(lpToken.address, ALICE.address, getBigNumber(3), 0);
            await chef.connect(STEAVE).deposit(lpToken.address, STEAVE.address, getBigNumber(2), 0);
            await chef.connect(SAM).deposit(lpToken.address, SAM.address, getBigNumber(1), 0);

            await advanceIncreaseTime(1);

            pendingAdaSwap1 = await chef.pendingAdaSwap(lpToken.address, BOB.address, 0);
            pendingAdaSwap2 = await chef.pendingAdaSwap(lpToken.address, ALICE.address, 0);
            pendingAdaSwap3 = await chef.pendingAdaSwap(lpToken.address, STEAVE.address, 0);
            pendingAdaSwap4 = await chef.pendingAdaSwap(lpToken.address, SAM.address, 0);

            console.log('1', pendingAdaSwap1);
            console.log('2', pendingAdaSwap2);
            console.log('3', pendingAdaSwap3);
            console.log('4', pendingAdaSwap4);

            expect(pendingAdaSwap1).to.be.equal("24158730158728000000");
            expect(pendingAdaSwap2).to.be.equal("10619047619046000000");
            expect(pendingAdaSwap3).to.be.equal("4222222222222000000");
            expect(pendingAdaSwap4).to.be.equal("1000000000000000000");
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

            console.log('1', pendingAdaSwap1_);
            console.log('2', pendingAdaSwap2_);
            console.log('3', pendingAdaSwap3_);
            console.log('4', pendingAdaSwap4_);

            expect(pendingAdaSwap1_).to.be.equal("10666666666665000000");
            expect(pendingAdaSwap2_).to.be.equal("7999999999998000000");
            expect(pendingAdaSwap3_).to.be.equal("5333333333331000000");
            expect(pendingAdaSwap4_).to.be.equal("2666666666664000000");
        });

    });

    describe('4.Check rewards', async()=>{
        it('Stop Reward counting',async()=>{

            advanceIncreaseTime(3600 * 24 * 7); // to unlock lock time

            await chef.connect(TOM)
                .withdrawAndHarvest(lpToken.address, getBigNumber(1), TOM.address,  0);

            await chef.connect(GOR)
                .withdrawAndHarvest(lpToken.address, getBigNumber(2), GOR.address, 0);

            await chef.connect(TOR)
                .withdrawAndHarvest(lpToken.address, getBigNumber(3), TOR.address, 0);

            await chef.connect(YOR)
                .withdrawAndHarvest(lpToken.address,getBigNumber(4), YOR.address,  0) ;   
//////////////////////////////
            await chef.connect(BOB)
                .withdrawAndHarvest(lpToken.address, getBigNumber(4), BOB.address,  0);

            await chef.connect(ALICE)
                .withdrawAndHarvest(lpToken.address, getBigNumber(3), ALICE.address, 0);

            await chef.connect(STEAVE)
                .withdrawAndHarvest(lpToken.address, getBigNumber(2), STEAVE.address, 0);

            await chef.connect(SAM)
                .withdrawAndHarvest(lpToken.address,getBigNumber(1), SAM.address,  0) ;  

            const balanceAfter = await adaToken.balanceOf(TOM.address);
            console.log('pdp: ', balanceAfter);


            // Ckeck if rewards are still counting
            await advanceIncreaseTime(10000000);
            pendingAdaSwap1_ = await chef.pendingAdaSwap(lpToken.address, TOM.address, 0);
            pendingAdaSwap2_ = await chef.pendingAdaSwap(lpToken.address, GOR.address, 0);
            pendingAdaSwap3_ = await chef.pendingAdaSwap(lpToken.address, TOR.address, 0);
            pendingAdaSwap4_ = await chef.pendingAdaSwap(lpToken.address, YOR.address, 0);

            console.log('1', pendingAdaSwap1_);
            console.log('2', pendingAdaSwap2_);
            console.log('3', pendingAdaSwap3_);
            console.log('4', pendingAdaSwap4_);
            // rewards are not counting after withdrawAndHarvest.
        })
        
    })

    describe('3.Fake operations',async()=>{

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