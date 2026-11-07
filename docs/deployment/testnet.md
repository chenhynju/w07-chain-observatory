# Testnet deployment runbook

Status: **DEPLOYED** on Base Sepolia and Ethereum Sepolia on 2026-11-07. The deployer is the
funded legacy wallet `0x0118...628F`; no faucet drip was required. Source verification passed
on Sourcify with `exact_match`. Blockscout accepted the submissions but returned
`Fail - Unable to verify`, while the on-chain runtime bytecode is byte-identical to
`testnet/fixtures/out/PairFixture.sol/PairFixture.json`; the Blockscout outcome is recorded as a
tool-side limitation, not as a verified check.

## Deployments

| Network | PairFixture | Deployment tx | Block | Gas | Source |
| --- | --- | --- | --- | --- | --- |
| Base Sepolia (84532) | `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | `0x5ef93f92db959be2146c34b71f12f34d4dc16fb53e8e99e8ab188f501200d692` | 55659119 | 1,042,673 | Sourcify `exact_match` |
| Ethereum Sepolia (11155111) | `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999` | `0x5b67c56b5c6789ea6bc3b5e007f9e4171d8fa1a4314d7aca8692c5c9d2a0f05a` | 12083600 | 7,289,537 | Sourcify `exact_match` |

Machine-readable records: `deployments/base-sepolia.json`, `deployments/ethereum-sepolia.json`.

## Deployer

| Item | Value |
| --- | --- |
| Address | `0x0118e172324801a6333e7d0fAF7f9BB4ED72628F` |
| Base Sepolia balance | 0.007965 ETH (after deployment) |
| Ethereum Sepolia balance | 0.049139 ETH (after deployment) |
| Keystore | `~/.foundry/keystores/w07-legacy-deployer` |
| Password file | `~/.config/w07/legacy-deployer.password` (mode 600, outside the repo) |
| Purpose | Testnet-only deployment of `PairFixture` |

The keystore is already imported and is not part of the repository. Re-import only on a new
machine (never paste the key into chat or a tracked file):

```sh
cast wallet import w07-legacy-deployer --keystore-dir ~/.foundry/keystores --interactive
printf '%s' 'your-keystore-password' > ~/.config/w07/legacy-deployer.password
chmod 600 ~/.config/w07/legacy-deployer.password
```

The deploy script derives the signer address and refuses to continue unless it matches
`0x0118e172324801a6333e7d0fAF7f9BB4ED72628F`. If you intentionally use another wallet, set
`W07_EXPECTED_DEPLOYER` and `W07_KEYSTORE` explicitly.

## 1. Fund the deployer

**No faucet is required for this address.** The balances above are enough for the fixture
deployment and its two event transactions. The faucet list below is kept for future reference
or for a different wallet.

The following channels were checked for the sibling b2-lending project on 2026-11-06.
Eligibility and limits change; use whichever channel is available to you.

### Base Sepolia (chain id 84532)

| Faucet | Drip | Notes |
| --- | --- | --- |
| [Chainlink Base Sepolia](https://faucets.chain.link/base-sepolia) | 0.5 ETH | Wallet connection; provider eligibility |
| [Alchemy Base Sepolia](https://www.alchemy.com/faucets/base-sepolia) | 0.1 ETH / 24h | Mainnet activity/balance rules |
| [Coinbase CDP](https://portal.cdp.coinbase.com/onchain-tools/faucet) | 0.1 ETH / 24h | Login required |
| [thirdweb](https://thirdweb.com/base-sepolia-testnet) | variable | Listed in Base docs |
| [QuickNode](https://faucet.quicknode.com/base/sepolia) | variable | Login required |

### Ethereum Sepolia (chain id 11155111)

| Faucet | Drip | Notes |
| --- | --- | --- |
| [Chainlink Ethereum Sepolia](https://faucets.chain.link/sepolia) | 0.5 ETH | Wallet connection |
| [Alchemy Sepolia](https://www.alchemy.com/faucets/ethereum-sepolia) | 0.1 ETH / 24h | Mainnet activity rules |
| [Infura Sepolia](https://www.infura.io/faucet/sepolia) | 0.5 ETH / day | Account required |
| [Google Cloud Sepolia](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) | 0.05 ETH / day | Account required |

If a faucet requires a connected wallet, send the drip to the deployer address from a wallet
you control, or use a faucet that accepts a pasted address. Do not import the deployer key
into a browser unless you accept that exposure.

Check balances from WSL (the local HTTP proxy is required on this machine):

```sh
export https_proxy=http://127.0.0.1:8899 http_proxy=http://127.0.0.1:8899
cast balance 0x0118e172324801a6333e7d0fAF7f9BB4ED72628F \
  --rpc-url https://sepolia.base.org --ether
cast balance 0x0118e172324801a6333e7d0fAF7f9BB4ED72628F \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com --ether
```

A Base Sepolia drip of 0.01–0.05 ETH is enough for the fixture deployment and two event
transactions. Ethereum Sepolia needs a little more because gas is priced higher; 0.02 ETH is
a practical minimum.

## 2. Deploy the fixture

```sh
# Base Sepolia
W07_CHAIN=base-sepolia npm run deploy:testnet

# Ethereum Sepolia
W07_CHAIN=ethereum-sepolia npm run deploy:testnet
```

The script:

1. Verifies the RPC chain id and the deployer balance.
2. Builds `testnet/fixtures` and deploys `PairFixture`.
3. Sends `mint` and `swapWithPostSync` so the indexer has reserves, LP supply, a pre-Sync swap
   and a post-Sync swap.
4. Writes `deployments/<network>.json` and receipt logs under
   `evidence/deploy-<network>-<timestamp>/`.
5. Verifies source on Blockscout; if that fails it falls back to Sourcify, and records
   `VERIFIED_*` only when the verifier reports success (`VERIFY=0` disables the step).

Override defaults only when needed:

```sh
RPC_URL=https://your-rpc.example \
W07_KEYSTORE=$HOME/.foundry/keystores/w07-deployer \
W07_PASSWORD_FILE=$HOME/.config/w07/deployer.password \
W07_PROXY=none \
VERIFY=0 \
W07_CHAIN=base-sepolia \
npm run deploy:testnet
```

## 3. Index the deployed fixture

Use the values printed by the deploy script (or read `deployments/<network>.json`):

```sh
W07_CHAIN=base-sepolia \
RPC_URL=https://sepolia.base.org \
PAIR_ADDRESS=<fixture address> \
START_BLOCK=<deployment block> \
PAIR_CREATION_BLOCK=<deployment block> \
PGLITE_DIR=.runtime/pglite-base-sepolia \
npm start
```

For persistent PostgreSQL, create a database and use `DATABASE_URL` instead of `PGLITE_DIR`:

```sh
createdb w07_base_sepolia
W07_CHAIN=base-sepolia \
RPC_URL=https://sepolia.base.org \
PAIR_ADDRESS=<fixture address> \
START_BLOCK=<deployment block> \
PAIR_CREATION_BLOCK=<deployment block> \
DATABASE_URL=postgresql://$(id -un)@127.0.0.1:5433/w07_base_sepolia \
npm start
```

RPC note: Ponder probes a historical block while resolving its finalized boundary, and
`sepolia.base.org` prunes history before block 46,500,000. Use an archive-capable endpoint for
Base Sepolia indexing (this project uses `https://base-sepolia.gateway.tenderly.co`; the public
gateway rate-limits but retries succeed).

Run the dashboard in a second terminal:

```sh
INDEXER_URL=http://127.0.0.1:42069 npm run web:dev
```

## 4. Functional verification

Replace `<block>` with the `swapWithPostSync` block from the deployment record.

```sh
curl -s http://127.0.0.1:42069/metadata | jq
curl -s http://127.0.0.1:42069/latest | jq
curl -s http://127.0.0.1:42069/snapshot/<block> | jq
curl -s http://127.0.0.1:42069/wallet/<deployer> | jq
curl -s "http://127.0.0.1:42069/alerts?minToken0=1&height=<block>" | jq
curl -s http://127.0.0.1:42069/lp-holders | jq
```

Expected results:

- `/metadata` returns the correct chain id, pair and `coverage.complete: true` when
  `START_BLOCK` equals the deployment block.
- `/snapshot/<block>` returns the fixture reserves and a 24h volume that **excludes** the
  post-Sync swap amount.
- `/wallet/<deployer>` returns the LP mint Transfer.
- `/lp-holders` returns the deployer's positive LP balance.
- `/alerts` returns the post-Sync swap only if it meets the threshold; alerts are not
  snapshot-bounded.

Reconcile reserves at the exact snapshot hash:

```sh
export https_proxy=http://127.0.0.1:8899 http_proxy=http://127.0.0.1:8899
node --env-file=.env scripts/reconcile.mjs <block>
```

`reconcile.mjs` requires an RPC that supports historical `eth_call` with a block hash and
`requireCanonical`. If the public RPC does not, record that limitation instead of replacing
the check with a weaker one.

Finality:

```sh
curl -s "http://127.0.0.1:42069/snapshot/<block>?finality=finalized" | jq
```

A freshly mined block normally returns `409` until the RPC's finalized height catches up.
After finality, the same request should return `"finality": "finalized"`. Base Sepolia
finalizes much faster than Ethereum Sepolia.

## 5. Record evidence

The deployment script writes:

- `deployments/<network>.json` — machine-readable record.
- `evidence/deploy-<network>-<timestamp>/forge-create.json` — deployment output.
- `.../<step>-receipt.json` — transaction receipts.
- `.../verify.log` — Blockscout verification output.
- `.../verify-sourcify.log` — Sourcify fallback output (when Blockscout fails).

Also capture:

- The faucet transaction hash and source, if visible.
- `/metadata`, `/latest`, `/snapshot`, `/wallet`, `/alerts`, `/lp-holders` responses.
- `scripts/lag.mjs` output against the testnet RPC.
- Any reconciliation limitation (for example, unsupported `blockHash` on the public RPC).

## Safety boundaries

- The fixture is test infrastructure. It is not a production AMM and has no economic value.
- Do not deploy to mainnet. Do not reuse this deployer for value-bearing assets.
- Do not commit the keystore password, private key, or `.env` files.
- Public testnet transactions are public even if the dashboard is hosted privately.
