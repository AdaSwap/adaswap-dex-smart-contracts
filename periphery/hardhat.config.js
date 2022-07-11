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
    return fs.readFileSync("./mnemonic.txt").toString().trim();
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
        blockNumber: 4000000
      }
      // accounts: {
      //   mnemonic: 'height school space unique renew cable one stumble ring cube artefact plunge'
      // }

    },
    localhost: {
      url: "http://localhost:8545",
      /*      
        notice no mnemonic here? it will just use account 0 of the hardhat node to deploy
        (you can put in a mnemonic here to set the deployer locally)
      
      */
    },

    milkomedaTestnet: {
      url: `${process.env.MILKOMEDA_TESTNET_PROVIDER}`,
      accounts: [`${process.env.MILKOMEDA_TESTNET_DEPLOYER_PRIV_KEY}`],
    },

    milkomedaMainnet: {
      url: `${process.env.MILKOMEDA_MAINNET_PROVIDER}`,
      accounts: [`${process.env.MILKOMEDA_MAINNET_DEPLOYER_PRIV_KEY}`],
    },

    polygonTestnet: {
      url: `${process.env.POLYGON_TESTNET_PROVIDER}`,
      accounts: [`${process.env.POLYGON_TESTNET_DEPLOYER_PRIV_KEY}`],
    },

    // rinkeby: {
    //   url: `https://rinkeby.infura.io/v3/${process.env.RINKEBY_INFURA_KEY}`,
    //   accounts: [`${process.env.RINKEBY_DEPLOYER_PRIV_KEY}`],
    // },
    // mainnet: {
    //   url: `https://mainnet.infura.io/v3/${process.env.MAINNET_INFURA_KEY}`,
    //   accounts: [`${process.env.MAINNET_DEPLOYER_PRIV_KEY}`],
    // },
    // ropsten: {
    //   url: `https://ropsten.infura.io/v3/${process.env.ROPSTEN_INFURA_KEY}`,
    //   accounts: [`${process.env.ROPSTEN_DEPLOYER_PRIV_KEY}`],
    // },

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
