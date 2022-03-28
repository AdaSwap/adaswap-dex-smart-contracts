const Router = artifacts.require("UniswapV2Router02.sol")
const WETH = artifacts.require("WETH.sol");

module.exports = async function (deployer, network) {
  let weth;
  const FACTORY_CONTRACT_ADDRESS = '0x08C64dA70e0E6b8AAeAe723D54aA9B0C1d90B2c8';

  if (network === 'milkomedaTestnet') {
    weth = await WETH.at("0xd034bc3C84837Cfa08c8ECdD3F8d9EBB0D67e3B0");
  } else {
    await deployer.deploy(WETH);
    weth = await WETH.deployed();
  }

  await deployer.deploy(Router, FACTORY_CONTRACT_ADDRESS, weth.address);
};
