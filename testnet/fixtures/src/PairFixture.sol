// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title PairFixture
/// @notice Test-only contract that emits Uniswap V2-shaped events and tracks
///         synthetic reserves. It does not hold tokens, execute swaps, or carry
///         any financial value. Deployed only to exercise the W07 indexer.
/// @dev Event signatures intentionally match the production pair ABI in
///      `ponder.config.ts`. `swap` emits Swap then Sync, matching Uniswap V2.
contract PairFixture {
    event Swap(
        address indexed sender,
        uint256 amount0In,
        uint256 amount1In,
        uint256 amount0Out,
        uint256 amount1Out,
        address indexed to
    );
    event Mint(address indexed sender, uint256 amount0, uint256 amount1);
    event Burn(address indexed sender, uint256 amount0, uint256 amount1, address indexed to);
    event Sync(uint112 reserve0, uint112 reserve1);
    event Transfer(address indexed from, address indexed to, uint256 value);

    uint112 public reserve0;
    uint112 public reserve1;
    uint256 public totalSupply;
    mapping(address account => uint256 balance) public balanceOf;

    /// @notice Returns the synthetic reserves in the same shape as a V2 pair.
    function getReserves() external view returns (uint112, uint112) {
        return (reserve0, reserve1);
    }

    /// @notice Adds synthetic liquidity, mints LP units and emits Mint/Transfer/Sync.
    function mint(uint256 amount0, uint256 amount1, address to) external returns (uint256 liquidity) {
        require(to != address(0), "zero recipient");
        reserve0 = _add(reserve0, amount0);
        reserve1 = _add(reserve1, amount1);
        liquidity = amount0 + amount1;
        totalSupply += liquidity;
        balanceOf[to] += liquidity;
        emit Mint(msg.sender, amount0, amount1);
        emit Transfer(address(0), to, liquidity);
        emit Sync(reserve0, reserve1);
    }

    /// @notice Updates reserves and emits Swap then Sync, matching V2 ordering.
    function swap(uint256 amount0In, uint256 amount1In, address to) external {
        require(amount0In != 0 || amount1In != 0, "no input");
        reserve0 = _add(reserve0, amount0In);
        reserve1 = _add(reserve1, amount1In);
        emit Swap(msg.sender, amount0In, amount1In, 0, 0, to);
        emit Sync(reserve0, reserve1);
    }

    /// @notice Emits a Swap log without a following Sync.
    /// @dev Used to prove that a snapshot anchored to an earlier Sync log in the
    ///      same block does not count a later swap.
    function swapWithoutSync(uint256 amount0In, uint256 amount1In, address to) external {
        require(amount0In != 0 || amount1In != 0, "no input");
        emit Swap(msg.sender, amount0In, amount1In, 0, 0, to);
    }

    /// @notice Swap before Sync, then another Swap after Sync in one transaction.
    function swapWithPostSync(uint256 amount0In, uint256 amount1In, uint256 postAmount, address to) external {
        require(amount0In != 0 || amount1In != 0, "no input");
        require(postAmount != 0, "no post input");
        reserve0 = _add(reserve0, amount0In);
        reserve1 = _add(reserve1, amount1In);
        emit Swap(msg.sender, amount0In, amount1In, 0, 0, to);
        emit Sync(reserve0, reserve1);
        emit Swap(msg.sender, postAmount, 0, 0, 0, to);
    }

    /// @notice Mint, swap and post-sync swap in one transaction.
    /// @dev The final Swap is deliberately not followed by a Sync, so a snapshot
    ///      anchored to the last Sync in this block must exclude it.
    function mintAndSwapWithPostSync(
        uint256 amount0,
        uint256 amount1,
        uint256 swapAmount,
        uint256 postAmount,
        address to
    ) external {
        require(to != address(0), "zero recipient");
        require(swapAmount != 0, "no swap input");
        require(postAmount != 0, "no post input");

        reserve0 = _add(reserve0, amount0);
        reserve1 = _add(reserve1, amount1);
        uint256 liquidity = amount0 + amount1;
        totalSupply += liquidity;
        balanceOf[to] += liquidity;
        emit Mint(msg.sender, amount0, amount1);
        emit Transfer(address(0), to, liquidity);
        emit Sync(reserve0, reserve1);

        reserve0 = _add(reserve0, swapAmount);
        emit Swap(msg.sender, swapAmount, 0, 0, 0, to);
        emit Sync(reserve0, reserve1);

        emit Swap(msg.sender, postAmount, 0, 0, 0, to);
    }

    /// @notice Burns LP units, reduces reserves and emits Burn/Transfer/Sync.
    function burn(uint256 liquidity, address to) external {
        require(balanceOf[msg.sender] >= liquidity, "insufficient balance");
        uint256 supplyBefore = totalSupply;
        balanceOf[msg.sender] -= liquidity;
        totalSupply = supplyBefore - liquidity;
        uint112 amount0 = uint112(uint256(reserve0) * liquidity / supplyBefore);
        uint112 amount1 = uint112(uint256(reserve1) * liquidity / supplyBefore);
        reserve0 -= amount0;
        reserve1 -= amount1;
        emit Burn(msg.sender, amount0, amount1, to);
        emit Transfer(msg.sender, address(0), liquidity);
        emit Sync(reserve0, reserve1);
    }

    /// @notice Transfers LP units and emits the standard Transfer event.
    function transferLp(address to, uint256 value) external returns (bool) {
        require(balanceOf[msg.sender] >= value, "insufficient balance");
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    /// @notice Emits the current reserves without changing state.
    function sync() external {
        emit Sync(reserve0, reserve1);
    }

    function _add(uint112 current, uint256 amount) private pure returns (uint112) {
        uint256 next = uint256(current) + amount;
        require(next <= type(uint112).max, "reserve overflow");
        return uint112(next);
    }
}
