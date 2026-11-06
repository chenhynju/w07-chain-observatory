#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")/.."
for name in ponder anvil; do
  if [[ -f ".runtime/$name.pid" ]]; then
    kill "$(cat ".runtime/$name.pid")" 2>/dev/null || true
    rm -f ".runtime/$name.pid"
  fi
done
echo "Stopped demo processes."
