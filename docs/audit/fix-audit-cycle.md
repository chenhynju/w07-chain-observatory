# W07 fix and audit cycle — 2026-11-05

AI-Assisted Self-Assessment.

## Dependency audit

The original lockfile returned 10 high and 5 moderate npm advisories.
Isolated candidates yielded 12 findings after the Hono and viem updates,
then 9 after Ponder 0.18.4. The accepted candidate pins five Ponder-scoped
overrides. Both full and production-only npm audit returned zero advisories
against that exact lockfile via the official npm registry from Windows staging.
The five overrides include major upgrades, so application tests are the
evidence for the exercised paths. PostgreSQL migration compatibility requires
a separate test before connecting an existing database.

## Reorganization regression

The extended Anvil fixture emits Sync, Swap and LP Transfer on both competing
branches. It asserts the replacement reserve is 9, 24-hour input volume changes
from 2 to 9, and LP balance changes from 4 to 11 (historical balance 2 plus the
replacement mint 9). The candidate passed offline installation, TypeScript
checking, 4 unit tests, and the extended smoke test. The initial readiness
assertion was updated to wait for indexed data because readiness can precede
live catch-up when the RPC finalized block is genesis.

Observed candidate reorg hashes:

- Orphan: 0x341018d48d5332a1b575322500626f1f85b5cb6d6ce59d723541b4293545c27d
- Replacement: 0x7e886837bb770949f13e26a8c6d5b560151a015f8a6c91f31e1bc5ec2ceaa052

## Remaining gates

- Semgrep: BLOCKED. Version probe and registry rules scans timed out, including
  a 120 second rerun (exit 124). No findings count is available. Candidate
  recovery options are a local rules bundle against the existing engine, or a
  clean isolated Semgrep runtime using the same TypeScript rules.
- Slither: N/A for the TypeScript application. The Anvil bytecode fixture
  exercises event ingestion and is not a production Solidity contract.
- W07-M02: OPEN. The response discloses unverified finality, and the service
  still needs a canonical checkpoint and finality guard.
- PostgreSQL restart/migration and public Ethereum reconciliation: NOT RUN.
- Public release gate: FAIL.
