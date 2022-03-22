const Router = artifacts.require("UniswapV2Router02.sol")
const WETH = artifacts.require("WETH.sol");

module.exports = function (deployer, network) {
  let weth;
  const FACTORY_CONTRACT_ADDRESS = '0x7f6eC566d3f5B4a22320965fb62BDAF4207DFd73';
  deployer.deploy(Router);

  if (network === 'mainnet')

};
