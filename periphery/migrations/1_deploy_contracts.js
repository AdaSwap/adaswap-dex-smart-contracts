const Router = artifacts.require('AdaswapRouter02.sol');
const constants = require('../constants');

module.exports = async function (deployer, network) {
  const { FACTORY_ADDRESS, WETH_ADDRESS } = constants[network];

  await deployer.deploy(Router, FACTORY_ADDRESS, WETH_ADDRESS);
};
