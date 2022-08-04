require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-waffle");
const fs = require("fs");
require('dotenv').config({path:'../.env'});
require('hardhat-contract-sizer');

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

function mnemonic() {
  try {
    return fs.readFileSync(".secret").toString().trim();
  } catch (e) {
    if (defaultNetwork !== "localhost") {
      console.log(
        "☢️ WARNING: No mnemonic file created for a deploy account. Try `yarn run generate` and then `yarn run account`."
      );
    }
  }
  return "";
}


//
// Select the network you want to deploy to here:
//
const defaultNetwork = "localhost";


// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

/**
 * @type import('hardhat/config').HardhatUserConfig
 */
module.exports = {
  defaultNetwork,

  networks: {
    hardhat: {
      forking: {
        url: process.env.MILKOMEDA_MAINNET_PROVIDER,
        blockNumber: 11797060
      },
      accounts: {
        mnemonic: 'prevent evidence skate leader couple kitchen orient grace mean shove ceiling goddess'
      }
    },
    localhost: {
      url: "http://localhost:8545",
      accounts: {
        mnemonic: 'prevent evidence skate leader couple kitchen orient grace mean shove ceiling goddess'
      }
    },
    milkomedaTestnet: {
      url: `${process.env.MIKOMEDA_TESTNET_PROVIDER}`,
      accounts: [`${process.env.MILKOMEDA_TESTNET_DEPLOYER_PRIV_KEY}`],
    },
  },

  solidity: {
    version: "0.8.13",
    settings: {          // See the solidity docs for advice about optimization and evmVersion
      optimizer: {
        enabled: true,
        runs: 999999
      },
      evmVersion: "istanbul",
    }
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: false
  }
}
