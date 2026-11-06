# PostgreSQL recovery reassessment

AI-Assisted Self-Assessment.

Unsupported finality query values now return HTTP 400 instead of silently
selecting unverified data.

PASS: TypeScript, 5 tests including 10,000 integer property cases, and 74 Semgrep
rules over 6 TypeScript files with zero findings. Dependency lockfile unchanged.

PASS: the isolated PostgreSQL 16 test validates historical ingestion, reserve,
Swap and LP rollback, then kills Ponder and restarts it on the same schema.
Canonical snapshot and LP balances remain equal after recovery.

Command: TMPDIR=/dev/shm bash scripts/smoke-postgres.sh.
Captured execution output is in ../testing/postgres-recovery.log. Original
temporary logs were unavailable after WSL restarted. The test cluster was
stopped successfully. This verifies process recovery, not database host failure.

Finalized-success, mismatched-hash and RPC-failure integration branches and
independent historical log reconciliation remain unverified. Solidity scanners
have no production Solidity source target in this TypeScript application.
