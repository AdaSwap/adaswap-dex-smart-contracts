const Factory = artifacts.require("AdaswapFactory.sol");
const constants = require('../constants');

module.exports = async function (deployer, network, addresses) {
  const { FEE_ADDRESS } = constants[network];
  await deployer.deploy(Factory, FEE_ADDRESS);
  await Factory.deployed();
};
