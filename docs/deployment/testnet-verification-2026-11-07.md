# Testnet deployment verification — 2026-11-07

Status: **PASS** for deployment, event emission, source verification, Base Sepolia indexing and
API responses. One tool-side limitation: Blockscout returned `Fail - Unable to verify` even
though the deployed runtime bytecode is byte-identical to the local artifact; Sourcify verified
the same bytecode with `exact_match`.

## Scope

| Item | Value |
| --- | --- |
| Deployment commit | `4fbbbf7` |
| Deployer | `0x0118e172324801a6333e7d0fAF7f9BB4ED72628F` |
| Artifact | `testnet/fixtures/src/PairFixture.sol:PairFixture` (test-only, no value) |
| Networks | Base Sepolia `84532`, Ethereum Sepolia `11155111` |
| Records | `deployments/base-sepolia.json`, `deployments/ethereum-sepolia.json` |

## 1. Deployments and events

| Network | PairFixture | Deploy tx | Block | Gas |
| --- | --- | --- | --- | --- |
| Base Sepolia | `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | `0x5ef93f92db959be2146c34b71f12f34d4dc16fb53e8e99e8ab188f501200d692` | 55,659,119 | 1,042,673 |
| Ethereum Sepolia | `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999` | `0x5b67c56b5c6789ea6bc3b5e007f9e4171d8fa1a4314d7aca8692c5c9d2a0f05a` | 12,083,600 | 7,289,537 |

| Network | Step | Tx | Block | Gas |
| --- | --- | --- | --- | --- |
| Base Sepolia | `mint` | `0x8093cf5225e60b133b5f218825dc3530de5990d0254f0ee040ff2a6aa9ae3bd3` | 55,659,138 | 94,846 |
| Base Sepolia | `swapWithPostSync` | `0xa36fcfedf03203196eb9c6e9dc7e988f8f853107ac42365707806cc6785ff5a4` | 55,659,158 | 35,103 |
| Ethereum Sepolia | `mint` | `0xe80e8e302dc9161995064b0896e67aa36b604dfaeb3ceeba38bb79e6887a891d` | 12,083,601 | 352,906 |
| Ethereum Sepolia | `swapWithPostSync` | `0x8b87bfe7f616e01ed0947581992b2167fb8fddaff1c3babf1282b70f2c230877` | 12,083,602 | 36,303 |

Receipts were captured with `cast receipt`; every receipt has `status: 0x1`. Evidence lives in
`evidence/deploy-base-sepolia-20261107T121446Z/` and
`evidence/deploy-ethereum-sepolia-20261107T121516Z/`.

## 2. Bytecode integrity

Compiled from `testnet/fixtures` with `solc 0.8.28`, `optimizer_runs = 1000`, `evm_version =
cancun`, no IR:

| Source | keccak256(runtime) | Length |
| --- | --- | --- |
| Local artifact | `0xceb895706f7bd948accfb865476ed69bdfe2e0acd5bec1e47ec4f88d6919b363` | 9,160 bytes |
| Base Sepolia on-chain | `0xceb895706f7bd948accfb865476ed69bdfe2e0acd5bec1e47ec4f88d6919b363` | 9,160 bytes |
| Ethereum Sepolia on-chain | `0xceb895706f7bd948accfb865476ed69bdfe2e0acd5bec1e47ec4f88d6919b363` | 9,160 bytes |

## 3. Source verification

| Verifier | Base Sepolia | Ethereum Sepolia |
| --- | --- | --- |
| Sourcify | `exact_match` (job `94badace-f606-4498-a472-df9174e4f0b1`) | `exact_match` (job `8ef8ec63-e97d-470c-b352-423366c1cd05`) |
| Blockscout | submitted `OK`, result `Fail - Unable to verify` | submitted `OK`, result `Fail - Unable to verify` |

Blockscout is not claimed as verified. The script now only records `VERIFIED_*` after the
verifier reports success, and falls back from Blockscout to Sourcify.

## 4. Indexing and API (Base Sepolia)

The server indexer was reset (`DROP SCHEMA w07 CASCADE`, `DROP SCHEMA ponder_sync CASCADE`) and
recreated with:

```text
W07_CHAIN=base-sepolia
RPC_URL=https://base-sepolia.gateway.tenderly.co
PAIR_ADDRESS=0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F
START_BLOCK=55659119
PAIR_CREATION_BLOCK=55659119
DATABASE_SCHEMA=w07
```

At the check, the indexer head was block `55,666,559` and the finalized block was `55,665,660`.

Responses from `https://onchaindata.purelamp.uk`:

| Request | Result |
| --- | --- |
| `/metadata` | 200, chain `base-sepolia`, id `84532`, coverage `complete` |
| `/latest` | 200, block `55,659,158`, reserves `1001000 / 1000000` (18-decimal raw) |
| `/snapshot/55659158` | 200, same snapshot as `/latest` |
| `/snapshot/55659158?finality=finalized` | 200, `finality: finalized` |
| `/series?from=55659119&to=55659158` | 200, two Sync points: `55,659,138` and `55,659,158` |
| `/wallet/0x0118…628F` | 200, LP `Mint` of `2,000,000` LP |
| `/lp-holders` | 200, deployer balance `2,000,000` LP |
| `/alerts?minToken0=500000000000000000000&height=55659158` | 200, post-Sync swap `token0In: 1000` |

`volume24h` is `null` and `completeWindow` is `false` because the fixture window is shorter
than 24 hours; this is expected, not a failure.

## 5. Reproduce

```sh
# Deployments
W07_CHAIN=base-sepolia npm run deploy:testnet
W07_CHAIN=ethereum-sepolia npm run deploy:testnet

# Bytecode check
cd testnet/fixtures
cast code 0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F --rpc-url https://sepolia.base.org | cast keccak

# API
curl -s https://onchaindata.purelamp.uk/metadata | jq
curl -s https://onchaindata.purelamp.uk/latest | jq
curl -s "https://onchaindata.purelamp.uk/snapshot/55659158?finality=finalized" | jq
```

## 6. Limitations

1. The single server instance indexes Base Sepolia only. The Ethereum Sepolia fixture is
   deployed, emits both events and is Sourcify-verified, but is not indexed by this instance.
2. Blockscout did not verify either contract despite byte-identical runtime code.
3. The public Tenderly gateway rate-limits; progress depends on retries. A dedicated RPC removes
   this limitation.
4. `PairFixture` events are synthetic and carry no economic meaning.
