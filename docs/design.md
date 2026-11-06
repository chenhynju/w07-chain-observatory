# W07 requirements and design

## Scope and role alignment

- Alchemy Data Services emphasizes ingestion, reorgs, retries and backfill. Acceptance requires deterministic rollback/replay and restart without duplicate counting. https://jobs.ashbyhq.com/alchemy/bca25725-dbdf-4786-9af9-aa793766d2b5
- Token Terminal emphasizes financial metric definitions and SQL lineage. Acceptance requires raw units, reproducible window bounds and reconciliation. https://tokenterminal.com/careers/onchain-analytics-engineer
- Provable emphasizes relational optimization and serving APIs. Acceptance requires indexed query plans, bounded requests and measured lag. https://jobs.ashbyhq.com/provable/a7842603-cea1-43f4-8236-cf745853f5dd

Ponder owns EVM log synchronization, checkpointing and rollback. The application owns ABI bindings, the typed projection and financial semantics. PostgreSQL serves the initial workload. ClickHouse becomes useful when measured analytical query costs justify another storage system. Redis and BullMQ would add consistency and recovery obligations before there is a measured need. Dune is an independent reconciliation surface.

## Data flow and state

Ethereum RPC → Ponder historical and live synchronization → pair_event → SQL read projection → HTTP. One configured pair per database schema. The primary key is the block hash joined with the block-wide log index. Competing branches have distinct identities. Store block hash, log order and timestamp for reproducibility. The handlers write through the framework-managed onchain transaction so changes can participate in rollback. Event kind plus block/log indexes support last Sync lookup and event kind plus timestamp supports range aggregation. Reorg/restart behavior requires application-level fault injection verification.

## Metric semantics

USDC/WETH is the default pair. Reserve units follow the underlying ERC-20 decimals. TVL in raw token0 units is r0 + floor(r1 × r0 / r1), with a null mark if r1 is zero. This is a pool-implied mark and is manipulable. Volume is the sum of swap input legs by token over the trailing 86,400 seconds including the lower endpoint. The preview values input flows at end-of-block spot and estimates gross annual fee basis points as floor(marked volume × 30 × 365 / marked TVL). This assumes 30 basis points per swap and ignores protocol fee dilution and changing valuation. It is not realized LP yield. Partial windows at the start of indexing can undercount.

LP holdings should sum Transfer credits minus debits from pair creation, excluding the zero-address account and retaining locked minimum liquidity in supply reconciliation. The preview retains the source events. Distribution and whale thresholds still require read models. Alerts must use canonical log identity and distinguish provisional from finalized observations.

## Acceptance and threat model

1. Validate arbitrary indexed height using its timestamp and last Sync at or before the height. Anchor the query to a ready checkpoint, verify the block hash and compare with archive RPC getReserves at the same height. The current endpoint restricts queries to Sync blocks and does not certify checkpoint completeness.
2. Mine transactions, snapshot, replace a branch and verify the orphan disappears and the replacement affects totals once. Restart against persistent Postgres and repeat. Include same-block multiple Sync and transfer ordering.
3. Measure lag relative to target chain head and provide readiness separately from process liveness. Simulate 429, timeout and incomplete historical responses. Never declare a range complete based on a knowingly partial RPC response.
4. Bound historical reads, apply quotas before public exposure, keep RPC/DB credentials server-side and use dedicated database roles. The preview is for local use.
5. Record audit scope at a frozen commit, triage integrity, availability and resource exhaustion, attach runnable PoCs and record fix regression and residual risks. Method adapted from Code4rena submission guidance https://docs.code4rena.com/competitions/submission-guidelines. Solidity scanners are out of scope for this read-only TypeScript service. Dependency audit and end-to-end adversarial tests remain separate evidence.

## Walkthrough exercise

Trace two swaps in one block. Explain why the last Sync determines end-of-block reserves but neither Swap can be discarded. Then replace that block and verify why both the reserve row and both volume contributions must roll back together. Compare raw token amounts using integer arithmetic before formatting decimals.

## API surface

- `GET /metadata` — chain id, pair, indexing window, coverage, limits and finality mode.
- `GET /latest` — latest indexed Sync snapshot with the same payload as `/snapshot`.
- `GET /snapshot/:height` — last Sync at that height; optional `?finality=finalized`.
- `GET /series?from=&to=&limit=` — bounded Sync series for charting (1–500 points).
- `GET /wallet/:address` — latest 50 LP Transfer events for one address.
- `GET /alerts?minToken0=&height=` — up to 25 swaps in the preceding 7,200 blocks.
- `GET /lp-holders` — top 25 positive projected LP balances with explicit coverage.
- `GET /` — legacy inline preview; the Next.js dashboard lives in `apps/web`.

All responses carry `Cache-Control: no-store`, security headers and the chain/pair identity.
The API applies a per-process fixed-window rate limit and a response deadline around each
database query. Invalid heights, finality modes, addresses, thresholds and series bounds
return 400; a missing Sync returns 404; an unavailable or pending finality check fails closed.

## Same-block boundary

A snapshot is anchored to the **last Sync log** at the requested height. For the 24-hour
volume query, swaps are included only when:

```text
swap.block < sync.block
OR (swap.block = sync.block AND swap.log <= sync.log)
```

This prevents a swap after the defining Sync in the same block from entering the window.
The `PairFixture` emits Swap → Sync → post-Sync Swap in one transaction, and the integration
smoke test asserts that only the pre-Sync input is counted.

## Current implementation limits

The Next.js dashboard reads `/metadata`, `/latest`, `/series`, `/lp-holders` and `/alerts`
server-side. The legacy inline page remains available at `/`. LP balances remain incomplete
unless indexing starts at pair creation; the API discloses this through `coverage` and
`coverageDetail` instead of silently ranking partial data. Alert dispatch, multi-RPC finality
quorum, historical log-completeness proof and shared rate limiting remain open. The testnet
event source is a test-only `PairFixture`; it is not a production market.

