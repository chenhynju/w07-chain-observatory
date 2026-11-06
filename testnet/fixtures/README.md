# Pair fixture (test-only)

This Foundry project exists solely to exercise the W07 indexer on a local Anvil
chain and on public testnets. `PairFixture` emits Uniswap V2-shaped `Swap`,
`Mint`, `Burn`, `Sync` and `Transfer` events and tracks synthetic reserves.

It does **not** hold tokens, execute swaps, provide liquidity, or carry any
financial value. Do not deploy it to a network where it could be mistaken for a
production AMM.

## Commands

```sh
forge build
forge test -vv
forge script script/DeployPairFixture.s.sol:DeployPairFixture \
  --rpc-url "$RPC_URL" --broadcast --private-key "$PRIVATE_KEY"
```

`swap` emits `Swap` then `Sync`. `swapWithoutSync` emits only `Swap`; it exists
to prove that a snapshot anchored to the last `Sync` log in a block excludes
events that occur after that log.
