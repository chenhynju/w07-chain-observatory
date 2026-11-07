# Daily automation run — 2026-11-07

Run window: `2026-11-07T00:00Z` – `2026-11-07T00:05Z`
Repository HEAD: `19bfc15c7bd5d32905d048f7d74c40fa7a307f72`
Working tree at start: clean (no staged or unstaged changes)

Summary: **2 PASS, 2 BLOCKED** at the 08:00 run. Vercel was unblocked later the same day
via the embedded browser; see the post-run update below.

| Step | Result at run time |
| --- | --- |
| 1. GitHub repository and push | PASS |
| 2. Server indexer availability and payloads | PASS |
| 3. Vercel production deployment | BLOCKED, later deployed |
| 4. Testnet fixture deployment | BLOCKED (zero deployer balance) |

## Post-run update — Vercel is now live

After this run, the private repository was imported into Vercel with Root Directory
`apps/web`. The production URL is now:

```
https://w07-chain-observatory.vercel.app
```

It returned HTTP 200 and rendered the hero, metric cards, reserve chart and LP holders table
with live data. The deployment is recorded in [vercel-live.md](vercel-live.md). The GitHub
integration now deploys every push to `main`.

The Cloudflare A record `w07-api` -> `43.130.127.57` is still pending, so
`https://43-130-127-57.sslip.io` remains the API URL. The testnet funding blocker is unchanged:
no transaction has been signed or broadcast.

## Post-run update — testnet deployed, server switched

The funding blocker was resolved by using the already-funded legacy wallet
`0x0118e172324801a6333e7d0fAF7f9BB4ED72628F` instead of `0xA675...2d1B`. Two fixtures were
deployed and both emitted `mint` and `swapWithPostSync`:

| Network | PairFixture | Block | Gas | Source |
| --- | --- | --- | --- | --- |
| Base Sepolia | `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | 55659119 | 1,042,673 | Sourcify `exact_match` |
| Ethereum Sepolia | `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999` | 12083600 | 7,289,537 | Sourcify `exact_match` |

Blockscout accepted both submissions but returned `Fail - Unable to verify`; the deployed
runtime bytecode is byte-identical to the local artifact, so this is recorded as a Blockscout
limitation. The server indexer was switched to the Base Sepolia fixture with
`RPC_URL=https://base-sepolia.gateway.tenderly.co`, and the API is now served at
`https://onchaindata.purelamp.uk` (Cloudflare A record added; `w07-api` remains unconfigured).
Details: [testnet.md](testnet.md), [server-live.md](server-live.md).

## 1. GitHub

`gh` is authenticated in WSL as `chenhynju` with scopes `gist`, `read:org`, `repo`, `workflow`.
The remote repository already exists and is private:

```
$ gh repo view chenhynju/w07-chain-observatory --json name,visibility,defaultBranchRef,url
{"defaultBranchRef":{"name":"main"},"name":"w07-chain-observatory",
 "url":"https://github.com/chenhynju/w07-chain-observatory","visibility":"PRIVATE"}
```

Push was executed from Windows git (avoids WSL network timeouts):

```
$ git -C \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory -c core.filemode=false -c core.autocrlf=false push origin main
Everything up-to-date
```

Result: `origin/main` is at `19bfc15`, nothing to upload. No credentials were printed.

## 2. Server indexer

Probed from Windows against the public host (`https://43-130-127-57.sslip.io`), no restart was
required because every endpoint answered.

| Request | Status | Observed |
| --- | --- | --- |
| `GET /metadata` | 200 | `chain: ethereum`, `chainId: 1`, pair `0xB4e1…C9Dc`, `startBlock 26350904`, `coverage.complete: false` (`pair-creation-not-configured`) |
| `GET /latest` | 200 | block `26359260`, hash `0x30b595633ad9bb125bc5abdaed5dd4a8ade405e7083fd2802b3f5dec493cfabd`, reserve0 `9613424223692`, reserve1 `4292484417158658075317`, `completeWindow: true`, 24h volume `227415215180` / `93787377124085996436`, `annualizedGrossFeeBps 249` |
| `GET /snapshot/26359260` | 200 | snapshot served for the reported head |
| `GET /alerts?minToken0=1&height=26359260` | 200 | 25 real post-Sync swap alerts, newest at block `26359165` |
| `GET /lp-holders` | 200 | one holder `0xf385…5f85` with balance `6809452273`, coverage `indexed-transfer-deltas` |
| `GET /wallet/0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B` | 200 | `[]` — the deployer has no mainnet LP activity, expected |
| `GET /wallet` | 404 | validation: the route requires an address segment |
| `GET /alerts` | 400 | validation: `minToken0 must be an integer in raw token0 units`; `height` is also required |

The 404/400 responses above are input validation on parameterised routes, not service failures.
Values are live Ethereum mainnet data for the configured window; they are not a full-history
claim (`coverage.complete` is still `false`).

No docker command was run: `docker compose … up -d` was conditional on the endpoints being
unavailable, and they were available.

## 3. Vercel — BLOCKED

| URL | Result |
| --- | --- |
| `https://w07.purelamp.uk` | connection failed, curl exit status `000` (0.82 s); DNS resolved to `198.18.3.90`, a synthetic address from the local proxy, so the real record is unverified |
| `https://w07-chain-observatory.vercel.app` | `404` — body `The deployment could not be found on Vercel.` header `X-Vercel-Error: DEPLOYMENT_NOT_FOUND` |

Local state: no `vercel` CLI on Windows, no `~/.vercel` or `com.vercel.cli/auth.json`
credentials, and no `.vercel/project.json` linkage inside the repository. `apps/web/vercel.json`
exists (`framework: nextjs`, `npm run build`, `npm ci`), so the project is ready to import but
has not been imported.

Reason: the GitHub repository has not been connected to a Vercel project. Nothing was created
or deployed, and no deployment URL is claimed.

Unblock:

1. Import `https://vercel.com/new/clone?repository-url=https://github.com/chenhynju/w07-chain-observatory&root-directory=apps/web`
2. Set `INDEXER_URL=https://43-130-127-57.sslip.io` for Production (and Preview if desired).
3. After the project exists, any push to `main` triggers a build; re-check
   `https://w07-chain-observatory.vercel.app` for `200` and live metrics.
4. Add the `w07.purelamp.uk` CNAME/A record in the Vercel domain settings once the project exists.

## 4. Testnet deployment — BLOCKED

Deployer: `0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B`

```
$ export https_proxy=http://127.0.0.1:8899 http_proxy=http://127.0.0.1:8899
$ cast balance 0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B --rpc-url https://sepolia.base.org
0
$ cast balance 0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B --rpc-url https://ethereum-sepolia-rpc.publicnode.com
0
```

Both balances are `0` wei, so `W07_CHAIN=base-sepolia npm run deploy:testnet` and
`W07_CHAIN=ethereum-sepolia npm run deploy:testnet` were **not** executed. The script's own
balance guard would stop them; running it would only produce a failure record.

- Transaction hashes: none — no transaction was signed or broadcast.
- `deployments/base-sepolia.json`, `deployments/ethereum-sepolia.json`: not created.
- `evidence/deploy-*`: not created.

Unblock: fund the deployer from a Base Sepolia faucet (`https://faucets.chain.link/base-sepolia`,
`https://www.alchemy.com/faucets/base-sepolia`) and/or an Ethereum Sepolia faucet, then re-run
the two commands above. A Base Sepolia drip of 0.01–0.05 ETH is sufficient.

### 4a. Server switch to the Base Sepolia fixture — BLOCKED (dependent)

The server `.env` rewrite (`W07_CHAIN`, `PAIR_ADDRESS`, `START_BLOCK`, `PAIR_CREATION_BLOCK`),
the indexer rebuild, and the `/metadata`, `/latest`, `/wallet`, `/alerts`, `/lp-holders`
re-verification all depend on a fixture address and deployment block. Since no deployment
exists, the server remains on Ethereum mainnet USDC/WETH and was deliberately left unchanged.

## 5. Not performed

- Mainnet deployment: out of scope and not authorised.
- Any write to the server `.env`: deferred until a real fixture exists.

## Reproduce

```sh
# Balances
export https_proxy=http://127.0.0.1:8899 http_proxy=http://127.0.0.1:8899
cast balance 0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B --rpc-url https://sepolia.base.org
cast balance 0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B \
  --rpc-url https://ethereum-sepolia-rpc.publicnode.com

# Indexer
curl -s https://43-130-127-57.sslip.io/metadata
curl -s https://43-130-127-57.sslip.io/latest
curl -s https://43-130-127-57.sslip.io/lp-holders

# Vercel surface
curl -sI https://w07-chain-observatory.vercel.app
```
