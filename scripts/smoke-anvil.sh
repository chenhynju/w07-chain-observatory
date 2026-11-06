#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export RPC_URL=http://127.0.0.1:18545
export START_BLOCK=1
export PAIR_ADDRESS=0x1000000000000000000000000000000000000001
export INDEXER_URL=http://127.0.0.1:14269
logs=$(mktemp -d)
if curl -sS --max-time 1 "$RPC_URL" >/dev/null 2>&1 ||
   curl -sS --max-time 1 "$INDEXER_URL/health" >/dev/null 2>&1; then
  echo "Smoke test ports 18545 and 14269 must be free" >&2
  exit 1
fi
export PONDER_TELEMETRY_DISABLED=1
if [[ -z ${W07_TEST_DATABASE_URL:-} ]]; then
  export PGLITE_DIR="$logs/db"
else
  unset PGLITE_DIR DATABASE_PRIVATE_URL
  export DATABASE_URL="$W07_TEST_DATABASE_URL"
fi
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

sync_topic=$(cast keccak 'Sync(uint112,uint112)')
swap_topic=$(cast keccak 'Swap(address,uint256,uint256,uint256,uint256,address)')
transfer_topic=$(cast keccak 'Transfer(address,address,uint256)')
zero_word=$(printf '%064d' 0)
holder_word=$(printf '%064d' 17)
fixture() {
  local amount=$1
  # Emit Sync, Swap and LP Transfer with the same token0 input/mint amount.
  local sync="60${amount}60005260036020527f${sync_topic#0x}60406000a1"
  local swap="60006020527f${holder_word}7f${holder_word}7f${swap_topic#0x}60806000a3"
  local transfer="7f${holder_word}7f${zero_word}7f${transfer_topic#0x}60206000a3"
  rpc anvil_setCode "$PAIR_ADDRESS" "0x${sync}${swap}${transfer}00" >/dev/null
}
fixture 02
send_sync() {
  cast send --rpc-url "$RPC_URL" --unlocked \
    --from 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 "$PAIR_ADDRESS" "$@" >/dev/null
}
send_sync
rpc anvil_mine 70 >/dev/null

schema="smoke_$(date +%s)_$$"
# Separate database and synchronization schema for every run.
node_modules/.bin/ponder start --hostname 127.0.0.1 --port 14269 \
  --log-level debug --schema "$schema" >"$logs/ponder.log" 2>&1 &
ponder_pid=$!
for _ in {1..180}; do
  if curl -fsS --max-time 3 "$INDEXER_URL/ready" >/dev/null 2>&1; then break; fi
  kill -0 "$ponder_pid" 2>/dev/null || { cat "$logs/ponder.log"; exit 1; }
  sleep 1
done
if ! curl -fsS --max-time 3 "$INDEXER_URL/ready"; then
  tail -40 "$logs/ponder.log" >&2
  exit 1
fi
curl -fsS --max-time 3 "$INDEXER_URL/health"
# Readiness can precede live catch-up when the RPC finalized tag is genesis.
initial=""
for _ in {1..90}; do
  if initial=$(curl -fsS --max-time 3 "$INDEXER_URL/snapshot/1" 2>/dev/null); then break; fi
  sleep 1
done
if [[ -z "$initial" ]]; then
  tail -40 "$logs/ponder.log" >&2
  exit 1
fi
printf '%s\n' "$initial" | node --input-type=module -e '
  import assert from "node:assert/strict";
  const data = JSON.parse(await new Response(process.stdin).text());
  assert.equal(data.block, "1");
  assert.equal(data.reserve0, "2");
  assert.equal(data.reserve1, "3");
  assert.equal(data.volume24h, null);
  assert.equal(data.completeWindow, false);
  assert.equal(data.finality, "unverified");
  console.log(JSON.stringify(data));
'

# Replace a live block after the original event has reached the query API.
rpc evm_increaseTime 86401 >/dev/null
fork=$(rpc evm_snapshot | tr -d '"')
send_sync
snapshot_at_72() {
  curl -fsS --max-time 3 "$INDEXER_URL/snapshot/72" 2>/dev/null
}
await_reserve() {
  local expected=$1 body=""
  for _ in {1..35}; do
    body=$(snapshot_at_72 || true)
    if [[ "$body" == *'"reserve0":"'"$expected"'"'* ]]; then
      printf '%s\n' "$body"
      return
    fi
    sleep 1
  done
  tail -35 "$logs/ponder.log" >&2
  return 1
}
original=$(await_reserve 2)
original_holders=$(curl -fsS --max-time 3 "$INDEXER_URL/lp-holders")
[[ $(rpc evm_revert "$fork") == true ]]
rpc evm_increaseTime 86401 >/dev/null
fixture 09
send_sync 0x01
rpc anvil_mine 1 >/dev/null
replacement=$(await_reserve 9)
replacement_holders=$(curl -fsS --max-time 3 "$INDEXER_URL/lp-holders")
node -e '
  const assert = require("node:assert/strict");
  const original = JSON.parse(process.argv[1]);
  const replacement = JSON.parse(process.argv[2]);
  assert.notEqual(original.hash, replacement.hash);
  assert.equal(original.volume24h.token0, "2");
  assert.equal(replacement.volume24h.token0, "9");
  assert.equal(JSON.parse(process.argv[3]).holders[0].balance, "4");
  assert.equal(JSON.parse(process.argv[4]).holders[0].balance, "11");
  console.log(JSON.stringify({ orphan: original.hash, canonical: replacement.hash, reserve0: replacement.reserve0 }));
' "$original" "$replacement" "$original_holders" "$replacement_holders"

status=$(curl -sS --max-time 8 -o "$logs/finality.json" -w '%{http_code}' "$INDEXER_URL/snapshot/72?finality=finalized")
[[ "$status" == 409 ]]
grep -Fq 'Block is not yet finalized' "$logs/finality.json"
printf 'Finalized-only request for live block: HTTP %s\n' "$status"


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
restarted=$(await_reserve 9)
restarted_holders=$(curl -fsS --max-time 3 "$INDEXER_URL/lp-holders")
node -e '
 const assert=require("node:assert/strict");
 assert.deepEqual(JSON.parse(process.argv[1]),JSON.parse(process.argv[2]));
 assert.deepEqual(JSON.parse(process.argv[3]),JSON.parse(process.argv[4]));
 console.log("Crash restart preserves canonical snapshot and LP balances");
' "$replacement" "$restarted" "$replacement_holders" "$restarted_holders"
