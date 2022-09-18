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
        await adaToken.connect(ADMIN).mint(ALICE.address, getBigNumber(12096000000));

        expect(lpToken.deployed);
        expect(lpTokenSecond.deployed);
        expect(lpTokenThird.deployed);
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


        await lpTokenSecond.approve(chef.address, getBigNumber(100));
        await lpTokenSecond.transfer(BOB.address, getBigNumber(100));
        await lpTokenSecond.transfer(ALICE.address, getBigNumber(100));
        await lpTokenSecond.transfer(STEAVE.address, getBigNumber(100));
        await lpTokenSecond.transfer(SAM.address, getBigNumber(100));
        await lpTokenSecond.transfer(TOM.address, getBigNumber(100));
        await lpTokenSecond.transfer(GOR.address, getBigNumber(30));
        await lpTokenSecond.transfer(TOR.address, getBigNumber(30));
        await lpTokenSecond.transfer(YOR.address, getBigNumber(30));


        await lpTokenThird.approve(chef.address, getBigNumber(100));
        await lpTokenThird.transfer(BOB.address, getBigNumber(100));
        await lpTokenThird.transfer(ALICE.address, getBigNumber(100));
        await lpTokenThird.transfer(STEAVE.address, getBigNumber(100));
        await lpTokenThird.transfer(SAM.address, getBigNumber(100));
        await lpTokenThird.transfer(TOM.address, getBigNumber(100));
        await lpTokenThird.transfer(GOR.address, getBigNumber(30));
        await lpTokenThird.transfer(TOR.address, getBigNumber(30));
        await lpTokenThird.transfer(YOR.address, getBigNumber(30));
        // fixedTimes = await chef.fixedTimes();
    });



    describe('3. Creating pools with different time lock', async()=>{

        it('Pool with time lock - 14 days', async()=>{
            // first pool
            // lock time - 14 days
            await chef.connect(ADMIN).add(5, lpToken.address, 1, rewarder.address);

            expect((await chef.isExistPool(lpToken.address, 1))).to.be.equal(true);
            expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));

            await lpToken.connect(BOB).approve(chef.address, getBigNumber(10));
            await lpToken.connect(ALICE).approve(chef.address, getBigNumber(10));
            await lpToken.connect(STEAVE).approve(chef.address, getBigNumber(10));

            
            await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(5), 1);
            await chef.connect(ALICE).deposit(lpToken.address, ALICE.address, getBigNumber(4), 1);
            await chef.connect(STEAVE).deposit(lpToken.address, STEAVE.address, getBigNumber(3), 1);
            
            await advanceIncreaseTime(1);
  
            pendingAdaSwap1 = await chef.pendingAdaSwap(lpToken.address, BOB.address, 1);
            pendingAdaSwap2 = await chef.pendingAdaSwap(lpToken.address, ALICE.address, 1);
            pendingAdaSwap3 = await chef.pendingAdaSwap(lpToken.address, STEAVE.address, 1);


            console.log('1', pendingAdaSwap1);
            console.log('2', pendingAdaSwap2);
            console.log('3', pendingAdaSwap3);

            // expect(pendingAdaSwap1).to.be.equal("19722222222220000000");
            // expect(pendingAdaSwap2).to.be.equal("7777777777776000000");
            // expect(pendingAdaSwap3).to.be.equal("2499999999999000000");
            
        });

        it('Pool with time lock - 60 days',async()=>{
            await chef.connect(ADMIN).add(10, lpTokenSecond.address, 3, rewarder.address);

            expect((await chef.isExistPool(lpTokenSecond.address, 3))).to.be.equal(true);
            expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));

            await lpTokenSecond.connect(TOM).approve(chef.address, getBigNumber(10));
            await lpTokenSecond.connect(GOR).approve(chef.address, getBigNumber(10));
            await lpTokenSecond.connect(TOR).approve(chef.address, getBigNumber(10));
            await lpTokenSecond.connect(YOR).approve(chef.address, getBigNumber(10));

            await chef.connect(TOM).deposit(lpTokenSecond.address, TOM.address, getBigNumber(1), 3);
            await chef.connect(GOR).deposit(lpTokenSecond.address, GOR.address, getBigNumber(2), 3);
            await chef.connect(TOR).deposit(lpTokenSecond.address, TOR.address, getBigNumber(3), 3);
            await chef.connect(YOR).deposit(lpTokenSecond.address, YOR.address, getBigNumber(4), 3);

            await advanceIncreaseTime(1);

            pendingAdaSwap1_ = await chef.pendingAdaSwap(lpTokenSecond.address, TOM.address, 3);
            pendingAdaSwap2_ = await chef.pendingAdaSwap(lpTokenSecond.address, GOR.address, 3);
            pendingAdaSwap3_ = await chef.pendingAdaSwap(lpTokenSecond.address, TOR.address, 3);
            pendingAdaSwap4_ = await chef.pendingAdaSwap(lpTokenSecond.address, YOR.address, 3);

            console.log('1', pendingAdaSwap1_);
            console.log('2', pendingAdaSwap2_);
            console.log('3', pendingAdaSwap3_);
            console.log('4', pendingAdaSwap4_);

            // expect(pendingAdaSwap1_).to.be.equal("10666666666665000000");
            // expect(pendingAdaSwap2_).to.be.equal("7999999999998000000");
            // expect(pendingAdaSwap3_).to.be.equal("5333333333331000000");
            // expect(pendingAdaSwap4_).to.be.equal("2666666666664000000");
        })

        it('Pool with time lock - 365 days ', async()=>{

            await chef.connect(ADMIN).add(5, lpTokenThird.address, 5, rewarder.address);

            expect((await chef.isExistPool(lpTokenThird.address, 5))).to.be.equal(true);
            expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));

            await lpTokenThird.connect(BOB).approve(chef.address, getBigNumber(10));
            await lpTokenThird.connect(ALICE).approve(chef.address, getBigNumber(10));
            await lpTokenThird.connect(STEAVE).approve(chef.address, getBigNumber(10));

            await chef.connect(BOB).deposit(lpTokenThird.address, BOB.address, getBigNumber(5), 5);
            await chef.connect(ALICE).deposit(lpTokenThird.address, ALICE.address, getBigNumber(4), 5);
            await chef.connect(STEAVE).deposit(lpTokenThird.address, STEAVE.address, getBigNumber(3), 5);

            await advanceIncreaseTime(1);
            
            _pendingAdaSwap1 = await chef.pendingAdaSwap(lpTokenThird.address, BOB.address, 5);
            _pendingAdaSwap2 = await chef.pendingAdaSwap(lpTokenThird.address, ALICE.address, 5);
            _pendingAdaSwap3 = await chef.pendingAdaSwap(lpTokenThird.address, STEAVE.address, 5);

            console.log('1', _pendingAdaSwap1);
            console.log('2', _pendingAdaSwap2);
            console.log('3', _pendingAdaSwap3);   
        })


        it('4. Check reward after 365 days', async()=>{
            advanceIncreaseTime(3600 * 24 * 365);
            
            _pendingAdaSwap1 = await chef.pendingAdaSwap(lpTokenThird.address, BOB.address, 5);
            _pendingAdaSwap2 = await chef.pendingAdaSwap(lpTokenThird.address, ALICE.address, 5);
            _pendingAdaSwap3 = await chef.pendingAdaSwap(lpTokenThird.address, STEAVE.address, 5);

            console.log('1', _pendingAdaSwap1);
            console.log('2', _pendingAdaSwap2);
            console.log('3', _pendingAdaSwap3);

            expect(_pendingAdaSwap1).to.be.equal("32850004930555555550000000");
            expect(_pendingAdaSwap2).to.be.equal("26280001944444444440000000");
            expect(_pendingAdaSwap3).to.be.equal("19710000624999999999000000");
        });

        it('5. Check reward after 60 days', async()=>{
            advanceIncreaseTime(3600 * 24 * 60);
            
            pendingAdaSwap1_ = await chef.pendingAdaSwap(lpTokenSecond.address, TOM.address, 3);
            pendingAdaSwap2_ = await chef.pendingAdaSwap(lpTokenSecond.address, GOR.address, 3);
            pendingAdaSwap3_ = await chef.pendingAdaSwap(lpTokenSecond.address, TOR.address, 3);
            pendingAdaSwap4_ = await chef.pendingAdaSwap(lpTokenSecond.address, YOR.address, 3);

            console.log('1', pendingAdaSwap1_);
            console.log('2', pendingAdaSwap2_);
            console.log('3', pendingAdaSwap3_);
            console.log('4', pendingAdaSwap4_);

            expect(pendingAdaSwap1_).to.be.equal("18360014499999999999000000");
            expect(pendingAdaSwap2_).to.be.equal("36720015666666666666000000");
            expect(pendingAdaSwap3_).to.be.equal("55080016833333333333000000");
            expect(pendingAdaSwap4_).to.be.equal("73440018000000000000000000");


        });

        it('6. Check reward after 14 days', async()=>{
            advanceIncreaseTime(3600 * 24 * 14);
            
            pendingAdaSwap1 = await chef.pendingAdaSwap(lpToken.address, BOB.address, 1);
            pendingAdaSwap2 = await chef.pendingAdaSwap(lpToken.address, ALICE.address, 1);
            pendingAdaSwap3 = await chef.pendingAdaSwap(lpToken.address, STEAVE.address, 1);

            console.log('1', pendingAdaSwap1);
            console.log('2', pendingAdaSwap2);
            console.log('3', pendingAdaSwap3);

            expect(pendingAdaSwap1).to.be.equal("39510035347222222220000000");
            expect(pendingAdaSwap2).to.be.equal("31608020277777777776000000");
            expect(pendingAdaSwap3).to.be.equal("23706011874999999999000000");


        });
    })
});