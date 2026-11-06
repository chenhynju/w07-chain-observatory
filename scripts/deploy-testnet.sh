#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

profile=${W07_CHAIN:-}
case "$profile" in
  base-sepolia)
    default_rpc="https://sepolia.base.org"
    expected_chain=84532
    explorer="https://base-sepolia.blockscout.com"
    verify_chain="base-sepolia"
    ;;
  ethereum-sepolia)
    default_rpc="https://ethereum-sepolia-rpc.publicnode.com"
    expected_chain=11155111
    explorer="https://eth-sepolia.blockscout.com"
    verify_chain="sepolia"
    ;;
  *)
    echo "Set W07_CHAIN=base-sepolia or ethereum-sepolia" >&2
    exit 2
    ;;
esac

RPC_URL=${RPC_URL:-$default_rpc}
KEYSTORE=${W07_KEYSTORE:-$HOME/.foundry/keystores/w07-deployer.json}
PASSWORD_FILE=${W07_PASSWORD_FILE:-$HOME/.config/w07/deployer.password}
PROXY=${W07_PROXY:-http://127.0.0.1:8899}
if [[ "$PROXY" != "none" ]]; then
  export https_proxy="$PROXY"
  export http_proxy="$PROXY"
fi

[[ -f "$KEYSTORE" ]] || { echo "Missing keystore: $KEYSTORE" >&2; exit 2; }
[[ -f "$PASSWORD_FILE" ]] || { echo "Missing password file: $PASSWORD_FILE" >&2; exit 2; }

chain_id=$(cast chain-id --rpc-url "$RPC_URL")
if [[ "$chain_id" != "$expected_chain" ]]; then
  echo "RPC chain id $chain_id does not match $profile ($expected_chain)" >&2
  exit 2
fi

password=$(cat "$PASSWORD_FILE")
private_key=$(CAST_UNSAFE_PASSWORD="$password" cast wallet decrypt-keystore --keystore-dir "$(dirname "$KEYSTORE")" "$(basename "$KEYSTORE" .json)")
deployer=$(cast wallet address --private-key "$private_key")
unset private_key password
balance=$(cast balance "$deployer" --rpc-url "$RPC_URL" --ether)

echo "profile:  $profile ($chain_id)"
echo "rpc:      $RPC_URL"
echo "deployer: $deployer"
echo "balance:  $balance ETH"
if [[ "$(cast balance "$deployer" --rpc-url "$RPC_URL")" == "0" ]]; then
  echo "Deployer has no test ETH. Fund $deployer through a faucet and rerun." >&2
  exit 3
fi

log_dir="evidence/deploy-$profile-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$log_dir" deployments

(cd testnet/fixtures && forge build --silent >/dev/null)

create_json=$(forge create testnet/fixtures/src/PairFixture.sol:PairFixture \
  --rpc-url "$RPC_URL" --keystore "$KEYSTORE" --password-file "$PASSWORD_FILE" \
  --broadcast --json 2>"$log_dir/forge-create.err")
printf '%s\n' "$create_json" > "$log_dir/forge-create.json"
pair=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(j.deployedTo ?? "")' "$create_json")
deploy_tx=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(j.transactionHash ?? "")' "$create_json")
if [[ ! "$pair" =~ ^0x[0-9a-fA-F]{40}$ || ! "$deploy_tx" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
  cat "$create_json" >&2
  cat "$log_dir/forge-create.err" >&2
  exit 1
fi

deploy_receipt=$(cast receipt "$deploy_tx" --rpc-url "$RPC_URL" --json)
printf '%s\n' "$deploy_receipt" > "$log_dir/deploy-receipt.json"
deploy_block=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(BigInt(j.blockNumber).toString())' "$deploy_receipt")
deploy_gas=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(BigInt(j.gasUsed).toString())' "$deploy_receipt")
echo "fixture:  $pair at block $deploy_block (gas $deploy_gas)"

amount0=1000000000000000000000000
amount1=1000000000000000000000000
swap_amount=1000000000000000000000
post_amount=250000000000000000000

send_event() {
  local label=$1
  shift
  local json tx receipt block gas
  json=$(cast send "$pair" "$@" --rpc-url "$RPC_URL" \
    --keystore "$KEYSTORE" --password-file "$PASSWORD_FILE" --json)
  printf '%s\n' "$json" > "$log_dir/$label-send.json"
  tx=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(j.transactionHash ?? "")' "$json")
  if [[ ! "$tx" =~ ^0x[0-9a-fA-F]{64}$ ]]; then
    echo "Missing transaction hash for $label" >&2
    cat "$json" >&2
    exit 1
  fi
  receipt=$(cast receipt "$tx" --rpc-url "$RPC_URL" --json)
  printf '%s\n' "$receipt" > "$log_dir/$label-receipt.json"
  block=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(BigInt(j.blockNumber).toString())' "$receipt")
  gas=$(node -e 'const j=JSON.parse(process.argv[1]); process.stdout.write(BigInt(j.gasUsed).toString())' "$receipt")
  printf '%s %s %s %s\n' "$label" "$tx" "$block" "$gas"
}

mint_line=$(send_event "mint" "mint(uint256,uint256,address)" "$amount0" "$amount1" "$deployer")
swap_line=$(send_event "swap" "swapWithPostSync(uint256,uint256,uint256,address)" "$swap_amount" 0 "$post_amount" "$deployer")

read -r mint_step mint_tx mint_block mint_gas <<<"$mint_line"
read -r swap_step swap_tx swap_block swap_gas <<<"$swap_line"
latest_block=$swap_block

cat > "deployments/$profile.json" <<EOF
{
  "network": "$profile",
  "chainId": $chain_id,
  "status": "DEPLOYED",
  "deployedAtUtc": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "deployer": "$deployer",
  "explorer": "$explorer",
  "fixture": {
    "name": "PairFixture",
    "role": "Test-only Uniswap V2-shaped event source; no token transfers and no value.",
    "address": "$pair",
    "transactionHash": "$deploy_tx",
    "blockNumber": "$deploy_block",
    "gasUsed": "$deploy_gas",
    "constructorArgs": []
  },
  "events": [
    {
      "step": "mint",
      "function": "mint(uint256,uint256,address)",
      "transactionHash": "$mint_tx",
      "blockNumber": "$mint_block",
      "gasUsed": "$mint_gas"
    },
    {
      "step": "swapWithPostSync",
      "function": "swapWithPostSync(uint256,uint256,uint256,address)",
      "transactionHash": "$swap_tx",
      "blockNumber": "$swap_block",
      "gasUsed": "$swap_gas"
    }
  ],
  "indexer": {
    "W07_CHAIN": "$profile",
    "PAIR_ADDRESS": "$pair",
    "START_BLOCK": "$deploy_block",
    "PAIR_CREATION_BLOCK": "$deploy_block",
    "latestSyncBlock": "$latest_block"
  },
  "sourceVerification": "PENDING",
  "limitations": [
    "PairFixture is test infrastructure, not a production AMM.",
    "Events are synthetic and do not represent real trading activity.",
    "The deployer keystore stays outside the repository."
  ]
}
EOF

if [[ "${VERIFY:-1}" == "1" ]]; then
  set +e
  forge verify-contract "$pair" testnet/fixtures/src/PairFixture.sol:PairFixture \
    --chain "$verify_chain" --verifier blockscout --verifier-url "$explorer/api" \
    >"$log_dir/verify.log" 2>&1
  verify_exit=$?
  set -e
  if [[ "$verify_exit" == "0" ]]; then
    node -e '
      const fs = require("node:fs");
      const file = process.argv[1];
      const record = JSON.parse(fs.readFileSync(file, "utf8"));
      record.sourceVerification = "VERIFIED_BLOCKSCOUT";
      fs.writeFileSync(file, JSON.stringify(record, null, 2) + "\n");
    ' "deployments/$profile.json"
    echo "source verification: PASS (Blockscout)"
  else
    echo "source verification: FAILED (see $log_dir/verify.log)" >&2
  fi
fi

echo
echo "Deployment record: deployments/$profile.json"
echo "Evidence:          $log_dir"
echo "Indexer environment:"
echo "  W07_CHAIN=$profile"
echo "  RPC_URL=$RPC_URL"
echo "  PAIR_ADDRESS=$pair"
echo "  START_BLOCK=$deploy_block"
echo "  PAIR_CREATION_BLOCK=$deploy_block"
