// SPDX-License-Identifier: MIT

pragma solidity >=0.8.0 <0.9.0;

library Int256 {
  function toUInt256(int256 a) internal pure returns (uint256) {
    require(a >= 0, "Number: Integer < 0");
    return uint256(a);
  }
}

library UInt256 {
  function to128(uint256 a) internal pure returns (uint128 c) {
    require(a <= type(uint128).max, "NumberConverter: uint128 Overflow");
    c = uint128(a);
  }

  function to64(uint256 a) internal pure returns (uint64 c) {
    require(a <= type(uint64).max, "NumberConverter: uint64 Overflow");
    c = uint64(a);
  }
}

library UInt128 {
  function to64(uint128 a) internal pure returns (uint64 c) {
    require(a <= type(uint64).max, "NumberConverter: uint64 Overflow");
    c = uint64(a);
  }
}
