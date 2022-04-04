let pair = require('@adaswap-dev/core/build/AdaswapPair.json')
let solidity = require('@ethersproject/solidity')

console.log(solidity.keccak256(['bytes'], [`${pair.bytecode}`]))