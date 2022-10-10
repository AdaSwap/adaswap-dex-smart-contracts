const { ethers, Signer, Wallet, utils, constants, Contract, BigNumber } = require("ethers")
const { ecsign } = require('ethereumjs-util')
require('dotenv').config({path:'../.env'});


// connect to Milkomeda testnet
const provider = new ethers.providers.JsonRpcProvider(
    process.env.MILKOMEDA_TESTNET_PROVIDER
);
// get wallets
const signer = new Wallet(process.env.SIGNER_PK, provider);
const admin = new Wallet(process.env.ADMINT_PK, provider);

// deployed contracts addresses
const FACTORY_ADDRESS = ''
const ROUTER_ADDRESS = ''

// explorer url
const networkName = 'testnet'
const explorerUrl = {
    'mainnet': 'https://explorer-mainnet-cardano-evm.c1.milkomeda.com',
    'testnet': 'https://explorer-devnet-cardano-evm.c1.milkomeda.com'
}

const router = new Contract(
    ROUTER_ADDRESS, 
    require('../artifacts/contracts/AdaswapRouter02.sol/AdaswapRouter02.json').abi, 
    provider
);
const factory = new Contract(
    FACTORY_ADDRESS, 
    require('@adaswap/core/artifacts/contracts/AdaswapFactory.sol/AdaswapFactory.json').abi, 
    provider
);

async function getEthBalance(address) {
    let balance = await provider.getBalance(address);
    return balance;
}

function sleep(ms) {
    return new Promise((resolve) => {
      setTimeout(resolve, ms);
    });
}

async function getBlockTimestamp(){
    let blockNumber = await provider.getBlockNumber()
    blockNumber = await provider.getBlock(blockNumber)
    return blockNumber.timestamp;
}

async function getPairContract(tokenA, tokenB) {
    const pair = await factory.getPair(tokenA, tokenB)
    console.log(`Pair address: ${pair}`);
    return pair
}

function getTokenContract(tokenAddress) {
    return new Contract(
        tokenAddress, 
        require('@adaswap/core/artifacts/contracts/AdaswapPair.sol/AdaswapPair.json').abi, 
        provider
    );
}

async function approveToken(signer, tokenAddress, to, amount) {
    const token = getTokenContract(tokenAddress);
    let result = await token.connect(signer).approve(to, amount);
    console.log(`Token approved: ${explorerUrl[networkName]}/tx/${result.hash}`);
}

async function getTokenBalance(tokenAddress, accountAddress) {
    const token = getTokenContract(tokenAddress);
    let symbol = await token.symbol();
    let balance = await token.balanceOf(accountAddress);
    let decimals = await token.decimals();
    console.log(`Your ${symbol} balance: ${(balance.div(10**decimals)).toFixed(4)}`);
}

async function getTokenAllowance(tokenAddress, ownerAddress, spenderAddress) {
    const token = getTokenContract(tokenAddress);
    let allowance = await token.allowance(ownerAddress, spenderAddress);
    console.log(`Token allowance: ${allowance}`);
}

// async function swapTokenToToken(signer, amountIn, path) {
//     let timestamp = await getBlockTimestamp();
//     let tx = await router.connect(signer).swapExactTokensForTokens(
//         amountIn,
//         0, 
//         path,
//         signer.address, 
//         timestamp + 1000,
//         authorizations,
//         {
//             gasLimit: '15000000'
//         }
//     );
//     console.log(`Swap successful: ${explorerUrl[networkName]}/tx/${result.hash}`);
// }


async function main() {

}