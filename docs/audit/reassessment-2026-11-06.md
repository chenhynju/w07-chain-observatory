# W07 reassessment — 2026-11-06

AI-Assisted Self-Assessment.

## Remediation

Finality verification now rejects RPC blocks with an incorrect height or invalid
hash shape. The snapshot API invokes the same verifier exercised by the HTTP
tests. Hash comparison accepts equivalent hex casing. Invalid responses and
RPC errors fail closed.

## Executed evidence

- PASS — TypeScript check.
- PASS — 6 tests including 10,000 deterministic integer property inputs.
- PASS — real viem HTTP transport against controlled RPC responses for finalized
  success, an earlier finalized block, pending finality, orphaned hash, RPC
  error, null response and incorrect returned height. Missing client also
  returns unavailable. These are verifier integration tests, not full
  database/API tests for every response branch.
- PASS — independent PostgreSQL 16 and Anvil regression. Sync, Swap and LP
  Transfer branch replacement, unfinalized API rejection and SIGKILL/restart
  with equal snapshot and LP balances. See
  ../testing/finality-2026-11-06/postgres.log.
- PASS — Semgrep, 74 TypeScript rules on 7 files, zero findings. See
  ../testing/finality-2026-11-06/semgrep.log.
- PASS — full npm audit against the current lockfile, zero advisories. Network
  request ran from Windows staging because WSL registry access has been
  unreliable. See ../testing/finality-2026-11-06/npm-audit.json.

## Tool applicability and remaining scope

Slither, Aderyn, Echidna, Medusa, Wake, Halmos, Mythril and Certora have not been
run as audits of W07. The production implementation is TypeScript and has no
Solidity source target. The local EVM fixture creates logs for indexer testing.
A separately authored contract model would need differential validation to
support claims about this indexer.

Independent public-chain log completeness and arbitrary-height snapshot
coverage remain open. A finalized canonical block hash does not prove that
all events were indexed. Default snapshots are explicitly unverified, and LP
views explicitly represent incomplete indexed deltas. Existing database
migration and off-host durability have not been demonstrated. This report
does not grant production release approval.
