const Factory = artifacts.require("AdaswapFactory.sol");

module.exports = async function (deployer, network, addresses) {
  await deployer.deploy(Factory, addresses[0]);
  await Factory.deployed()
};
