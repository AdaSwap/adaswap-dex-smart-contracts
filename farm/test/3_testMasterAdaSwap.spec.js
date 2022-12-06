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
    let lpToken0, lpToken1, lpToken2, chef, adaToken, rewarder, ADMIN, ALICE, BOB, STEAVE, SAM, TOM, GOR, TOR, YOR, J, K, L;
    let allocPoints = [10, 0, 10, 0, 20, 20, 40];

    before((done) => {
        setTimeout(done, 2000);
    });

    beforeEach(async () => {
        const [admin, alice, bob, steave, sam, tom, gor, tor, yor, j, k, l] = await ethers.getSigners();
        ADMIN = admin;
        ALICE = alice;
        BOB = bob;
        STEAVE = steave;
        SAM = sam;
        TOM = tom;
        GOR = gor;
        TOR = tor;
        YOR = yor;
        J = j;
        K = k;
        L = l;

        lpToken0 = await ethers.getContractFactory("ERC20Mock");
        lpToken1 = await ethers.getContractFactory("ERC20Mock");
        lpToken2 = await ethers.getContractFactory("ERC20Mock");
        adaToken = await ethers.getContractFactory("AdaSwapToken");
        chef = await ethers.getContractFactory("MasterAdaSwap");
        rewarder = await ethers.getContractFactory("RewarderMock");

        lpToken0 = await lpToken0.connect(ADMIN).deploy("LP Token", "ALP", getBigNumber(10000));
        lpToken1 = await lpToken1.connect(ADMIN).deploy("LP Token", "ALP", getBigNumber(10000));
        lpToken2 = await lpToken2.connect(ADMIN).deploy("LP Token", "ALP", getBigNumber(10000));
        adaToken = await adaToken.connect(ADMIN).deploy();
        chef = await chef.connect(ADMIN).deploy(adaToken.address, alice.address);
        rewarder = await rewarder.connect(ADMIN).deploy(getBigNumber(1), adaToken.address, chef.address);
        await adaToken.connect(ADMIN).mint(ALICE.address, getBigNumber(1209600000000));

        expect(lpToken0.deployed);
        expect(lpToken1.deployed);
        expect(lpToken2.deployed);
        expect(adaToken.deployed);
        expect(chef.deployed);
        expect(rewarder.deployed);

        await adaToken.transferOwnership(chef.address);
        await lpToken0.approve(chef.address, getBigNumber(100));
        await chef.setAdaSwapPerSecond(getBigNumber(30));
        await lpToken0.transfer(BOB.address, getBigNumber(100));
        await lpToken0.transfer(ALICE.address, getBigNumber(100));
        await lpToken0.transfer(STEAVE.address, getBigNumber(100));
        await lpToken0.transfer(SAM.address, getBigNumber(100));
        await lpToken0.transfer(TOM.address, getBigNumber(100));
        await lpToken0.transfer(GOR.address, getBigNumber(30));
        await lpToken0.transfer(TOR.address, getBigNumber(30));
        await lpToken0.transfer(YOR.address, getBigNumber(30));
        await adaToken.connect(ALICE).approve(chef.address, getBigNumber(100000000000));

        await lpToken1.approve(chef.address, getBigNumber(100));
        await lpToken1.transfer(BOB.address, getBigNumber(100));
        await lpToken1.transfer(ALICE.address, getBigNumber(100));
        await lpToken1.transfer(STEAVE.address, getBigNumber(100));
        await lpToken1.transfer(SAM.address, getBigNumber(100));
        await lpToken1.transfer(TOM.address, getBigNumber(100));
        await lpToken1.transfer(GOR.address, getBigNumber(30));
        await lpToken1.transfer(TOR.address, getBigNumber(30));
        await lpToken1.transfer(YOR.address, getBigNumber(30));

        await lpToken2.approve(chef.address, getBigNumber(10000000000000));
        await lpToken2.transfer(J.address, getBigNumber(3000));
        await lpToken2.transfer(K.address, getBigNumber(3000));
        await lpToken2.transfer(L.address, getBigNumber(3000));

        await chef.connect(ADMIN).add(allocPoints, lpToken0.address, rewarder.address);
        await chef.connect(ADMIN).add(allocPoints, lpToken1.address, rewarder.address);
        await chef.connect(ADMIN).add(allocPoints, lpToken2.address, rewarder.address);
    })

    describe('Creating pools with different time lock', async () => {
        it('28. testMasterAdaSwap: Pool with time lock - 14 days', async () => {
            // first pool
            // lock time - 14 days
            await lpToken0.connect(BOB).approve(chef.address, getBigNumber(15));
            await lpToken0.connect(ALICE).approve(chef.address, getBigNumber(15));
            await lpToken0.connect(STEAVE).approve(chef.address, getBigNumber(15));

            await chef.connect(BOB).deposit(0, 2, getBigNumber(5), BOB.address);
            await chef.connect(ALICE).deposit(0, 2, getBigNumber(4), ALICE.address);
            await chef.connect(STEAVE).deposit(0, 2, getBigNumber(3), STEAVE.address);

            advanceIncreaseTime(3600 * 24 * 14);

            let bob = await chef.userInfo(0, 2, BOB.address);
            await chef.connect(BOB).harvest(0, 2, BOB.address);
            let pool = await chef.poolInfo(0);
            let accumulatedAdaSwapBOB = bob.amount.mul(pool.accAdaSwapPerShare).div(1e12);
            let infoAfterBOB = await chef.userInfo(0, 2, BOB.address);

            let alice = await chef.userInfo(0, 2, ALICE.address);
            await chef.connect(ALICE).harvest(0, 2, ALICE.address);
            pool = await chef.poolInfo(0);
            let accumulatedAdaSwapALICE = alice.amount.mul(pool.accAdaSwapPerShare).div(1e12);
            let infoAfterALICE = await chef.userInfo(0, 2, ALICE.address);;

            let steave = await chef.userInfo(0, 2, STEAVE.address);
            await chef.connect(STEAVE).harvest(0, 2, STEAVE.address);
            pool = await chef.poolInfo(0);
            let accumulatedAdaSwapSTEAVE = steave.amount.mul(pool.accAdaSwapPerShare).div(1e12);
            let infoAfterSTEAVE = await chef.userInfo(0, 2, STEAVE.address);

            expect(infoAfterBOB.rewardDebt).to.eq(accumulatedAdaSwapBOB);
            expect(infoAfterALICE.rewardDebt).to.eq(accumulatedAdaSwapALICE);
            expect(infoAfterSTEAVE.rewardDebt).to.eq(accumulatedAdaSwapSTEAVE);
        });

        it('29. testMasterAdaSwap: Pool with time lock - 60 days', async () => {
            await lpToken1.connect(TOM).approve(chef.address, getBigNumber(15));
            await lpToken1.connect(GOR).approve(chef.address, getBigNumber(15));
            await lpToken1.connect(TOR).approve(chef.address, getBigNumber(15));
            await lpToken1.connect(YOR).approve(chef.address, getBigNumber(15));

            await chef.connect(TOM).deposit(1, 4, getBigNumber(1), TOM.address);
            await chef.connect(GOR).deposit(1, 4, getBigNumber(2), GOR.address);
            await chef.connect(TOR).deposit(1, 4, getBigNumber(3), TOR.address);
            await chef.connect(YOR).deposit(1, 4, getBigNumber(4), YOR.address);

            advanceIncreaseTime(3600 * 24 * 60);

            let tom = await chef.userInfo(1, 4, TOM.address)
            await chef.connect(TOM).harvest(1, 4, TOM.address);
            let pool1 = await chef.poolInfo(1);
            let accumulatedAdaSwapTOM = tom.amount.mul(pool1.accAdaSwapPerShare).div(1e12);
            let infoAfterTOM = await chef.userInfo(1, 4, TOM.address)


            let gor = await chef.userInfo(1, 4, GOR.address)
            await chef.connect(GOR).harvest(1, 4, GOR.address);
            pool1 = await chef.poolInfo(1);
            let accumulatedAdaSwapGOR = gor.amount.mul(pool1.accAdaSwapPerShare).div(1e12);
            let infoAfterGOR = await chef.userInfo(1, 4, GOR.address);

            let tor = await chef.userInfo(1, 4, TOR.address)
            await chef.connect(TOR).harvest(1, 4, TOR.address);
            pool1 = await chef.poolInfo(1);
            let accumulatedAdaSwapTOR = tor.amount.mul(pool1.accAdaSwapPerShare).div(1e12);
            let infoAfterTOR = await chef.userInfo(1, 4, TOR.address)

            let yor = await chef.userInfo(1, 4, YOR.address)
            await chef.connect(YOR).harvest(1, 4, YOR.address);
            pool1 = await chef.poolInfo(1);
            let accumulatedAdaSwapYOR = yor.amount.mul(pool1.accAdaSwapPerShare).div(1e12);
            let infoAfterYOR = await chef.userInfo(1, 4, YOR.address)

            expect(infoAfterTOM.rewardDebt).to.eq(accumulatedAdaSwapTOM);
            expect(infoAfterGOR.rewardDebt).to.eq(accumulatedAdaSwapGOR);
            expect(infoAfterTOR.rewardDebt).to.eq(accumulatedAdaSwapTOR);
            expect(infoAfterYOR.rewardDebt).to.eq(accumulatedAdaSwapYOR);
        })

        it('30. testMasterAdaSwap: Pool with time lock - 365 days ', async () => {

            await lpToken2.connect(J).approve(chef.address, getBigNumber(150000));
            await lpToken2.connect(K).approve(chef.address, getBigNumber(150000));
            await lpToken2.connect(L).approve(chef.address, getBigNumber(150000));

            await chef.connect(J).deposit(2, 6, getBigNumber(5), J.address);
            await chef.connect(K).deposit(2, 6, getBigNumber(4), K.address);
            await chef.connect(L).deposit(2, 6, getBigNumber(3), L.address);

            advanceIncreaseTime(3600 * 24 * 365);

            let j = await chef.userInfo(2, 6, J.address);
            await chef.connect(J).harvest(2, 6, J.address);;
            let pool3 = await chef.poolInfo(2);;
            let accumulatedAdaSwapBOB_ = j.amount.mul(pool3.accAdaSwapPerShare).div(1e12);;
            let infoAfterBOB_ = await chef.userInfo(2, 6, J.address);


            let k = await chef.userInfo(2, 6, K.address);
            await chef.connect(K).harvest(2, 6, K.address);;
            pool3 = await chef.poolInfo(2);;
            let accumulatedAdaSwapALICE_ = k.amount.mul(pool3.accAdaSwapPerShare).div(1e12);;
            let infoAfterALICE_ = await chef.userInfo(2, 6, K.address);


            let l = await chef.userInfo(2, 6, L.address)
            await chef.connect(L).harvest(2, 6, L.address);
            pool3 = await chef.poolInfo(2);
            let accumulatedAdaSwapSTEAVE_ = l.amount.mul(pool3.accAdaSwapPerShare).div(1e12);
            let infoAfterSTEAVE_ = await chef.userInfo(2, 6, L.address)

            expect(infoAfterBOB_.rewardDebt).to.eq(accumulatedAdaSwapBOB_);
            expect(infoAfterALICE_.rewardDebt).to.eq(accumulatedAdaSwapALICE_);
            expect(infoAfterSTEAVE_.rewardDebt).to.eq(accumulatedAdaSwapSTEAVE_);
        })

        it('31. testMasterAdaSwap: Pool with diffrent time lock in same pool', async () => {

            await lpToken0.connect(BOB).approve(chef.address, getBigNumber(150000));
            await lpToken0.connect(ALICE).approve(chef.address, getBigNumber(150000));
            await lpToken0.connect(STEAVE).approve(chef.address, getBigNumber(150000));

            let tx0 = await chef.connect(BOB).deposit(0, 2, getBigNumber(10), BOB.address);
            tx0.wait();
            let t0 = (await ethers.provider.getBlock(tx0.blockNumber)).timestamp;

            advanceIncreaseTime(3600 * 24 * 14);

            // ======== DRAF CALCULATION==========
            // bobAmount = getBigNumber(5)
            // p0l2allocPoint = 10
            // aswPersec = getBigNumber(30)
            // p0allocPoint = 100
            // totalAllocPoint = 300
            // (x) <=> aswPersec * p0allocPoint / totalAllocPoint = getBigNumber(30) * 100 / 300 = getBigNumber(10)

            // p0weight = 10*0 + 0*0 + 10*getBigNumber(10) + 0*0 + 20*0 + 20*0 +40*0 = 10*getBigNumber(10)
            // (i) <=> p0l2allocPoint/p0weight = 10/10*getBigNumber(10) = 1/getBigNumber(10)
            // rbob = (t1-t0) * bobAmount * (x) * (i)
            // => rbob = (t1-t0) * getBigNumber(10) * getBigNumber(10) * 1 / getBigNumber(10)
            // => rbob = (t1-t0) * getBigNumber(10)

            let tx1 =await chef.connect(ALICE).deposit(0, 4, getBigNumber(20), ALICE.address);
            tx1.wait();
            let t1 = (await ethers.provider.getBlock(tx1.blockNumber)).timestamp;

            let rbob = getBigNumber(10).mul(t1-t0);
            advanceIncreaseTime(3600 * 24 * 60);

            // ======== DRAF CALCULATION==========
            // aliceAmount = getBigNumber(4)
            // p0weight = 10*0 + 0*0 + 10*getBigNumber(5) + 0*0 + 20*4 + 20*0 +40*0 = 10*getBigNumber(10) + 20*getBigNumber(20) = getBigNumber(500)
            // (i') <=> p0l2allocPoint/p0weight = 10/getBigNumber(500) = 1/getBigNumber(50)
            // (ii) <=> p0l4allocPoint/p0weight = 20/getBugNumber(500) = 1/getBigNumber(25)
            // rbob = rbob + [(t2-t1) * bobAmount * (x) * (i')]
            // => rbob = rbob + [(t2-t1) * getBigNumber(10) * getBigNumber(10) / getBigNumber(50)]
            // => rbob = rbob + [(t2-t1) * getBigNumber(2)]
            // ralice = (t2-t1) * aliceAmount * (x) * (ii)
            // => ralice = (t2-t1) * getBigNumber(20) * getBigNumber(10) / getBigNumber(25)
            // => ralice = (t2-t1) * getBigNumber(8)

            let tx2 = await chef.connect(STEAVE).deposit(0, 6, BigNumber.from("27500000000000000000"), STEAVE.address);
            tx2.wait();
            let t2 = (await ethers.provider.getBlock(tx2.blockNumber)).timestamp;
            
            rbob = rbob.add(getBigNumber(2).mul(t2-t1));
            let ralice = getBigNumber(8).mul(t2-t1);
            advanceIncreaseTime(3600 * 24 * 365);

            // ======== DRAF CALCULATION==========
            // p0weight = 10*0 + 0*0 + 10*getBigNumber(5) + 0*0 + 20*4 + 20*0 +40*3 = 10*getBigNumber(10) + 20*getBigNumber(20) + 40*getBigNumber(27.5) = getBigNumber(1600)
            // (i'') <=> p0l2allocPoint/p0weight = 10/getBigNumber(1600) = 1/getBigNumber(160)
            // (ii') <=> p0l4allocPoint/p0weight = 20/getBigNumber(1600) = 1/getBigNumber(80)
            // (iii) <=> p0l6allocPoint/p0weight = 40/getBigNumber(1600) = 1/getBigNumber(40)
            // rbob = rbob + [(t3-t2) * bobAmount * (x) * (i'')]
            // => rbob = rbob + [(t3-t2) * getBigNumber(10) * getBigNumber(10) / getBigNumber(160)]
            // => rbob = rbob + [(t3-t2) * getBigNumber(0.625)]
            // ralice = ralice + [(t3-t2) * aliceAmount (x) * (ii')]
            // => ralice = ralice + [(t3-t2) * getBigNumber(20) * getBigNumber(10) / getBigNumber(80)]
            // => ralice = ralice + [(t3-t2) * BigNumber.from(2.5)]
            // rsteave = (t3-t2) * getBigNumber(27.5) * getBigNumber(10) / getBigNumber(40)
            // rsteave = (t3-t2) * getBigNumber(6.875)
            let tx3 = await chef.connect(BOB).harvest(0, 2, BOB.address);
            tx3.wait();
            let t3 = (await ethers.provider.getBlock(tx3.blockNumber)).timestamp;
            rbob = rbob.add(BigNumber.from("625000000000000000").mul(t3-t2));
            expect(tx3).to.emit(chef, "Harvest").withArgs(BOB.address, 0, 2, rbob);

            let tx4 = await chef.connect(ALICE).harvest(0, 4, SAM.address);
            tx4.wait();
            let t4 = (await ethers.provider.getBlock(tx4.blockNumber)).timestamp;
            ralice = ralice.add(BigNumber.from("2500000000000000000").mul(t4-t2));
            expect(tx4).to.emit(chef, "Harvest").withArgs(ALICE.address, 0, 4, ralice);

            let tx5 = await chef.connect(STEAVE).harvest(0, 6, STEAVE.address);
            tx5.wait();
            let t5 = (await ethers.provider.getBlock(tx5.blockNumber)).timestamp;
            let rsteave = BigNumber.from("6875000000000000000").mul(t5-t2);
            expect(tx5).to.emit(chef, "Harvest").withArgs(STEAVE.address, 0, 6, rsteave);
        })
    });
});
