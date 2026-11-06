# Test report — 2026-11-07

Environment: WSL2 Ubuntu 24.04, Node 24.20.0, npm 11.19.0, Foundry 1.8.1, solc 0.8.28,
PostgreSQL 16, Next.js 15.5.29. Commands were run from the project root unless noted.

## Results

| Check | Command | Result | Log |
| --- | --- | --- | --- |
| TypeScript | `npm run check` | PASS | [typecheck.log](2026-11-07/typecheck.log) |
| Unit/integration | `npm test` | PASS, 13/13 | [unit-tests.log](2026-11-07/unit-tests.log) |
| Coverage | `npm run coverage` | PASS, 97.19% lines / 86.96% branches / 100% functions | [coverage.log](2026-11-07/coverage.log) |
| Foundry fixture | `npm run fixture:test` | PASS, 8/8 | [fixture-tests.log](2026-11-07/fixture-tests.log) |
| Web typecheck | `npm run web:check` | PASS | [web-typecheck.log](2026-11-07/web-typecheck.log) |
| Web build | `npm run web:build` | PASS | [web-build.log](2026-11-07/web-build.log) |
| Anvil end-to-end | `npm run smoke` | PASS | [smoke-anvil.log](2026-11-07/smoke-anvil.log) |
| PostgreSQL end-to-end | `npm run smoke:postgres` | PASS | [smoke-postgres.log](2026-11-07/smoke-postgres.log) |
| Production audit | `npm audit --omit=dev --registry=https://registry.npmjs.org` | PASS, 0 advisories | [npm-audit.json](2026-11-07/npm-audit.json) |
| Slither (fixture) | `slither .` in `testnet/fixtures` | PASS, 102 detectors, 0 results | [slither-fixture.log](2026-11-07/slither-fixture.log) |
| Aderyn (fixture) | `aderyn .` in `testnet/fixtures` | PASS, 88 detectors, 0 High / 0 Low | [aderyn-fixture.md](2026-11-07/aderyn-fixture.md) |
| Semgrep | `timeout 45 semgrep --version` | BLOCKED, no output before deadline | [semgrep-blocked.log](2026-11-07/semgrep-blocked.log) |

## Unit and integration tests

`test/*.test.ts` covers:

1. Default Ethereum chain resolution and the USDC/WETH pair.
2. Base Sepolia profile, explicit pair, start block and creation block.
3. Rejection of unknown chains, missing pairs, malformed addresses and heights.
4. Height, finality, wallet and raw token amount validation.
5. Coverage completeness rules.
6. Fixed-window rate limiter budget and reset.
7. Response deadline success and timeout paths.
8. Finality verification over a real viem HTTP transport: finalized, earlier finalized,
   pending, orphaned, RPC error, null response and wrong-height responses.
9. Lag probe exit codes for current, stale and ahead checkpoints.
10. 10,000 deterministic integer valuations with floor-rounding bounds, monotonicity and
    scale invariance.
11. Large integer exactness, zero denominator signalling and both swap input legs.

Coverage is measured on the modules imported by the tests. The HTTP route branches are covered
by the Anvil and PostgreSQL end-to-end smoke tests rather than by mocked database objects.

## End-to-end scenarios

Both `scripts/smoke-anvil.sh` and `scripts/smoke-postgres.sh` run the same scenario against a
real EVM and a real database:

1. Load the compiled `PairFixture` runtime at a fixed address.
2. Block 1: `mint(2, 3)` emits Mint → Transfer → Sync. Snapshot 1 must show reserves `2/3`,
   no 24-hour volume, `completeWindow: false`, `finality: unverified` and complete coverage.
3. Advance 86,401 seconds.
4. Block 2: `swapWithPostSync(2, 0, 5)` emits Swap 2 → Sync → Swap 5 in one transaction.
   Snapshot 2 must show reserve0 `4`, 24-hour volume `2` (not `7`) and `completeWindow: true`.
5. `/latest` returns block 2; `/series` returns blocks 1 and 2 in order.
6. `/wallet/<holder>` returns the LP mint; `/lp-holders` returns balance `5`.
7. `/alerts` returns the post-Sync swap `5` when the threshold is 3.
8. Invalid height, finality mode, address, threshold and series bounds return 400; a missing
   Sync returns 404; a finalized-only request for the live block returns 409.
9. Replace block 2 with `mintAndSwapWithPostSync(9, 0, 9, 7)`: new reserves `20/3`, volume `9`
   (not `16`), LP balance `14`. The orphan hash must disappear.
10. SIGKILL Ponder and restart on the same schema: the canonical snapshot and LP balances must
    be identical.

Observed hashes and values are recorded in the smoke logs. They are run-specific and are not
intended as fixed fixtures.

## Reorganization and recovery

The replacement branch changes the reserve row, both swap contributions and the LP balance in
one Ponder-managed transaction. The test proves rollback and replay occur together, not as
independent eventual effects. The PostgreSQL variant additionally proves that a hard process
stop does not duplicate events on restart.

## Coverage gate

The `coverage` script enforces 85% lines, 85% functions and 75% branches on covered modules.
The observed result is 97.19% lines, 86.96% branches and 100% functions. `scripts/lag.mjs`
has lower branch coverage because its process-level failure paths are exercised by child
process exit codes in `test/lag.test.ts`.

## Not run / blocked

- **Public testnet deployment**: pending faucet funding. No transaction is claimed.
- **Semgrep**: tool startup did not complete in this WSL session. The prior 2026-11-06 scan
  covers an older code state and is not reused as a current result.
- **Live mainnet reconciliation**: not run in this session. `scripts/reconcile.mjs` requires
  historical `eth_call` with a canonical block hash.
- **Pair-creation backfill verification**: open.
- **PostgreSQL EXPLAIN ANALYZE** for the alert/series queries: open.
- **Multi-RPC finality quorum**: not implemented.

## Reproduce

```sh
npm ci
npm run check
npm test
npm run coverage
npm run fixture:test
npm run web:check
npm run web:build
npm run smoke
npm run smoke:postgres
```

The smoke tests require free ports 18545 and 14269. The PostgreSQL smoke starts its own
cluster on port 15432 and stops it on exit. Logs are written to the paths above.
