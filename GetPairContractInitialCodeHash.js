let pair = require('@adaswap/core/build/UniswapV2Pair.json')
let solidity = require('@ethersproject/solidity')

console.log(solidity.keccak256(['bytes'], [`${pair.bytecode}`]))