# W07 Chain Observatory

A TypeScript indexer for Uniswap V2 pair events with block-addressable reserve and swap analytics.

## Quick start

Use Ubuntu 24.04 under WSL with Node 24. Copy `.env.example` to `.env`, configure an Ethereum RPC with historical log access, install dependencies, and run `npm run dev`. The preview endpoint is `GET /snapshot/<height>` for a block containing Sync. Use a fresh database schema when changing the pair or start height. PostgreSQL is optional for development and intended for persistent serving.

See [requirements, design and limitations](docs/design.md), [event handlers](src/index.ts), [query implementation](src/api/index.ts), and [integer arithmetic tests](test/math.test.ts).

Open the indexer root in a browser for the snapshot, LP transfer history and large token0 input views. The wallet endpoint serves the latest 50 LP transfer events. The alerts endpoint requires a decimal end height and serves up to 25 matching swaps within the preceding 7,200 blocks, inclusive of the end height. It does not dispatch notifications.

Ponder exposes /health (process liveness), /ready (initial sync readiness), /status (checkpoint) and /metrics (Prometheus). Run `node --env-file=.env scripts/lag.mjs` to compare the checkpoint with RPC head. The command exits nonzero on failures or lag exceeding MAX_LAG_BLOCKS (default 12).

To check indexed reserves against the chain, run `node --env-file=.env scripts/reconcile.mjs <sync-block>`. The RPC must support historical state and canonical block-hash eth_call. This command compares both reserves at the exact snapshot hash.

Run `npm run check` and `npm test` for static types and unit tests. With Foundry's Anvil and Cast on PATH, run `bash scripts/smoke-anvil.sh` to exercise the indexer on localhost. The smoke test requires free ports 18545 and 14269 and leaves its temporary PGlite database and logs available for inspection. It emits a real EVM Sync log with fixture bytecode, checks indexed reserves, then attempts a live branch replacement and verifies the new block hash and reserve value.

`GET /lp-holders` returns up to 25 positive LP balance deltas in raw LP units with an explicit incomplete coverage flag. Its ranking requires the Transfer stream from pool creation. Locked minimum liquidity at the zero address is excluded. See the [dependency security assessment](docs/audit/dependency-triage.md) for the current public release gate.

Snapshot responses carry `finality: "unverified"` and are served with `Cache-Control: no-store`. The 24-hour volume and APR are null until the snapshot is at least 24 hours after the first observed Sync. That conservative time bound does not independently prove RPC log completeness.

For a canonical finalized snapshot, request `/snapshot/<height>?finality=finalized`. The server compares the stored hash with the configured RPC's canonical block and checks the RPC finalized height. It returns 409 for a live or replaced block and 503 when verification is unavailable. This check attests the snapshot block against the trusted RPC. Historical log completeness is a separate check.

The [Solidity verification model](verification/solidity/README.md) records
Slither, Aderyn, Halmos, Echidna, Medusa, Wake and Mythril execution against a
bounded valuation model, with on-chain differential checks against TypeScript.
Its coverage and Certora status are listed separately from indexer acceptance.
