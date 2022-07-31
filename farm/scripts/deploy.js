/* eslint no-use-before-define: "warn" */
const fs = require("fs");
const chalk = require("chalk");
const { config, ethers, tenderly, run, network } = require("hardhat");
const { utils } = require("ethers");

const main = async () => {
  console.log("\n\n 📡 Deploying...\n");

  // get signer from network config
  let [ deployer ] = await ethers.getSigners();

  const AdaSwapToken = await deploy("AdaSwapToken");
  await AdaSwapToken.deployed();
  const MasterAdaSwap = await deploy("MasterAdaSwap", [AdaSwapToken.address]);
  await MasterAdaSwap.deployed();
  const EmptyRewarder = await deploy("EmptyRewarder");
  await EmptyRewarder.deployed();

  // premint 10B AdaSwap tokens to deployer address
  await AdaSwapToken.mint(deployer.address, "10000000000000000");
  console.log(` 💰 Minting 10B AdaSwap tokens to ${deployer.address}`);

  // const AdaSwapTokenFactory = await ethers.getContractFactory("MasterAdaSwap");
  // const AdaSwapToken = await AdaSwapTokenFactory.attach("0x214207859701D6d6890544eeaC3a5141b5e94F86")
  // const EmptyRewarderFactory = await ethers.getContractFactory("EmptyRewarder");
  // const EmptyRewarder = await EmptyRewarderFactory.attach("0x77b2f61ED424DEce5c3d2CF03a9a70c08E1529b2")
  // const MasterAdaSwap = {address: "0xBaEBD335725E396853B57cFacAfE2b1CDCe5D85f"}

  // transfer ownership to the MasterAdaSwap contract
  await AdaSwapToken.transferOwnership(MasterAdaSwap.address);
  console.log(` 💰 Transferring ownership to ${MasterAdaSwap.address}`);
  await EmptyRewarder.transferOwnership(MasterAdaSwap.address);
  console.log(` 💰 Transferring ownership to ${MasterAdaSwap.address}`);

  console.log(
    " 💾  Artifacts (address, abi, and args) saved to: ",
    chalk.blue("artifacts/"),
    "\n\n"
  );
};

const deploy = async (
  contractName,
  _args = [],
  overrides = {},
  libraries = {}
) => {
  console.log(` 🛰  Deploying: ${contractName}`);

  const contractArgs = _args || [];
  const contractArtifacts = await ethers.getContractFactory(contractName, {
    libraries: libraries,
  });
  const deployed = await contractArtifacts.deploy(...contractArgs, overrides);
//   const encoded = abiEncodeArgs(deployed, contractArgs);
  fs.writeFileSync(`artifacts/${contractName}.address`, deployed.address);

  let extraGasInfo = "";
  if (deployed && deployed.deployTransaction) {
    const gasUsed = deployed.deployTransaction.gasLimit.mul(
      deployed.deployTransaction.gasPrice
    );
    extraGasInfo = `${utils.formatEther(gasUsed)} ETH, tx hash ${
      deployed.deployTransaction.hash
    }`;
  }

  console.log(
    " 📄",
    chalk.cyan(contractName),
    "deployed to:",
    chalk.magenta(deployed.address)
  );
  console.log(" ⛽", chalk.grey(extraGasInfo));

//   await tenderly.persistArtifacts({
//     name: contractName,
//     address: deployed.address,
//   });

//   if (!encoded || encoded.length <= 2) return deployed;
//   fs.writeFileSync(`artifacts/${contractName}.args`, encoded.slice(2));

  return deployed;
};

// ------ utils -------

// abi encodes contract arguments
// useful when you want to manually verify the contracts
// for example, on Etherscan
const abiEncodeArgs = (deployed, contractArgs) => {
  // not writing abi encoded args if this does not pass
  if (
    !contractArgs ||
    !deployed ||
    !R.hasPath(["interface", "deploy"], deployed)
  ) {
    return "";
  }
  const encoded = utils.defaultAbiCoder.encode(
    deployed.interface.deploy.inputs,
    contractArgs
  );
  return encoded;
};

// checks if it is a Solidity file
const isSolidity = (fileName) =>
  fileName.indexOf(".sol") >= 0 &&
  fileName.indexOf(".swp") < 0 &&
  fileName.indexOf(".swap") < 0;

const readArgsFile = (contractName) => {
  let args = [];
  try {
    const argsFile = `./contracts/${contractName}.args`;
    if (!fs.existsSync(argsFile)) return args;
    args = JSON.parse(fs.readFileSync(argsFile));
  } catch (e) {
    console.log(e);
  }
  return args;
};

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// If you want to verify on https://tenderly.co/
const tenderlyVerify = async ({ contractName, contractAddress }) => {
  let tenderlyNetworks = [
    "kovan",
    "goerli",
    "mainnet",
    "rinkeby",
    "ropsten",
    "matic",
    "mumbai",
    "xDai",
    "POA",
  ];
  let targetNetwork = process.env.HARDHAT_NETWORK || config.defaultNetwork;

  if (tenderlyNetworks.includes(targetNetwork)) {
    console.log(
      chalk.blue(
        ` 📁 Attempting tenderly verification of ${contractName} on ${targetNetwork}`
      )
    );

    await tenderly.persistArtifacts({
      name: contractName,
      address: contractAddress,
    });

    let verification = await tenderly.verify({
      name: contractName,
      address: contractAddress,
      network: targetNetwork,
    });

    return verification;
  } else {
    console.log(
      chalk.grey(` 🧐 Contract verification not supported on ${targetNetwork}`)
    );
  }
};

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


