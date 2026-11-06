# W07 final security assessment — 2026-11-07

**AI-Assisted Self-Assessment.** This is not an independent third-party audit. It records
manual review, executable regression tests and tool output for the scoped code. The release
decision is limited to the commit and files listed below.

## Scope

| Item | Value |
| --- | --- |
| Audited code commit | `AUDIT_COMMIT` |
| Report date | 2026-11-07 |
| Runtime | Node 24.20.0, Ponder 0.18.4, Hono 4.13.16, viem 2.57.16, Next.js 15.5.29 |
| Storage | PGlite (tests/local) and PostgreSQL 16 (integration smoke) |
| Chain profiles | Ethereum mainnet, Base Sepolia, Ethereum Sepolia |

In scope:

- `ponder.config.ts`, `ponder.schema.ts`
- `src/chain.ts`, `src/index.ts`, `src/math.ts`, `src/finality.ts`
- `src/api/index.ts`, `src/api/validation.ts`, `src/api/coverage.ts`,
  `src/api/rate-limit.ts`, `src/api/timeout.ts`, `src/api/dashboard.ts`
- `test/*.test.ts`
- `scripts/smoke-anvil.sh`, `scripts/smoke-postgres.sh`, `scripts/lag.mjs`,
  `scripts/reconcile.mjs`, `scripts/deploy-testnet.sh`
- `apps/web/**` (server-side data fetching and rendering only)
- `testnet/fixtures/src/PairFixture.sol` (test-only event source)

Out of scope: Ponder internals, viem/Hono/Next.js internals, the RPC provider, PostgreSQL
internals, `testnet/fixtures/lib`, and the separate `verification/solidity` bounded model
(its own evidence is dated 2026-11-06). The indexer holds no funds and signs no transactions.

## Trusted roles and threat model

Trusted: the configured RPC, the pair address, Ponder's log synchronization, the database, and
the indexer operator. The main assets are data correctness and availability, not user funds.
Primary adversaries: a malicious RPC returning malformed or stale data, a reorg that replaces
a previously served block, a client exhausting expensive queries, and an operator
misconfiguring the indexing window.

## Findings

| ID | Severity | Status | Title |
| --- | --- | --- | --- |
| W07-01 | Medium | Fixed | Post-Sync swaps counted in the 24-hour volume |
| W07-02 | Medium | Fixed | Audit scope was not bound to a Git commit and hash manifests were stale |
| W07-03 | Medium | Mitigated | Complete-history claims without pair-creation coverage |
| W07-04 | Medium | Fixed | Unbounded API resource use and missing response guards |
| W07-05 | Low | Fixed | `CHAIN` environment variable collided with Foundry `cast --chain` |
| W07-06 | Low | Fixed | Default Ethereum pair-creation block was implicitly asserted |
| W07-07 | Low | Accepted | Finality trusts a single RPC without quorum or fallback |
| W07-08 | Info | Fixed | Missing startup validation for RPC, pair and indexing window |
| W07-09 | Info | Accepted | Alert feed is neither finality-filtered nor a notification system |
| W07-10 | Info | Accepted | Testnet fixture is synthetic and has no economic meaning |

### W07-01 — Post-Sync swaps counted in the 24-hour volume (Medium, Fixed)

**Affected code:** `src/api/index.ts`, snapshot aggregation join.

**Preconditions:** a block contains a `Sync` log followed by a `Swap` log. This can happen when
multiple transactions land in one block, or in a synthetic fixture.

**Root cause:** the join selected swaps with `swap.block <= sync.block` plus a timestamp
window, but did not bound the log index. A swap after the defining Sync in the same block was
therefore included even though the Sync's reserves do not reflect it.

**Impact:** overstated 24-hour volume and gross fee APR; a consumer could rank or value a pool
using events that belong to a later state.

**PoC / execution evidence:** the pre-fix fixture emitted `Sync` then `Swap` in one transaction.
After the log boundary was added, `scripts/smoke-anvil.sh` failed with `'0' !== '2'`, proving
that the old query had counted the post-Sync swap. The fixture was corrected to emit
`Swap → Sync → post-Sync Swap`; the regression now asserts volume `2`, not `7`, on the original
branch and `9`, not `16`, on the replacement branch.

**Fix:** the join now uses the block-aware predicate:

```text
swap.block < sync.block
OR (swap.block = sync.block AND swap.log <= sync.log)
```

**Regression:** `scripts/smoke-anvil.sh` (PGlite and PostgreSQL) asserts the post-Sync amount is
excluded on both the original and replacement branches.

**Residual risk:** the lower timestamp boundary still includes the whole block at exactly
`sync.timestamp - 86,400`. Logs do not carry intra-block timestamps, so a second-level window is
not possible. This is documented in `docs/design.md`.

### W07-02 — Audit scope was not bound to a Git commit (Medium, Fixed)

**Affected evidence:** `docs/audit/*.sha256`.

**Observation:** before this review, the directory had no Git repository. Several manifests
failed `sha256sum -c` for `src/api/index.ts`, `src/api/dashboard.ts` and
`scripts/smoke-anvil.sh`. The current code could not be tied to the recorded audit.

**Fix:** initialized Git, froze a pre-remediation baseline at `69c5884`, and added
`docs/audit/scope-2026-11-07.sha256` for the audited code commit. The commit hash is recorded
at the top of this report. The manifest excludes `node_modules`, build outputs and the test
fixture's vendored `forge-std`.

**Residual risk:** the report commit is necessarily after the audited code commit. Reviewers
should verify the manifest against the recorded commit, not against `HEAD` alone.

### W07-03 — Complete-history claims without pair-creation coverage (Medium, Mitigated)

**Affected code:** `src/api/index.ts` (`/lp-holders`, `/snapshot`), `ponder.config.ts`.

**Preconditions:** `START_BLOCK` is later than pair creation, or the operator does not know the
creation block. The old API returned volume and LP rankings without a coverage signal.

**Impact:** a consumer could treat a partial LP ranking or a partial 24-hour window as complete.

**Fix:** `/metadata`, `/snapshot` and `/lp-holders` expose `coverage` with
`configuredStartBlock`, `pairCreationBlock`, `complete` and a machine-readable reason.
`PAIR_CREATION_BLOCK` controls the claim; the Ethereum default is deliberately unset. The
dashboard displays the coverage badge and warns when the window is partial.

**Residual risk:** pair-creation discovery is not automatic. A wrong operator-provided block
would produce a wrong completeness claim. Backfill verification remains open.

### W07-04 — Unbounded API resource use and missing response guards (Medium, Fixed)

**Affected code:** all HTTP routes.

**Preconditions:** a public or shared deployment with repeated or expensive requests.

**Impact:** CPU, database and RPC exhaustion; slow or unavailable preview service.

**Fix:**

- Fixed-window rate limit, default 120 requests/minute per client key, configurable.
- Response deadline around every database query (`REQUEST_TIMEOUT_MS`, default 5,000 ms);
  timeouts return 503.
- `/series` requires ordered `from`/`to` and caps `limit` at 500.
- `/alerts` remains bounded to 7,200 blocks and 25 rows.
- Input validation for heights, addresses, thresholds and finality modes.
- `Cache-Control: no-store`, `X-Content-Type-Options`, `X-Frame-Options`,
  `Referrer-Policy`, `Permissions-Policy` and a restrictive CSP.
- Optional CORS allowlist; no wildcard by default.
- Global error handler returns JSON instead of a stack trace.

**Residual risk:** the limiter is per-process and in-memory. A multi-instance deployment needs a
shared store. The response deadline does not cancel the underlying database query.

### W07-05 — `CHAIN` environment variable collision (Low, Fixed)

`cast` interprets `CHAIN` as its `--chain` option. The first rewritten smoke run failed with
`invalid value 'ethereum' for '--chain'`. The project now uses `W07_CHAIN` everywhere; this is a
reproducibility fix, not a security issue.

### W07-06 — Default pair-creation block was implicitly asserted (Low, Fixed)

The Ethereum profile previously defaulted `pairCreationBlock` to the start block, which could
have produced a false "complete" coverage label. The default is now unset; operators must
provide a verified `PAIR_CREATION_BLOCK` to claim completeness.

### W07-07 — Single-RPC finality trust (Low, Accepted)

`src/finality.ts` compares the indexed hash with the configured RPC's canonical block and
finalized height. It fails closed, but a malicious or lagging RPC can still mislead the check.
No quorum or fallback is implemented. Accepted for the portfolio preview; a production
deployment should use multiple independent RPCs or a light client.

### W07-08 — Missing startup validation (Info, Fixed)

`RPC_URL` used a non-null assertion and the pair address was not validated. `resolveRuntime`
now rejects unsupported chains, missing or malformed pair addresses, malformed block numbers
and values above `Number.MAX_SAFE_INTEGER`, with explicit errors.

### W07-09 — Alert feed semantics (Info, Accepted)

`/alerts` is a bounded read model, not a notification system. It is not finality-filtered and
does not dedupe or dispatch alerts. This is stated in the README, the design document, the API
metadata and the dashboard.

### W07-10 — Testnet fixture is synthetic (Info, Accepted)

`PairFixture` emits Uniswap V2-shaped events and tracks synthetic reserves. It does not move
tokens, execute swaps or hold value. It is deployed only to test the indexer and is labeled as
test infrastructure in every record.

## Tool and test evidence

| Check | Result | Evidence |
| --- | --- | --- |
| TypeScript (`npm run check`) | PASS | `docs/testing/2026-11-07/typecheck.log` |
| Node tests | PASS, 13/13 | `docs/testing/2026-11-07/unit-tests.log` |
| Coverage | PASS, 97.19% lines / 86.96% branches / 100% functions | `docs/testing/2026-11-07/coverage.log` |
| Foundry fixture tests | PASS, 8/8 | `docs/testing/2026-11-07/fixture-tests.log` |
| Next.js typecheck/build | PASS | `docs/testing/2026-11-07/web-typecheck.log`, `web-build.log` |
| Anvil end-to-end | PASS | `docs/testing/2026-11-07/smoke-anvil.log` |
| PostgreSQL 16 end-to-end | PASS | `docs/testing/2026-11-07/smoke-postgres.log` |
| Production npm audit | PASS, 0 advisories | `docs/testing/2026-11-07/npm-audit.json` |
| Semgrep | BLOCKED | `docs/testing/2026-11-07/semgrep-blocked.log`; no findings count claimed |
| Slither on `PairFixture` | PASS, 102 detectors, 0 results | `docs/testing/2026-11-07/slither-fixture.log` |
| Aderyn on `PairFixture` | PASS, 88 detectors, 0 High / 0 Low | `docs/testing/2026-11-07/aderyn-fixture.md` |

The Slither and Aderyn results apply only to the test-only `PairFixture`; the production target
is TypeScript and has no Solidity deployment. The separate `verification/solidity` model retains
its 2026-11-06 Slither, Aderyn, Halmos, Echidna, Medusa, Wake, Mythril and local Certora outputs.
Those results apply to the bounded `markInToken0` model, not to the TypeScript indexer.

## Release decision

- **Code Security Gate: PASS with residual risks.** No unresolved Critical or High finding is
  known for the scoped code. Medium findings are fixed or explicitly mitigated.
- **Economic Security Gate: N/A.** The indexer holds no funds, mints no assets and has no
  incentive math. The relevant gate is data correctness, which is covered by the invariants
  above.
- **Public testnet deployment:** pending faucet funding. The fixture is test-only and the
  deployment record will be written only after real receipts exist.
- **Production release:** not claimed. Single-RPC finality, unproven historical completeness,
  in-memory rate limiting and alert-delivery absence remain open.

## Residual risk register

1. Historical log completeness is not independently proven.
2. Finality relies on one RPC.
3. Pair-creation coverage depends on operator configuration.
4. The 24-hour lower boundary is block-granular.
5. The rate limiter is per-process.
6. The alert feed is not finality-filtered and does not dispatch.
7. The testnet fixture is synthetic.

## Scope manifest

`docs/audit/scope-2026-11-07.sha256` lists the audited source, test, script and dashboard files.
Verify from the repository root:

```sh
sha256sum -c docs/audit/scope-2026-11-07.sha256
```

A mismatch means the working tree has changed since this assessment and the affected files must
be re-reviewed before relying on this report.
