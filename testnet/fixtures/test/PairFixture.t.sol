// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {PairFixture} from "../src/PairFixture.sol";

contract PairFixtureTest is Test {
    PairFixture internal fixture;

    event Sync(uint112 reserve0, uint112 reserve1);
    event Transfer(address indexed from, address indexed to, uint256 value);

    function setUp() public {
        fixture = new PairFixture();
    }

    function testMintUpdatesReservesAndLpBalance() public {
        fixture.mint(2, 3, address(0x11));
        (uint112 reserve0, uint112 reserve1) = fixture.getReserves();
        assertEq(reserve0, 2);
        assertEq(reserve1, 3);
        assertEq(fixture.totalSupply(), 5);
        assertEq(fixture.balanceOf(address(0x11)), 5);
    }

    function testSwapEmitsSyncAfterReserveUpdate() public {
        fixture.mint(2, 3, address(0x11));
        fixture.swap(2, 0, address(0x22));
        (uint112 reserve0, uint112 reserve1) = fixture.getReserves();
        assertEq(reserve0, 4);
        assertEq(reserve1, 3);
    }

    function testSwapWithoutSyncDoesNotChangeReserves() public {
        fixture.mint(2, 3, address(0x11));
        fixture.swapWithoutSync(5, 0, address(0x22));
        (uint112 reserve0, uint112 reserve1) = fixture.getReserves();
        assertEq(reserve0, 2);
        assertEq(reserve1, 3);
    }

    function testBurnReducesReservesAndSupply() public {
        fixture.mint(10, 10, address(this));
        fixture.burn(5, address(0x33));
        (uint112 reserve0, uint112 reserve1) = fixture.getReserves();
        assertEq(reserve0, 8);
        assertEq(reserve1, 8);
        assertEq(fixture.totalSupply(), 15);
        assertEq(fixture.balanceOf(address(this)), 15);
    }

    function testSwapWithPostSyncKeepsOnlyPreSyncAmount() public {
        fixture.mint(2, 3, address(0x11));
        fixture.swapWithPostSync(2, 0, 5, address(0x22));
        (uint112 reserve0, uint112 reserve1) = fixture.getReserves();
        assertEq(reserve0, 4);
        assertEq(reserve1, 3);
    }

    function testMintAndSwapWithPostSyncOrdersLogs() public {
        fixture.mint(2, 3, address(0x11));
        fixture.mintAndSwapWithPostSync(9, 0, 9, 7, address(0x11));
        (uint112 reserve0, uint112 reserve1) = fixture.getReserves();
        assertEq(reserve0, 20);
        assertEq(reserve1, 3);
        assertEq(fixture.totalSupply(), 14);
        assertEq(fixture.balanceOf(address(0x11)), 14);
    }

    function testFuzzMintNeverOverflows(uint112 amount0, uint112 amount1) public {
        vm.assume(amount0 > 0 || amount1 > 0);
        fixture.mint(amount0, amount1, address(0x44));
        (uint112 reserve0, uint112 reserve1) = fixture.getReserves();
        assertEq(reserve0, amount0);
        assertEq(reserve1, amount1);
    }

    function testMintRejectsZeroRecipient() public {
        vm.expectRevert("zero recipient");
        fixture.mint(1, 1, address(0));
    }
}
