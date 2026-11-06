# W07 AI-Assisted Self-Assessment

Scope is fixed by [SHA-256 manifest](review-scope.sha256). This directory currently has no Git commit to identify. Verify from the project root with `sha256sum -c docs/audit/review-scope.sha256`. External scope excludes the pair contract, RPC implementation, and Ponder internals. Their behavior remains a trust assumption.

## Method

Map entry points, trusted roles, value semantics and invariants, then trace source, construct counterexamples, and separate dependency severity from application reachability. The report borrows manual review, fuzz/invariant design and actionable findings from [Parapet Labs](https://parapetlabs.net/careers), and severity and reproducibility expectations from [Code4rena](https://docs.code4rena.com/competitions/submission-guidelines). This is an internal reassessment.

## W07-M01 — Incomplete history is returned as a complete financial view

- Affected code: `ponder.config.ts` accepts any nonnegative START_BLOCK. `src/api/index.ts` returns volume and LP rankings with no coverage or completeness flag.
- Preconditions: first day of coverage, or a configured pair indexed from after creation.
- Counterexample: Alice receives 100 LP before START_BLOCK, then transfers 40 to Bob after it. The projection sees -40 and +40. The ranking filters negative balances, so Alice disappears and Bob is ranked above the missing 60. Likewise the first snapshot can report a 24-hour volume with only minutes of coverage.
- Impact: consumers can ingest materially wrong liquidity distribution, volume and gross fee estimates.
- Fix and regression: validate or explicitly backfill from verified pair creation for the LP view. Surface coverage bounds and suppress incomplete 24-hour values. Run the late-start counterexample against the actual API before accepting the fix. This counterexample was derived from source; API PoC pending.

## W07-M02 — Snapshot can be served before indexing completeness or finality

- Affected code: `src/api/index.ts` snapshot selects a Sync and aggregates available swaps. It never compares the requested height with an indexed checkpoint and never exposes finality status.
- Preconditions: query during catch-up, or before a live block becomes finalized. Ponder exposes readiness and checkpoints separately.
- Impact: clients cannot distinguish provisional data and can cache a branch later removed by rollback. One SQL statement prevents cross-statement inconsistency but cannot certify that ingestion is complete.
- Evidence: prior Anvil fixture shows two hashes and distinct reserves at the same height. This establishes provisional results, not an observed mid-block partial write.
- Fix and regression: return checkpoint and finality metadata, and offer finalized-only results using a canonical checkpoint. Test old hash, replacement hash and a request above the verified checkpoint.

## W07-L01 — Alert result limit leaves scan work unbounded

- Affected code: `GET /alerts` orders by height and filters on input amount. The schema has an ordering index but no height window on this endpoint.
- Preconditions: large retained swap history and a threshold that matches few or zero swaps.
- Impact: repeated queries may traverse a large fraction of swap history. Severity remains low until measured with a representative data set.
- Fix and regression: apply a bounded block or timestamp window, enforce query timeouts and a request budget, and measure the no-match query with PostgreSQL EXPLAIN ANALYZE. Load PoC pending.

## Release decision

The previous lockfile audit found 10 high and 5 moderate dependency advisories. See [dependency triage](dependency-triage.md). Those counts are not app findings. The public release gate remains failed pending advisory remediation and integration verification. Local historical evidence demonstrates Sync branch replacement. LP balance and Swap rollback, PostgreSQL restart, and public RPC reconciliation require separate evidence.

## Reassessment execution evidence

- PASS — `npm run check`, `npm test` (4/4), and source manifest verification.
- BLOCKED — WSL dependency advisory rerun timed out (exit 124); no JSON report. The earlier completed scan remains the latest dependency evidence.
- BLOCKED — Semgrep binary is installed but tool startup did not produce a version within the bounded probe; no static scan result was obtained.
- N/A — Slither for the scoped TypeScript indexer. Foundry/Anvil are used to provide local EVM fixtures.
- NOT RUN — New end-to-end reorg campaign and application exploit PoCs. The earlier Anvil output is historical evidence.
