// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;
import {ValuationModel} from "../src/ValuationModel.sol";

/// @notice Forge fuzz and Halmos symbolic properties over the bounded model.
contract ValuationTest is ValuationModel {
    function testFuzz_rounding(uint112 a, uint112 b, uint112 r0, uint112 r1) public pure {
        (bool valid, uint256 value) = mark(a, b, r0, r1);
        if (r1 == 0) {
            assert(!valid && value == 0);
            return;
        }
        assert(valid);
        uint256 exact = uint256(a) * r1 + uint256(b) * r0;
        assert(value * r1 <= exact);
        assert(exact - value * r1 < r1);
    }

    function check_zeroDenominator(uint112 a, uint112 b, uint112 r0) public pure {
        (bool valid, uint256 value) = mark(a, b, r0, 0);
        assert(!valid && value == 0);
    }

    function check_zeroToken1(uint112 a, uint112 r0, uint112 r1) public pure {
        (bool valid, uint256 value) = mark(a, 0, r0, r1);
        assert(valid == (r1 != 0));
        assert(value == (r1 == 0 ? 0 : uint256(a)));
    }

    function check_unitPrice(uint112 a, uint112 b) public pure {
        (bool valid, uint256 value) = mark(a, b, 1, 1);
        assert(valid && value == uint256(a) + uint256(b));
    }
}
