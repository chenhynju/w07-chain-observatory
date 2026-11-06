# Finality and static scan reassessment

AI-Assisted Self-Assessment. Scope is recorded in finality-review.sha256.

- PASS: npm run check and npm test (4/4).
- PASS: Anvil backfill and reserve, swap volume and LP balance reorg assertions.
- PASS: finalized-only request for the live replacement block returned HTTP 409.
- PASS: Semgrep TypeScript registry bundle downloaded on Windows and loaded locally in WSL. 74 rules ran across 6 TypeScript files, approximately 100% parsed, 0 findings, exit 0.
- Dependency audit: previously 0 for both full and production npm audit. Lockfile unchanged in this round.

W07-M02 is partially mitigated. An opt-in finalized read requires the configured
RPC to attest the height and canonical block hash. Indexed log completeness,
positive finalized acceptance, replaced-hash refusal, and upstream failure
branches still need dedicated end-to-end evidence. PostgreSQL restart and
public Ethereum reconciliation remain unverified.
