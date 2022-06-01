const Factory = artifacts.require("AdaswapFactory.sol");
const Token1 = artifacts.require("Token1.sol");
const Token2 = artifacts.require("Token2.sol");

module.exports = async function (deployer, network, addresses) {

  await deployer.deploy(Factory, addresses[0]);
  const factory = await Factory.deployed()

  let token1Address, token2Address;
  if (network === 'milkomedaTestnet') {

    token1Address = '0x6bD7B9EaD7c74A7eB960E8076f917A420a516FCD';
    token2Address = '0x0B1D2C821e20dF17dCDe1009ab0794C73b2E8Bb1';

  }
  if (network === 'polygonTestnet') {

    token1Address = '0x8ED991926567b989666e20e8E738D5428731E035';
    token2Address = '0x62AF935678ca43591410e400515f9B9dd8dED34e';

  }
  if (network === 'development') {

    await deployer.deploy(Token1);
    await deployer.deploy(Token2);

    const token1 = await Token1.deployed();
    const token2 = await Token2.deployed();

    token1Address = token1.address;
    token2Address = token2.address;
  
  }

  await factory.createPair(token1Address, token2Address);
};
