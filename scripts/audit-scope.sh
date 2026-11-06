#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
out=${1:-docs/audit/scope-$(date -u +%Y-%m-%d).sha256}
{
  printf '%s\n' \
    ponder.config.ts ponder.schema.ts tsconfig.json package.json package-lock.json \
    apps/web/package.json apps/web/package-lock.json apps/web/next.config.ts apps/web/tsconfig.json apps/web/next-env.d.ts \
    testnet/fixtures/foundry.toml
  find src test scripts apps/web/app apps/web/components apps/web/lib \
    testnet/fixtures/src testnet/fixtures/test testnet/fixtures/script \
    -type f \( -name '*.ts' -o -name '*.tsx' -o -name '*.mjs' -o -name '*.sh' -o -name '*.sol' \) -print
} | sort -u | xargs sha256sum > "$out"
cat "$out"
