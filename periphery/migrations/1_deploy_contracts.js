const Router = artifacts.require('AdaswapRouter02.sol')

module.exports = async function (deployer, network) {
  var weth;
  var FACTORY_CONTRACT_ADDRESS;
  switch (network) {
    case "milkomedaTestnet":
      FACTORY_CONTRACT_ADDRESS = '0xf2Fe389a25eD1c98cEf93B624c59e299433057Ee';
      weth = {address: "0x65a51E52eCD17B641f8F0D1d56a6c9738951FDC9"};
      break;
    case "mainnet":
      // initial pair contract code hash:
      FACTORY_CONTRACT_ADDRESS = '';
      weth = {address: ""};
      break;
  }
  await deployer.deploy(Router, FACTORY_CONTRACT_ADDRESS, weth.address);
};
