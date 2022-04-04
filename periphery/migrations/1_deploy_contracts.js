const Router = artifacts.require('AdaswapRouter02.sol')
const WETH = artifacts.require('WETH.sol');

module.exports = async function (deployer, network) {
  let weth;
  const FACTORY_CONTRACT_ADDRESS = '0x09Ced14F7CBf72eEa46cD9c48c368F952410AB87';

  if (network === 'milkomedaTestnet') {
    weth = await WETH.at('0xd034bc3C84837Cfa08c8ECdD3F8d9EBB0D67e3B0');
  } else {
    await deployer.deploy(WETH);
    weth = await WETH.deployed();
  }

  await deployer.deploy(Router, FACTORY_CONTRACT_ADDRESS, weth.address);
};
