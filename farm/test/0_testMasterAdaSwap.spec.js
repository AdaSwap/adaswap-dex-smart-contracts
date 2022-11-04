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

describe("MasterAdaSwap", function () {
    let lpToken, chef, adaToken, rewarder, ADMIN, ALICE, BOB, STEAVE;
    let allocPoints = [10, 20, 40, 10, 10, 10, 0];

    before((done) => {
        setTimeout(done, 2000);
    });

    beforeEach(async () => {
        const [admin, alice, bob, steave] = await ethers.getSigners();
        ADMIN = admin;
        ALICE = alice;
        BOB = bob;
        STEAVE = steave;
        lpToken = await ethers.getContractFactory("ERC20Mock");
        adaToken = await ethers.getContractFactory("AdaSwapToken");
        chef = await ethers.getContractFactory("MasterAdaSwap");
        rewarder = await ethers.getContractFactory("RewarderMock");

        adaToken = await adaToken.connect(ADMIN).deploy();
        lpToken = await lpToken.connect(ADMIN).deploy(`AdaSwap LP Token`, `LP`, getBigNumber(10000));
        chef = await chef.connect(ADMIN).deploy(adaToken.address, alice.address);
        rewarder = await rewarder.connect(ADMIN).deploy(getBigNumber(1), adaToken.address, chef.address);
        await adaToken.connect(ADMIN).mint(ALICE.address, getBigNumber(12096000000));

        await adaToken.transferOwnership(chef.address);
        await adaToken.connect(ALICE).approve(chef.address, getBigNumber(100000000));

        expect(lpToken.deployed);
        expect(adaToken.deployed);
        expect(chef.deployed);
        expect(rewarder.deployed);
        expect(lpToken.deployed);
        await chef.connect(ADMIN).add(allocPoints, lpToken.address, rewarder.address);
        await chef.connect(ADMIN).setAdaSwapPerSecond(getBigNumber(10));
        await lpToken.connect(ADMIN).transfer(ALICE.address, getBigNumber(100));
        await lpToken.connect(ADMIN).transfer(BOB.address, getBigNumber(100));
        await lpToken.connect(ADMIN).transfer(STEAVE.address, getBigNumber(100));
        await lpToken.connect(ALICE).approve(chef.address, getBigNumber(100));
        await lpToken.connect(BOB).approve(chef.address, getBigNumber(100));
        await lpToken.connect(STEAVE).approve(chef.address, getBigNumber(100));
    });

    it(`0. testMasterAdaSwap:  Pool should exist`, async () => {
        expect((await chef.isExistPool(0, 0))).to.be.equal(true);
        expect((await chef.adaswapPerSecond())).to.be.equal(getBigNumber(10));
    })

    it(`1. testMasterAdaSwap: PendingAdaSwap should equal ExpectedAdaSwap`, async () => {
        expect((await chef.isExistPool(0, 0))).to.be.equal(true);

        const log1 = await chef.connect(BOB).deposit(0, 0, getBigNumber(1), BOB.address);
        let timestamp1 = (await ethers.provider.getBlock(log1.blockNumber)).timestamp;
        await advanceIncreaseTime(10);
        const log2 = await chef.connect(BOB).updatePool(0, 0);
        let timestamp2 = (await ethers.provider.getBlock(log2.blockNumber)).timestamp;

        pendingAdaSwap = await chef.pendingAdaSwap(0, 0, BOB.address);
        const expectedAdaSwap = getBigNumber(10).mul(timestamp2 - timestamp1);
        expect(pendingAdaSwap).to.be.equal(expectedAdaSwap);
    })


    describe('Deposit', () => {
        it(`2. testMasterAdaSwap:  Deposit 1 lptoken`, async () => {
            await expect(chef.connect(ALICE)
                .deposit(0, 0, getBigNumber(1), ALICE.address))
                .to.emit(chef, "Deposit");
        });

        it(`3. testMasterAdaSwap:  Deposit does not exist`, async () => {
            await expect(chef.connect(ALICE)
                .deposit(0, 6, getBigNumber(1), ALICE.address))
                .to.be.revertedWith('MasterAdaSwap: POOL_DOES_NOT_EXIST');
        });
    });

    describe('Withdraw', () => {
        it(`4. testMasterAdaSwap: Withdraw 10 amount lock time is no over`, async () => {
            await expect(chef.connect(ALICE)
                .deposit(0, 2, getBigNumber(10), ALICE.address))
                .to.emit(chef, "Deposit");
            await expect(chef.connect(ALICE)
                .withdraw(0, 2, getBigNumber(10), ALICE.address))
                .to.revertedWith('MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER');
        });

        it(`5. testMasterAdaSwap: Withdraw 10 mount`, async () => {
            await expect(chef.connect(ALICE)
                .deposit(0, 2, getBigNumber(10), ALICE.address))
                .to.emit(chef, "Deposit");
            await advanceIncreaseTime(3600 * 24 * 14); // to unlock user
            await expect(chef.connect(ALICE)
                .withdraw(0, 2, getBigNumber(10), ALICE.address))
                .to.emit(chef, "Withdraw");
            pendingAdaSwap = await chef.pendingAdaSwap(0, 2, ALICE.address);
            let userInfo = await chef.userInfo(0, 2, ALICE.address);
            expect('-' + pendingAdaSwap).to.be.eq(userInfo.rewardDebt.mul(allocPoints[2]));
        });

        it(`6. testMasterAdaSwap: Withdraw 0 mount`, async () => {
            await expect(chef.connect(ALICE)
                .withdraw(0, 0, getBigNumber(0), ALICE.address))
                .to.emit(chef, "Withdraw");
        });
    });

    describe('Harvest', () => {
        it(`7. testMasterAdaSwap: Harvest lock time is no over`, async () => {
            await expect(chef.connect(BOB)
                .deposit(0, 1, getBigNumber(1), BOB.address))
                .to.emit(chef, "Deposit");
            await expect(chef.connect(BOB)
                .harvest(0, 1, BOB.address))
                .to.revertedWith('MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER');
        });


        it(`8. testMasterAdaSwap: Should give back the correct amount of reward`, async () => {
            await expect(chef.connect(ALICE)
                .deposit(0, 2, getBigNumber(2), ALICE.address))
                .to.emit(chef, "Deposit");

            await expect(chef.connect(BOB)
                .deposit(0, 1, getBigNumber(1), BOB.address))
                .to.emit(chef, "Deposit");
            await advanceIncreaseTime(3600 * 24 * 7); // to unlock user

            const balanceBefore = await adaToken.balanceOf(BOB.address);

            const info = await chef.poolInfo(0);
            const timestamp1 = info.lastRewardTime;

            const tx = await chef.connect(BOB).harvest(0, 1, BOB.address);
            await tx.wait()

            const timestamp2 = (await ethers.provider.getBlock(tx.blockNumber)).timestamp;
            const balanceAfter = await adaToken.balanceOf(BOB.address);

            // time * adaPerSec * allocPoint1 * BobAmountAtPool0Lock1 / poolWeight = time * 10 * 20 * 1 / 100
            // poolWeight = allocPointi*supplyi = 20 * 1 + 40 * 2 = 100
            let pendingAdaSwap = getBigNumber((timestamp2 - timestamp1) * 10 * 20 * 1 / 100);

            expect(balanceAfter).to.be.eq(balanceBefore.add(pendingAdaSwap));

            await expect(tx)
                .to.emit(chef, 'Harvest')
                .withArgs(BOB.address, 0, 1, balanceBefore.add(pendingAdaSwap));
        });

        it(`9. testMasterAdaSwap: Harvest with empty user balance`, async () => {
            await chef.connect(ALICE).deposit(0, 1, getBigNumber(0), ALICE.address);
            await advanceIncreaseTime(3600 * 24 * 7)
            const tx = await chef.connect(ALICE).harvest(0, 1, ALICE.address)
            await tx.wait()

            await expect(tx)
                .to.emit(chef, 'Harvest')
                .withArgs(ALICE.address, 0, 1, getBigNumber(0));
        });
    });

    describe('Emergency Withdraw', () => {
        it("10. testMasterAdaSwap: Lock time is not over", async () => {
            await chef.connect(ALICE).deposit(0, 1, getBigNumber(5), ALICE.address)
            const tx = await chef.connect(ALICE).emergencyWithdraw(0, 1, ALICE.address)
            await tx.wait()

            const info = await chef.userInfo(0, 1, ALICE.address)
            expect(info.amount).to.eq(0)
            expect(info.rewardDebt).to.eq(0)

            await expect(tx)
                .to.emit(chef, 'EmergencyWithdraw')
                .withArgs(ALICE.address, 0, 1, getBigNumber(5), ALICE.address)
        })

        it("11. testMasterAdaSwap: Lock time is over", async () => {
            await chef.connect(STEAVE).deposit(0, 2, getBigNumber(20), STEAVE.address)

            await advanceIncreaseTime(3600 * 24 * 7)

            const tx = await chef.connect(STEAVE).emergencyWithdraw(0, 2, STEAVE.address);
            await tx.wait()

            const info = await chef.userInfo(0, 2, STEAVE.address)
            expect(info.amount).to.eq(0)
            expect(info.rewardDebt).to.eq(0)

            await expect(tx)
                .to.emit(chef, 'EmergencyWithdraw')
                .withArgs(STEAVE.address, 0, 2, getBigNumber(20), STEAVE.address)
        })

        it("12. testMasterAdaSwap: Transfer amount is zero", async () => {
            const tx = await chef.connect(ALICE).emergencyWithdraw(0, 3, ALICE.address)
            await tx.wait()

            await expect(tx)
                .to.emit(chef, 'EmergencyWithdraw')
                .withArgs(ALICE.address, 0, 3, getBigNumber(0), ALICE.address)
        })

    });

    describe('Withdraw And Harvest', () => {
        it(`13. testMasterAdaSwap: Lock time is not over`, async () => {
            await chef.connect(STEAVE).deposit(0, 3, getBigNumber(7), STEAVE.address);

            await expect(chef.connect(STEAVE)
                .withdrawAndHarvest(0, 3, getBigNumber(2), STEAVE.address))
                .to.revertedWith('MasterAdaSwap: FIXED_LOCK_TIME_IS_NOT_OVER');
        })

        it(`14. testMasterAdaSwap: Withdrawal of nonzero amount`, async () => {
            await expect(chef.connect(STEAVE)
                .deposit(0, 3, getBigNumber(7), STEAVE.address))
                .to.emit(chef, "Deposit");

            await advanceIncreaseTime(3600 * 24 * 30); // to unlock user

            const userInfoBefore = await chef.userInfo(0, 3, STEAVE.address)

            const tx = await chef.connect(STEAVE)
                .withdrawAndHarvest(0, 3, getBigNumber(3), STEAVE.address)
            await tx.wait()

            const pool = await chef.poolInfo(0);
            const lock = await chef.lockInfo(0, 3);
            const accumulatedAdaSwap = (userInfoBefore.amount).mul(pool.accAdaSwapPerShare).div(1e12);
            const expectedPendingAdaSwap = (accumulatedAdaSwap.sub(userInfoBefore.rewardDebt)).mul(lock.allocPoint);
            const expectedRewardDebt = accumulatedAdaSwap.sub(getBigNumber(3).mul(pool.accAdaSwapPerShare).div(1e12));

            let userInfoAfter = await chef.userInfo(0, 3, STEAVE.address);
            expect(expectedRewardDebt).to.be.eq(userInfoAfter.rewardDebt);

            await expect(tx).to.emit(chef, 'Withdraw')
                .withArgs(STEAVE.address, 0, 3, getBigNumber(3), STEAVE.address);
            await expect(tx).to.emit(chef, 'Harvest')
                .withArgs(STEAVE.address, 0, 3, expectedPendingAdaSwap);

        })

        it(`15. testMasterAdaSwap: Withdrawal of zero amount`, async () => {
            await expect(chef.connect(BOB)
                .deposit(0, 2, getBigNumber(2), BOB.address))
                .to.emit(chef, "Deposit");

            await advanceIncreaseTime(3600 * 24 * 14);

            const userInfo = await chef.userInfo(0, 2, BOB.address);

            const tx = await chef.connect(BOB)
                .withdrawAndHarvest(0, 2, getBigNumber(0), BOB.address)
            await tx.wait();

            const pool = await chef.poolInfo(0);
            const lock = await chef.lockInfo(0, 2);
            const accumulatedAdaSwap = (userInfo.amount).mul(pool.accAdaSwapPerShare).div(1e+12)

            await expect(tx).to.emit(chef, 'Withdraw')
                .withArgs(BOB.address, 0, 2, 0, BOB.address);
            await expect(tx).to.emit(chef, 'Harvest')
                .withArgs(BOB.address, 0, 2, (accumulatedAdaSwap.sub(userInfo.rewardDebt)).mul(lock.allocPoint));
        })
    })

    describe('Update Pool', () => {
        it("16. testMasterAdaSwap: Total LP supply is zero", async () => {
            await advanceIncreaseTime(3600 * 24 * 365);
            const tx = await chef.updatePool(0, 3);
            await tx.wait();

            const timestamp = (await ethers.provider.getBlock(tx.blockNumber)).timestamp;

            await expect(tx).to.emit(chef, 'LogUpdatePool')
                .withArgs(0, 3, timestamp, 0, 0);
        })

        it("17. testMasterAdaSwap: Total LP supply is nonzero", async () => {
            await chef.connect(STEAVE).deposit(0, 3, getBigNumber(3), STEAVE.address);
            await chef.connect(ALICE).deposit(0, 3, getBigNumber(4), STEAVE.address);

            await advanceIncreaseTime(3600 * 24 * 7);
            const pool = await chef.poolInfo(0);

            const tx = await chef.updatePool(0, 3);
            await tx.wait();

            const timestamp = (await ethers.provider.getBlock(tx.blockNumber)).timestamp;
            const totalAllocPoint = await chef.totalAllocPoint();
            const dt = BigNumber.from(timestamp).sub(pool.lastRewardTime);
            const adaReward = dt.mul(getBigNumber(10).mul(pool.allocPoint).div(totalAllocPoint));
            const accAdaSwapPerShare = (pool.accAdaSwapPerShare).add((adaReward.mul(1e12)).div(pool.weight));

            await expect(tx).to.emit(chef, 'LogUpdatePool')
                .withArgs(0, 3, timestamp, accAdaSwapPerShare, pool.weight);
        })
    })

    describe('Add', () => {
        it(`18. testMasterAdaSwap: Should add pool with corresponding allocation points`, async () => {
            const tx = await chef.connect(ADMIN).add(allocPoints, lpToken.address, rewarder.address);
            await tx.wait();

            const pool = await chef.poolInfo(1)
            expect(pool.weight).to.eq(0)
            expect(pool.accAdaSwapPerShare).to.eq(0)
            expect(pool.lastRewardTime).to.eq(
                (await ethers.provider.getBlock(tx.blockNumber)).timestamp
            )
            expect(pool.allocPoint).to.eq(100)

            await expect(
                chef.connect(ALICE).add(allocPoints, lpToken.address, rewarder.address)
            ).to.be.revertedWith('Ownable: caller is not the owner')
        })
    })
})
