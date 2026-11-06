# W07 remediation review — 2026-11-05

AI-Assisted Self-Assessment. Scope recorded in remediation-scope.sha256.

| Finding | Status | Evidence |
| --- | --- | --- |
| W07-M01 | Mitigated | Snapshot suppresses volume and APR when fewer than 24 hours separate the first observed Sync and requested Sync. LP endpoint explicitly returns incomplete indexed deltas. Pair-creation coverage and RPC completeness remain unproven. |
| W07-M02 | Open | Snapshot is labeled unverified and HTTP caching is disabled. Canonical readiness and finality still lack a checkpoint guard. |
| W07-L01 | Mitigated | Alerts require an end height and constrain the query to 7,200 blocks. PostgreSQL plan and load verification remain pending. |

## Executed verification

- PASS: npm run check and npm test (4/4).
- PASS: TMPDIR=/dev/shm bash scripts/smoke-anvil.sh. Early snapshot returned completeWindow=false, volume24h=null and annualizedGrossFeeBps=null. The reorg replaced block hash 0x95859448bc869e5bd65cbde2450f8fa61f071edd70d6b7d8f1495b519368cc07 with 0x7f9784b3778d1ae7c4b80d8dd5c3041df1df24287feebcff3f4fe1ef25e3744d and changed reserve0 to 9.
- FAIL: npm audit --omit=dev against the current lockfile in Windows staging. 10 high and 5 moderate dependency advisories.
- Candidate only: Hono 4.13.16 and viem 2.57.16 staged lockfile yielded 8 high and 4 moderate advisories. Candidate was not applied to the project and has no build or compatibility evidence.
- NOT RUN: LP or Swap reorg regression, restart deduplication, fresh Semgrep results, public-chain reconciliation.

Release gate: FAIL.
