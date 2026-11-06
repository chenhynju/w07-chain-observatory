#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

export RPC_URL=http://127.0.0.1:18545
export INDEXER_URL=http://127.0.0.1:42069
export W07_CHAIN=ethereum
export PAIR_ADDRESS=0x1000000000000000000000000000000000000001
export START_BLOCK=1
export PAIR_CREATION_BLOCK=1
export PGLITE_DIR="$PWD/.runtime/pglite"
export PONDER_TELEMETRY_DISABLED=1
holder=0x0000000000000000000000000000000000000011
sender=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

mkdir -p .runtime evidence/dev-demo
if curl -sS --max-time 1 "$RPC_URL" >/dev/null 2>&1 ||
   curl -sS --max-time 1 "$INDEXER_URL/health" >/dev/null 2>&1; then
  echo "Ports 18545 and 42069 must be free" >&2
  exit 1
fi

rm -rf "$PGLITE_DIR"
(cd testnet/fixtures && forge build --silent >/dev/null)
runtime=$(node -e 'const a=require("./testnet/fixtures/out/PairFixture.sol/PairFixture.json"); process.stdout.write(a.deployedBytecode.object)')
runtime=${runtime#0x}

anvil --chain-id 1 --port 18545 --silent >.runtime/anvil.log 2>&1 &
echo $! >.runtime/anvil.pid
cleanup() {
  [[ -f .runtime/ponder.pid ]] && kill "$(cat .runtime/ponder.pid)" 2>/dev/null || true
  [[ -f .runtime/anvil.pid ]] && kill "$(cat .runtime/anvil.pid)" 2>/dev/null || true
  rm -f .runtime/ponder.pid .runtime/anvil.pid
}
trap cleanup EXIT

rpc() { cast rpc --rpc-url "$RPC_URL" "$@"; }
for _ in {1..30}; do rpc eth_blockNumber >/dev/null 2>&1 && break; sleep 1; done
rpc anvil_setCode "$PAIR_ADDRESS" "0x$runtime" >/dev/null

send() {
  cast send --rpc-url "$RPC_URL" --unlocked --from "$sender" "$PAIR_ADDRESS" "$@" >/dev/null
}
send "mint(uint256,uint256,address)" 1000000000000000000000000 1000000000000000000000000 "$holder"
rpc evm_increaseTime 86401 >/dev/null
send "swapWithPostSync(uint256,uint256,uint256,address)" 1000000000000000000000 0 250000000000000000000 "$holder"
rpc evm_increaseTime 3600 >/dev/null
send "swap(uint256,uint256,address)" 500000000000000000000 0 "$holder"
rpc evm_increaseTime 7200 >/dev/null
send "swap(uint256,uint256,address)" 750000000000000000000 0 "$holder"
rpc evm_increaseTime 10800 >/dev/null
send "mint(uint256,uint256,address)" 200000000000000000000000 200000000000000000000000 "$holder"
rpc evm_increaseTime 5400 >/dev/null
send "swapWithPostSync(uint256,uint256,uint256,address)" 1250000000000000000000 0 100000000000000000000 "$holder"

node_modules/.bin/ponder start --hostname 127.0.0.1 --port 42069 \
  --log-level info --schema demo >.runtime/ponder.log 2>&1 &
echo $! >.runtime/ponder.pid
for _ in {1..180}; do
  if curl -fsS --max-time 3 "$INDEXER_URL/ready" >/dev/null 2>&1; then break; fi
  sleep 1
done
curl -fsS --max-time 3 "$INDEXER_URL/ready" >/dev/null
echo "Indexer ready: $INDEXER_URL"
echo "Start the dashboard with: INDEXER_URL=$INDEXER_URL npm --prefix apps/web run dev"
echo "Press Ctrl-C to stop Anvil and Ponder."
wait
