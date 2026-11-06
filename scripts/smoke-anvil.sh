#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export RPC_URL=http://127.0.0.1:18545
export INDEXER_URL=http://127.0.0.1:14269
export W07_CHAIN=ethereum
export PAIR_ADDRESS=0x1000000000000000000000000000000000000001
export START_BLOCK=1
export PAIR_CREATION_BLOCK=1
export PONDER_TELEMETRY_DISABLED=1
holder=0x0000000000000000000000000000000000000011
sender=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

logs=$(mktemp -d)
if curl -sS --max-time 1 "$RPC_URL" >/dev/null 2>&1 ||
   curl -sS --max-time 1 "$INDEXER_URL/health" >/dev/null 2>&1; then
  echo "Smoke test ports 18545 and 14269 must be free" >&2
  exit 1
fi

if [[ -z ${W07_TEST_DATABASE_URL:-} ]]; then
  export PGLITE_DIR="$logs/db"
else
  unset PGLITE_DIR DATABASE_PRIVATE_URL
  export DATABASE_URL="$W07_TEST_DATABASE_URL"
fi

# Build the test-only pair fixture and load its runtime bytecode at a fixed address.
(cd testnet/fixtures && forge build --silent >/dev/null)
runtime=$(node -e 'const a=require("./testnet/fixtures/out/PairFixture.sol/PairFixture.json"); process.stdout.write(a.deployedBytecode.object)')
runtime=${runtime#0x}

anvil --chain-id 1 --port 18545 --silent >"$logs/anvil.log" 2>&1 &
anvil_pid=$!
cleanup() {
  if [[ -n ${ponder_pid:-} ]]; then
    kill "$ponder_pid" 2>/dev/null || true
    for _ in {1..10}; do
      kill -0 "$ponder_pid" 2>/dev/null || break
      sleep 1
    done
    kill -KILL "$ponder_pid" 2>/dev/null || true
    wait "$ponder_pid" 2>/dev/null || true
  fi
  kill "$anvil_pid" 2>/dev/null || true
  wait "$anvil_pid" 2>/dev/null || true
  echo "Smoke logs: $logs"
}
trap cleanup EXIT

rpc() { cast rpc --rpc-url "$RPC_URL" "$@"; }
for _ in {1..30}; do rpc eth_blockNumber >/dev/null 2>&1 && break; sleep 1; done
kill -0 "$anvil_pid"
rpc eth_blockNumber >/dev/null
rpc anvil_setCode "$PAIR_ADDRESS" "0x$runtime" >/dev/null

send() {
  cast send --rpc-url "$RPC_URL" --unlocked --from "$sender" "$PAIR_ADDRESS" "$@" >/dev/null
}
get() { curl -fsS --max-time 5 "$INDEXER_URL$1"; }
status_of() { curl -sS --max-time 5 -o "$2" -w '%{http_code}' "$INDEXER_URL$1"; }
await_reserve() {
  local height=$1 expected=$2 body=""
  for _ in {1..90}; do
    body=$(get "/snapshot/$height" 2>/dev/null || true)
    if [[ "$body" == *'"reserve0":"'"$expected"'"'* ]]; then
      printf '%s\n' "$body"
      return 0
    fi
    sleep 1
  done
  tail -50 "$logs/ponder.log" >&2
  return 1
}

# Block 1: Mint 2 token0 + 3 token1 to the holder. This creates the first Sync.
send "mint(uint256,uint256,address)" 2 3 "$holder"

schema="smoke_$(date +%s)_$$"
node_modules/.bin/ponder start --hostname 127.0.0.1 --port 14269 \
  --log-level debug --schema "$schema" >"$logs/ponder.log" 2>&1 &
ponder_pid=$!
for _ in {1..180}; do
  if curl -fsS --max-time 3 "$INDEXER_URL/ready" >/dev/null 2>&1; then break; fi
  kill -0 "$ponder_pid" 2>/dev/null || { cat "$logs/ponder.log"; exit 1; }
  sleep 1
done
curl -fsS --max-time 3 "$INDEXER_URL/ready" >/dev/null

initial=$(await_reserve 1 2)
printf '%s\n' "$initial" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.block, "1");
  assert.equal(data.reserve0, "2");
  assert.equal(data.reserve1, "3");
  assert.equal(data.volume24h, null);
  assert.equal(data.completeWindow, false);
  assert.equal(data.finality, "unverified");
  assert.equal(data.historyStartBlock, "1");
  assert.equal(data.coverage.complete, true);
  console.log(JSON.stringify({ block: data.block, hash: data.hash, reserve0: data.reserve0 }));
'

metadata=$(get /metadata)
printf '%s\n' "$metadata" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.chain, "ethereum");
  assert.equal(data.chainId, 1);
  assert.equal(data.pair, "0x1000000000000000000000000000000000000001");
  assert.equal(data.coverage.complete, true);
  assert.equal(data.limits.alertsWindowBlocks, 7200);
  console.log("metadata ok");
'

headers=$(curl -sS -D - -o /dev/null --max-time 5 "$INDEXER_URL/metadata")
grep -qi '^cache-control: no-store' <<<"$headers"
grep -qi '^x-content-type-options: nosniff' <<<"$headers"
grep -qi '^x-frame-options: DENY' <<<"$headers"
grep -qi '^x-chain-id: 1' <<<"$headers"
grep -qi "^x-pair-address: $PAIR_ADDRESS" <<<"$headers"

# Block 2: Swap 2 before Sync, then Swap 5 after Sync in the same transaction.
rpc evm_increaseTime 86401 >/dev/null
fork=$(rpc evm_snapshot | tr -d '"')
send "swapWithPostSync(uint256,uint256,uint256,address)" 2 0 5 "$holder"
original=$(await_reserve 2 4)
printf '%s\n' "$original" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.block, "2");
  assert.equal(data.reserve0, "4");
  assert.equal(data.reserve1, "3");
  assert.equal(data.completeWindow, true);
  assert.equal(data.volume24h.token0, "2", "post-Sync swap must be excluded");
  assert.equal(data.volume24h.token1, "0");
  assert.equal(data.finality, "unverified");
  console.log(JSON.stringify({ block: data.block, hash: data.hash, volume0: data.volume24h.token0 }));
'

holders=$(get /lp-holders)
printf '%s\n' "$holders" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.complete, true);
  assert.equal(data.holders[0].balance, "5");
  console.log(JSON.stringify({ holder: data.holders[0] }));
'

wallet=$(get "/wallet/$holder")
printf '%s\n' "$wallet" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.length, 1);
  assert.equal(data[0].amount, "5");
  console.log("wallet transfer history ok");
'

alerts=$(get "/alerts?minToken0=3&height=2")
printf '%s\n' "$alerts" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.length, 1);
  assert.equal(data[0].token0In, "5");
  console.log("large input alert feed ok");
'

latest=$(get /latest)
printf '%s\n' "$latest" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.block, "2");
  assert.equal(data.reserve0, "4");
  assert.equal(data.volume24h.token0, "2");
  console.log("latest snapshot ok");
'

series=$(get "/series?from=1&to=2&limit=10")
printf '%s\n' "$series" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.length, 2);
  assert.equal(data[0].block, "1");
  assert.equal(data[1].block, "2");
  assert.equal(data[1].reserve0, "4");
  console.log("sync series ok");
'

check_status() {
  local expected=$1 path=$2 file="$logs/status.json"
  local actual
  actual=$(status_of "$path" "$file")
  if [[ "$actual" != "$expected" ]]; then
    echo "Expected HTTP $expected for $path, got $actual" >&2
    cat "$file" >&2
    exit 1
  fi
}
check_status 400 "/snapshot/abc"
check_status 400 "/snapshot/1?finality=latest"
check_status 404 "/snapshot/999999"
check_status 400 "/wallet/0x123"
check_status 400 "/alerts?minToken0=0&height=2"
check_status 400 "/alerts?minToken0=1"
check_status 400 "/series?from=2&to=1"
check_status 400 "/series?from=1&to=2&limit=501"
check_status 400 "/series?from=1"
finality_status=$(status_of "/snapshot/2?finality=finalized" "$logs/finality.json")
if [[ "$finality_status" == "409" ]]; then
  grep -Fq 'Block is not yet finalized' "$logs/finality.json"
fi
printf 'Finalized-only request for live block: HTTP %s\n' "$finality_status"

# Replace block 2 with a new branch: mint 9 LP and swap 9 before, swap 7 after Sync.
[[ $(rpc evm_revert "$fork") == true ]]
rpc evm_increaseTime 86401 >/dev/null
send "mintAndSwapWithPostSync(uint256,uint256,uint256,uint256,address)" 9 0 9 7 "$holder"
replacement=$(await_reserve 2 20)
printf '%s\n' "$replacement" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.block, "2");
  assert.equal(data.reserve0, "20");
  assert.equal(data.reserve1, "3");
  assert.equal(data.completeWindow, true);
  assert.equal(data.volume24h.token0, "9", "post-Sync swap must be excluded");
  console.log(JSON.stringify({ block: data.block, hash: data.hash, reserve0: data.reserve0 }));
'
node -e '
  const assert = require("node:assert/strict");
  const original = JSON.parse(process.argv[1]);
  const replacement = JSON.parse(process.argv[2]);
  assert.notEqual(original.hash, replacement.hash);
  console.log(JSON.stringify({ orphan: original.hash, canonical: replacement.hash }));
' "$original" "$replacement"

replacement_holders=$(get /lp-holders)
printf '%s\n' "$replacement_holders" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.holders[0].balance, "14");
  console.log("LP balance rollback and replay ok");
'

latest_replacement=$(get /latest)
printf '%s\n' "$latest_replacement" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.block, "2");
  assert.equal(data.reserve0, "20");
  assert.equal(data.volume24h.token0, "9");
  console.log("latest snapshot after reorg ok");
'

# A hard process stop must not duplicate events on restart.
kill -KILL "$ponder_pid"
wait "$ponder_pid" 2>/dev/null || true
node_modules/.bin/ponder start --hostname 127.0.0.1 --port 14269 \
  --schema "$schema" >"$logs/restart.log" 2>&1 &
ponder_pid=$!
for _ in {1..120}; do
  if curl -fsS --max-time 3 "$INDEXER_URL/ready" >/dev/null 2>&1; then break; fi
  kill -0 "$ponder_pid" 2>/dev/null || { cat "$logs/restart.log"; exit 1; }
  sleep 1
done
restarted=$(await_reserve 2 20)
restarted_holders=$(get /lp-holders)
node -e '
  const assert = require("node:assert/strict");
  assert.deepEqual(JSON.parse(process.argv[1]), JSON.parse(process.argv[2]));
  assert.deepEqual(JSON.parse(process.argv[3]), JSON.parse(process.argv[4]));
  console.log("Crash restart preserves canonical snapshot and LP balances");
' "$replacement" "$restarted" "$replacement_holders" "$restarted_holders"
