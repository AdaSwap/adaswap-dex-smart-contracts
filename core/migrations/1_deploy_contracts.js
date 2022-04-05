const Factory = artifacts.require("AdaswapFactory.sol");
const Token1 = artifacts.require("Token1.sol");
const Token2 = artifacts.require("Token2.sol");

module.exports = async function (deployer, network, addresses) {

  await deployer.deploy(Factory, addresses[0]);
  const factory = await Factory.deployed()

  let token1Address, token2Address;
  if (network === 'milkomedaTestnet') {

    token1Address = '0x0466aA819634FB39C9349d9Ab8DB5e0bA89E6948';
    token2Address = '0x32A82E9A172C434c1Bb5Dac6C1C3367634f93170';

  } else {

    await deployer.deploy(Token1);
    await deployer.deploy(Token2);

    const token1 = await Token1.deployed();
    const token2 = await Token2.deployed();

    token1Address = token1.address;
    token2Address = token2.address;
  
  }

  await factory.createPair(token1Address, token2Address);
};
