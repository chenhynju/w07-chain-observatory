// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Bounded specification of W07 markInToken0, not a deployed protocol.
/// @dev Inputs are bounded to uint112 so products and sums fit uint256.
contract ValuationModel {
    /// @notice Returns validity and floor-rounded raw token0 value.
    function mark(uint112 amount0, uint112 amount1, uint112 reserve0, uint112 reserve1)
        public pure returns (bool valid, uint256 value)
    {
        if (reserve1 == 0) return (false, 0);
        return (true, uint256(amount0) + uint256(amount1) * reserve0 / reserve1);
    }
}
