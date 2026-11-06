// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {PairFixture} from "../src/PairFixture.sol";

/// @notice Deploys the test-only PairFixture. Never use on mainnet.
contract DeployPairFixture is Script {
    function run() external returns (PairFixture fixture) {
        vm.startBroadcast();
        fixture = new PairFixture();
        vm.stopBroadcast();
        console.log("PairFixture", address(fixture));
    }
}
