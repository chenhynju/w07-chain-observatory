#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/../testnet/fixtures"
out=../../docs/testing/2026-11-07
aderyn . -o "$out/aderyn-fixture.md" >"$out/aderyn-fixture.log" 2>&1
echo "aderyn exit=$?"
slither . --filter-paths "test|script|lib" >"$out/slither-fixture.log" 2>&1
echo "slither exit=$?"
