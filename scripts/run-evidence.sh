#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
out=docs/testing/2026-11-07
mkdir -p "$out"

npm run check 2>&1 | tee "$out/typecheck.log"
npm test 2>&1 | tee "$out/unit-tests.log"
npm run coverage 2>&1 | tee "$out/coverage.log"
npm run fixture:test 2>&1 | tee "$out/fixture-tests.log"
npm run web:check 2>&1 | tee "$out/web-typecheck.log"
npm run web:build 2>&1 | tee "$out/web-build.log"
npm run smoke 2>&1 | tee "$out/smoke-anvil.log"
npm run smoke:postgres 2>&1 | tee "$out/smoke-postgres.log"
