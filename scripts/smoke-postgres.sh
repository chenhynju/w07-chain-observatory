#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
pgbin=/usr/lib/postgresql/16/bin
work=$(mktemp -d)
"$pgbin/initdb" -D "$work/data" --auth=trust --no-locale >"$work/init.log"
# Unix socket only for administration; loopback TCP is used by Ponder.
"$pgbin/pg_ctl" -D "$work/data" -l "$work/postgres.log" -o "-h 127.0.0.1 -p 15432 -k $work" -w start
trap '"$pgbin/pg_ctl" -D "$work/data" -m fast -w stop; echo "PostgreSQL test evidence: $work"' EXIT
export W07_TEST_DATABASE_URL="postgresql://$(id -un)@127.0.0.1:15432/postgres"
bash scripts/smoke-anvil.sh
