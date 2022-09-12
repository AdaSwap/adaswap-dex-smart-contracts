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
    let lpToken, chef, adaToken, rewarder, fixedTimes, ADMIN, ALICE, BOB, STEAVE;

    before((done) => {
        setTimeout(done, 2000);
    });
    
    it("1. testMasterAdaSwap: Deploy contracts", async function(){
        const [admin, alice, bob, steave] = await ethers.getSigners();
        ADMIN = admin;
        ALICE = alice;
        BOB = bob;
        STEAVE = steave;
        
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
        await lpToken.approve(chef.address, getBigNumber(10));
        await chef.setAdaSwapPerSecond(getBigNumber(10));
        await lpToken.transfer(BOB.address, getBigNumber(10));
        await lpToken.transfer(ALICE.address, getBigNumber(10));
        await lpToken.transfer(STEAVE.address, getBigNumber(10));
        await adaToken.connect(ALICE).approve(chef.address, getBigNumber(100000000));

        // fixedTimes = await chef.fixedTimes();
    });

    it("3. Pool should exist", async function () {
        await chef.connect(ADMIN).add(15, lpToken.address, 0, rewarder.address)

        expect((await chef.isExistPool(lpToken.address, 0))).to.be.equal(true);
        expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));
      }) 

    it("4. PendingAdaSwap should equal ExpectedAdaSwap", async function () {
        await lpToken.connect(BOB).approve(chef.address, getBigNumber(10));
        expect((await chef.isExistPool(lpToken.address, 0))).to.be.equal(true);

        const log1 =  await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(1), 0);
        let timestamp1 = (await ethers.provider.getBlock(log1.blockNumber)).timestamp;
        await advanceIncreaseTime(10);
        const log2 = await chef.connect(BOB).updatePool(lpToken.address, 0);
        let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp;

        pendingAdaSwap = await chef.pendingAdaSwap(lpToken.address, BOB.address, 0);
        const expectedAdaSwap = getBigNumber(10).mul(timestamp2 - timestamp1);
        expect(pendingAdaSwap).to.be.equal(expectedAdaSwap);
      })


    describe('5. Deposit', () => { 
        it('Deposit 1 lp token', async () => {
            await lpToken.connect(ALICE).approve(chef.address, getBigNumber(10));
            await expect(chef.connect(ALICE)
                .deposit(lpToken.address, ALICE.address, getBigNumber(4), 0))
                .to.emit(chef, "Deposit");
        });

        it('Deposit does not exist', async () => {
            await expect(chef.connect(ALICE)
                .deposit(lpToken.address, ALICE.address, getBigNumber(4), 2))
                .to.be.revertedWith('MasterAdaSwap: POOL_DOES_NOT_EXIST');
        });
    });

    describe('6. Withdraw', () => { 
        it('Withdraw 10 amount lock time is not over', async () => {
            await expect(chef.connect(BOB)
                .withdraw(lpToken.address, BOB.address, getBigNumber(1), 0))
                .to.revertedWith('MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER');
        });

        it('Withdraw 10 amount', async () => {
            advanceIncreaseTime(3600 * 24 * 7); // to unlock lock time
            await chef.connect(BOB)
                .withdraw(lpToken.address, BOB.address, getBigNumber(1), 0)
            pendingAdaSwap = await chef.pendingAdaSwap(lpToken.address, BOB.address, 0);
            let userInfo = await chef.userInfo(BOB.address, lpToken.address, 0);
            expect('-'+pendingAdaSwap).to.be.eq(userInfo.rewardDebt);
        });

        it('Withdraw 0 amount', async () => {
            await expect(chef.connect(ALICE)
                .withdraw(lpToken.address, ALICE.address, getBigNumber(0), 0))
                .to.emit(chef, "Withdraw");
        });
    });

    describe('7. Harvest', () => { 
        it('Harvest lock time is not over', async () => {
            expect((await chef.isExistPool(lpToken.address, 1))).to.be.equal(false);
            await chef.connect(ADMIN).add(15, lpToken.address, 1, rewarder.address);
            expect((await chef.isExistPool(lpToken.address, 1))).to.be.equal(true);
            const log1 =  await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(1), 1);
            await expect(chef.connect(BOB)
                .harvest(lpToken.address, BOB.address, 1))
                .to.revertedWith('MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER');
        });

        it('Harvest ', async () => {
            advanceIncreaseTime(3600 * 24 * 14); // to unlock lock time
            pendingAdaSwap = await chef.pendingAdaSwap(lpToken.address, BOB.address, 1);
            const balanceBefore = await adaToken.balanceOf(BOB.address);
            await chef.connect(BOB)
                .harvest(lpToken.address, BOB.address, 1);
            const balanceAfter = await adaToken.balanceOf(BOB.address);
            expect(balanceAfter.toString()).to.be.eq(balanceBefore.add(pendingAdaSwap).toString());
            // console.log('pdppdpdpd: ', pendingAdaSwap);

        });

    });

    describe('8. Emergency Withdraw', () => { 
        
    });
})

   // await lpToken.connect(BOB).approve(chef.address, getBigNumber(10));
        // await lpToken.connect(ALICE).approve(chef.address, getBigNumber(10));
        // await lpToken.connect(STEAVE).approve(chef.address, getBigNumber(10));

        // expect((await chef.isExistPool(lpToken.address, 0))).to.be.equal(true);
        // const log1 =  await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(1), 0);
        // // await chef.connect(ALICE).deposit(lpToken.address, ALICE.address, getBigNumber(1), 0);
        // // const log3 =  await chef.connect(STEAVE).deposit(lpToken.address, STEAVE.address, getBigNumber(1), 0);

        // let timestamp1 = (await ethers.provider.getBlock(log1.blockNumber)).timestamp;
        // console.log('timestamp1: ', timestamp1);
        // await advanceIncreaseTime(10);
        // const log2 = await chef.connect(BOB).updatePool(lpToken.address, 0);
        // let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp;
        // pendingAdaSwap = await chef.pendingAdaSwap(lpToken.address, BOB.address, 0);
        // const expectedAdaSwap = getBigNumber(10).mul(timestamp2 - timestamp1);
        // expect(pendingAdaSwap).to.be.equal(expectedAdaSwap);
        
        // let userInfo = await chef.userInfo(BOB.address, lpToken.address, 0);
        // let poolInfo = await chef.poolInfo(lpToken.address, 0);
        // console.log('pendingAdaSwap: ',pendingAdaSwap);
        // console.log('userInfo: ', userInfo);
        // console.log('poolInfo: ', poolInfo);
        // console.log('timestamp1', timestamp1);
        // console.log('timestamp2', timestamp2);
        // console.log('expectedAdaSwap', expectedAdaSwap);
        // log2 = await this.chef.updatePool(0)
        // let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp
        // let expectedAdaSwap = BigNumber.from("10000000000000000").mul(timestamp2 - timestamp)
        // let pendingAdaSwap = await this.chef.pendingAdaSwap(0, this.alice.address)
        // expect(pendingAdaSwap).to.be.equal(expectedAdaSwap)