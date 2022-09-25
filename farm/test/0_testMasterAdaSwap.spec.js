const { ethers } = require("hardhat");
const { use, expect } = require("chai");
const { solidity } = require("ethereum-waffle");
const { getBigNumber } = require("./shared/utils");
const { BigNumber } = require("ethers");

use(solidity);

async function advanceIncreaseTime(time) {
    await ethers.provider.send("evm_increaseTime", [time])
    await ethers.provider.send("evm_mine")
}

describe("MasterAdaSwap", function(){
    let lpToken, chef, adaToken, rewarder, ADMIN, ALICE, BOB, STEAVE;

    before((done) => {
        setTimeout(done, 2000);
    });
    
    it("0. testMasterAdaSwap: Deploy contracts", async function(){
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

    it("1. testMasterAdaSwap: prepare parametrs", async function(){
        await adaToken.transferOwnership(chef.address);
        await lpToken.approve(chef.address, getBigNumber(100));
        await chef.setAdaSwapPerSecond(getBigNumber(10));
        await lpToken.transfer(BOB.address, getBigNumber(100));
        await lpToken.transfer(ALICE.address, getBigNumber(100));
        await lpToken.transfer(STEAVE.address, getBigNumber(100));
        await adaToken.connect(ALICE).approve(chef.address, getBigNumber(100000000));
    });

    it("2. testMasterAdaSwap:  Pool should exist", async function () {
        await chef.connect(ADMIN).add(15, lpToken.address, 0, rewarder.address)

        expect((await chef.isExistPool(lpToken.address, 0))).to.be.equal(true);
        expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));
      }) 

    it("3. testMasterAdaSwap: PendingAdaSwap should equal ExpectedAdaSwap", async function () {
        await lpToken.connect(BOB).approve(chef.address, getBigNumber(10000));
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


    describe('Deposit', () => { 
        it('4. testMasterAdaSwap:  Deposit 1 lp token', async () => {
            await lpToken.connect(ALICE).approve(chef.address, getBigNumber(10000));
            await expect(chef.connect(ALICE)
                .deposit(lpToken.address, ALICE.address, getBigNumber(4), 0))
                .to.emit(chef, "Deposit");
        });

        it('5. testMasterAdaSwap:  Deposit does not exist', async () => {
            await expect(chef.connect(ALICE)
                .deposit(lpToken.address, ALICE.address, getBigNumber(4), 2))
                .to.be.revertedWith('MasterAdaSwap: POOL_DOES_NOT_EXIST');
        });
    });

    describe('Withdraw', () => { 
        it('6. testMasterAdaSwap: Withdraw 10 amount lock time is not over', async () => {
            await expect(chef.connect(BOB)
                .withdraw(lpToken.address, BOB.address, getBigNumber(1), 0))
                .to.revertedWith('MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER');
        });

        it('7. testMasterAdaSwap: Withdraw 10 amount', async () => {
            await advanceIncreaseTime(3600 * 24 * 7); // to unlock lock time
            await chef.connect(BOB)
                .withdraw(lpToken.address, BOB.address, getBigNumber(1), 0)
            pendingAdaSwap = await chef.pendingAdaSwap(lpToken.address, BOB.address, 0);
            let userInfo = await chef.userInfo(BOB.address, lpToken.address, 0);
            expect('-'+pendingAdaSwap).to.be.eq(userInfo.rewardDebt);
        });

        it('8. testMasterAdaSwap: Withdraw 0 amount', async () => {
            await expect(chef.connect(ALICE)
                .withdraw(lpToken.address, ALICE.address, getBigNumber(0), 0))
                .to.emit(chef, "Withdraw");
        });
    });

    describe('Harvest', () => { 
        it('9. testMasterAdaSwap: Harvest lock time is not over', async () => {
            expect((await chef.isExistPool(lpToken.address, 1))).to.be.equal(false);
            await chef.connect(ADMIN).add(15, lpToken.address, 1, rewarder.address);
            expect((await chef.isExistPool(lpToken.address, 1))).to.be.equal(true);
            await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(1), 1);
            await expect(chef.connect(BOB)
                .harvest(lpToken.address, BOB.address, 1))
                .to.revertedWith('MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER');
        });

        
        it('10. testMasterAdaSwap: Should give back the correct amount of reward', async () => {
            await advanceIncreaseTime(3600 * 24 * 14); // to unlock lock time

            const balanceBefore = await adaToken.balanceOf(BOB.address);
            
            const info = await chef.poolInfo(lpToken.address, 1)
            const timestamp1 = info.lastRewardTime
            
            const tx = await chef.connect(BOB).harvest(lpToken.address, BOB.address, 1);
            await tx.wait()
            
            const timestamp2 = (await ethers.provider.getBlock(tx.blockNumber)).timestamp
            const balanceAfter = await adaToken.balanceOf(BOB.address);
            
            let pendingAdaSwap = getBigNumber((timestamp2 - timestamp1) * 15 / 30 * 10);
            
            expect(balanceAfter).to.be.eq(balanceBefore.add(pendingAdaSwap));
            
            await expect(tx)
                .to.emit(chef, 'Harvest')
                .withArgs(BOB.address, lpToken.address, balanceBefore.add(pendingAdaSwap), 1);
        });
        
        it('11. testMasterAdaSwap: Harvest with empty user balance', async () => {
            await chef.connect(ALICE).deposit(lpToken.address, ALICE.address, getBigNumber(0), 1);
            await advanceIncreaseTime(3600 * 24 * 14)
            const tx = await chef.connect(ALICE).harvest(lpToken.address, ALICE.address, 1)
            await tx.wait()

            await expect(tx)
                .to.emit(chef, 'Harvest')
                .withArgs(ALICE.address, lpToken.address, getBigNumber(0), 1);
        });
    });

    describe('Emergency Withdraw', () => {         
        it("12. testMasterAdaSwap: Lock time is not over", async () => {
            const tx = await chef.connect(ALICE).emergencyWithdraw(lpToken.address, ALICE.address, 0)
            await tx.wait()

            const info = await chef.userInfo(ALICE.address, lpToken.address, 0)
            expect(info.amount).to.eq(0)
            expect(info.rewardDebt).to.eq(0)

            await expect(tx)
                .to.emit(chef, 'EmergencyWithdraw')
                .withArgs(ALICE.address, lpToken.address, getBigNumber(4), 0, ALICE.address)
        })

        it("13. testMasterAdaSwap: Lock time is over", async () => {
            await lpToken.connect(STEAVE).approve(chef.address, getBigNumber(10000));
            await chef.connect(STEAVE).deposit(lpToken.address, STEAVE.address, getBigNumber(20), 0)
            
            await advanceIncreaseTime(3600 * 24 * 7)
            
            const tx = await chef.connect(STEAVE).emergencyWithdraw(lpToken.address, STEAVE.address, 0);
            await tx.wait()
            
            const info = await chef.userInfo(STEAVE.address, lpToken.address, 0)
            expect(info.amount).to.eq(0)
            expect(info.rewardDebt).to.eq(0)

            await expect(tx)
                .to.emit(chef, 'EmergencyWithdraw')
                .withArgs(STEAVE.address, lpToken.address, getBigNumber(20), 0, STEAVE.address)
        })

        it("14. testMasterAdaSwap: Transfer amount is zero", async () => {
            const tx = await chef.connect(ALICE).emergencyWithdraw(lpToken.address, ALICE.address, 0)
            await tx.wait()

            await expect(tx)
                .to.emit(chef, 'EmergencyWithdraw')
                .withArgs(ALICE.address, lpToken.address, getBigNumber(0), 0, ALICE.address)
        })

    });

    describe('Withdraw And Harvest', () => {
        it('15. testMasterAdaSwap: Lock time is not over', async () => {
            expect((await chef.isExistPool(lpToken.address, 2))).to.be.false;
            await chef.connect(ADMIN).add(40, lpToken.address, 2, rewarder.address);
            expect((await chef.isExistPool(lpToken.address, 2))).to.be.true;
            
            await chef.connect(STEAVE).deposit(lpToken.address, STEAVE.address, getBigNumber(7), 2);
            
            await expect(chef.connect(STEAVE)
                .withdrawAndHarvest(lpToken.address, getBigNumber(2), STEAVE.address, 2))
                .to.revertedWith('MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER');
        })

        it('16. testMasterAdaSwap: Withdrawal of nonzero amount', async () => {
            await advanceIncreaseTime(3600 * 24 * 30); // to unlock lock time

            const userInfoBefore = await chef.userInfo(STEAVE.address, lpToken.address, 2)
            
            const tx = await chef.connect(STEAVE)
                .withdrawAndHarvest(lpToken.address, getBigNumber(3), STEAVE.address, 2)
            await tx.wait()

            const pool = await chef.poolInfo(lpToken.address, 2)
            const accumulatedAdaSwap = (userInfoBefore.amount).mul(pool.accAdaSwapPerShare).div(1e+12)
            let pendingAdaSwap = (accumulatedAdaSwap).sub(getBigNumber(3).mul(pool.accAdaSwapPerShare));
            
            let userInfoAfter = await chef.userInfo(STEAVE.address, lpToken.address, 2);
            expect(pendingAdaSwap).to.be.eq(userInfoAfter.rewardDebt);


            await expect(tx).to.emit(chef, 'Withdraw')
                .withArgs(STEAVE.address, lpToken.address, getBigNumber(3), 2, STEAVE.address);
            await expect(tx).to.emit(chef, 'Harvest')
                .withArgs(STEAVE.address, lpToken.address, accumulatedAdaSwap.sub(userInfoBefore.rewardDebt), 2);
            
        })

        it('17. testMasterAdaSwap: Withdrawal of zero amount', async () => {
            await chef.connect(BOB).deposit(lpToken.address, BOB.address, getBigNumber(2), 0)
            
            await advanceIncreaseTime(3600 * 24 * 30)

            const userInfo = await chef.userInfo(BOB.address, lpToken.address, 2)
            
            const tx = await chef.connect(BOB)
                .withdrawAndHarvest(lpToken.address, getBigNumber(0), BOB.address, 2)
            await tx.wait()
            
            const pool = await chef.poolInfo(lpToken.address, 2)
            const accumulatedAdaSwap = (userInfo.amount).mul(pool.accAdaSwapPerShare).div(1e+12)

            await expect(tx).to.emit(chef, 'Withdraw')
                .withArgs(BOB.address, lpToken.address, 0, 2, BOB.address);
            await expect(tx).to.emit(chef, 'Harvest')
                .withArgs(BOB.address, lpToken.address, accumulatedAdaSwap.sub(userInfo.rewardDebt), 2);
        })
    })

    describe('Update Pool', () => {
        it("18. testMasterAdaSwap: Total LP supply is zero", async () => {
            expect((await chef.isExistPool(lpToken.address, 3))).to.be.false;
            await chef.connect(ADMIN).add(5, lpToken.address, 3, rewarder.address);
            expect((await chef.isExistPool(lpToken.address, 3))).to.be.true;
            
            await advanceIncreaseTime(3600 * 24 * 365)

            const tx = await chef.updatePool(lpToken.address, 3)
            await tx.wait()

            const timestamp = (await ethers.provider.getBlock(tx.blockNumber)).timestamp

            await expect(tx).to.emit(chef, 'LogUpdatePool')
                .withArgs(lpToken.address, 3, timestamp, 0, 0);
        })

        it("19. testMasterAdaSwap: Total LP supply is nonzero", async () => {
            await chef.connect(STEAVE).deposit(lpToken.address, STEAVE.address, getBigNumber(3), 3);
            await chef.connect(ALICE).deposit(lpToken.address, STEAVE.address, getBigNumber(4), 3);
  
            await advanceIncreaseTime(3600 * 24 * 7)

            const pool = await chef.poolInfo(lpToken.address, 3)

            const tx = await chef.updatePool(lpToken.address, 3)
            await tx.wait()
            
            const timestamp = (await ethers.provider.getBlock(tx.blockNumber)).timestamp
            const totalAllocPoint = await chef.totalAllocPoint()
            const dt = BigNumber.from(timestamp).sub(pool.lastRewardTime)
            const adaReward = dt.mul(getBigNumber(10).mul(pool.allocPoint).div(totalAllocPoint))
            const accAdaSwapPerShare = (pool.accAdaSwapPerShare).add((adaReward.mul(1e+12)).div(pool.lpSupply))

            await expect(tx).to.emit(chef, 'LogUpdatePool')
                .withArgs(lpToken.address, 3, timestamp, getBigNumber(7), accAdaSwapPerShare)
        })
    })

    describe('Add', () => {
        it('20. testMasterAdaSwap: Should add pool with corresponding allocation points', async () => {
            const tx = await chef.connect(ADMIN).add(25, lpToken.address, 4, rewarder.address)
            await tx.wait()

            const pool = await chef.poolInfo(lpToken.address, 4)
            expect(pool.lpSupply).to.eq(0)
            expect(pool.accAdaSwapPerShare).to.eq(0)
            expect(pool.lastRewardTime).to.eq(
                (await ethers.provider.getBlock(tx.blockNumber)).timestamp
            )
            expect(pool.allocPoint).to.eq(25)

            await expect(
                chef.connect(ALICE).add(100, lpToken.address, 1, rewarder.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')
        })
    })
})

