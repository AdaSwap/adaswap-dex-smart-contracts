const Router = artifacts.require('AdaswapRouter02.sol')

module.exports = async function (deployer, network) {
  let weth;
  let FACTORY_CONTRACT_ADDRESS;

  switch (network) {
    case "milkomedaTestnet":
      // initial pair contract code hash: 0dcce424aa137e2b5b72e7e1b0d3682ea5d322a4529378fa00c40cca884b2559
      FACTORY_CONTRACT_ADDRESS = '0x5f98cdDe30886761db341f0108b2953b6238A3D1';
      weth = {address: "0x65a51E52eCD17B641f8F0D1d56a6c9738951FDC9"}
    case "milkomedaMainnet":
      // initial pair contract code hash:
      FACTORY_CONTRACT_ADDRESS = '';
      weth = {address: ""}
    case "polygonTestnet":
      // initial pair contract code hash: 0b11443901eb0d49701c1c3443f547f8a86063e8a4e777d42801c31beb9f4f8c
      FACTORY_CONTRACT_ADDRESS = '0x388C22d8f2E55975D7aE436b566379c8C5a58E9B';
      weth = {address: "0x9c3c9283d3e44854697cd22d3faa240cfb032889"}
  }
  await deployer.deploy(Router, FACTORY_CONTRACT_ADDRESS, weth.address);
};
