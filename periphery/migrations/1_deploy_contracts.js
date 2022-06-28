const Router = artifacts.require('AdaswapRouter02.sol');
// const WETH = artifacts.require('WETH.sol')
const constants = require('../constants');

module.exports = async function (deployer, network) {
  const { FACTORY_ADDRESS, WETH_ADDRESS } = constants[network];

  await deployer.deploy(Router, FACTORY_ADDRESS, WETH_ADDRESS);

  // await deployer.deploy(WETH);
  // await WETH.deployed();

  // await deployer.deploy(Router, '0x3175C8aa94588aC277269787645d7A9d605DA467', WETH.address);
  // const router = await Router.deployed()
};
