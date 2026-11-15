# Daily automation run — 2026-11-15

Run window: `2026-11-15T00:02Z` – `2026-11-15T00:12Z`
Repository HEAD at start: `6eeda60` (`6eeda6093e15e4b2beb4c56b63e9858d0235f747`)
Working tree at start: clean in WSL except two pre-existing untracked paths
(`README.zh-CN.md`, `evidence/closeout-20261114/`), left untouched by this run.

Summary: **4 PASS, 2 BLOCKED, 0 FAIL**. No transaction was signed or broadcast, no indexer was
restarted, and no fixture was redeployed.

| Step | Result |
| --- | --- |
| 1a. GitHub identity check inside WSL | BLOCKED (local proxy `127.0.0.1:8899` not listening; WSL egress intercepted) |
| 1b. Push of this run's report commit | PASS via Windows fallback |
| 1c. Repository visibility = private | BLOCKED (repo is currently **public**) |
| 2. Server indexers, both instances | PASS |
| 3. Vercel production deployment | PASS |
| 4. Testnet fixture state | PASS (records present, runtime code non-empty, balances non-zero) |

## 1. GitHub

`gh` inside WSL could not reach github.com for this run:

```
$ export https_proxy=http://127.0.0.1:8899 http_proxy=http://127.0.0.1:8899
$ gh auth status
github.com
  X Timeout trying to log in to github.com account chenhynju (/home/chenhy/.config/gh/hosts.yml)
  - Active account: true
```

Measured root cause (not assumed):

```
$ Test-NetConnection -ComputerName 127.0.0.1 -Port 8899 -InformationLevel Quiet
WARNING: TCP connect to (127.0.0.1 : 8899) failed
False

$ Get-NetTCPConnection -State Listen | Where LocalPort -in 1080,7890,7897,8080,8118,8888,8899,...
# no listener on any common proxy port

$ curl -sS -m 12 -o /dev/null -w '%{http_code}\n' https://api.github.com/     # inside WSL
curl: (28) Connection timed out after 12001 milliseconds
000
```

Windows has direct egress and Windows `gh` is authenticated as `chenhynju`
(token value intentionally masked):

```
$ gh auth status
github.com
  ✓ Logged in to github.com account chenhynju (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token: gho_**** (masked)
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'

$ gh repo view chenhynju/w07-chain-observatory --json nameWithOwner,visibility,defaultBranchRef
{"defaultBranchRef":{"name":"main"},"nameWithOwner":"chenhynju/w07-chain-observatory","visibility":"PUBLIC"}
```

Sync state before the report commit (Windows git; `git -C` on a UNC path fails with
`fatal: cannot change to ...: Invalid argument`, so the repository is entered with
`Set-Location` instead):

```
$ Set-Location \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory
$ git -c core.filemode=false -c core.autocrlf=false fetch origin main
$ git ls-remote origin refs/heads/main
6eeda6093e15e4b2beb4c56b63e9858d0235f747    refs/heads/main
$ git status --short --branch
## main...origin/main
?? README.zh-CN.md
?? evidence/closeout-20261114/
```

Local `main` was level with `origin/main` (`6eeda60`), so no rebase was needed.

Push used the documented Windows fallback. The global `core.hooksPath` is a WSL path
(`/home/chenhy/workspace/web3-portfolio/portfolio-ops/hooks`) that Windows git cannot execute, so
the pre-push hook was first run manually inside WSL and then the hook path was redirected for the
Windows push (same treatment as 2026-11-12 and 2026-11-14).

**Visibility deviation:** the task states the repository should be private, but the GitHub API
reports `PUBLIC`. Visibility was **not** changed by this run — that is an owner decision, since the
repository doubles as a public portfolio artefact. Same deviation recorded on 2026-11-12 and
2026-11-14.

No token, private key or `.env` content was read or printed.

## 2. Server indexers

Probed from Windows (WSL egress unavailable). Both instances answered on the first attempt, so no
`docker compose --env-file ../../.env up -d --force-recreate` was required and the server was not
touched.

| Request | Status | Observed |
| --- | --- | --- |
| `GET https://onchaindata.purelamp.uk/metadata` | 200 | `chain: base-sepolia`, `chainId: 84532`, pair `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F`, `startBlock 55659119`, `coverage.complete: true`, `finality.mode: rpc-finalized` |
| `GET https://onchaindata.purelamp.uk/latest` | 200 | block `55659158`, hash `0x66756c6d4e24bf68118fc9d69a8290f78b5561f4b2919e3c30802945e19d27ca`, `chainId 84532`, reserve0 `1001000000000000000000000`, reserve1 `1000000000000000000000000` |
| `GET https://onchaindata.purelamp.uk/eth/metadata` | 200 | `chain: ethereum-sepolia`, `chainId: 11155111`, pair `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999`, `startBlock 12083600`, `coverage.complete: true` |
| `GET https://onchaindata.purelamp.uk/eth/latest` | 200 | block `12083602`, hash `0x36209f588c91d449f75f13eaec20155a70844166dbb4a0ad7802fcc825731f19`, `chainId 11155111` |
| `GET https://onchaindata.purelamp.uk/health` / `/ready` / `/status` | 200 | indexer (42069) healthy behind Caddy |
| `GET https://onchaindata.purelamp.uk/eth/health` / `/ready` / `/status` | 200 | indexer-eth (42070) healthy behind Caddy |
| `GET https://43-130-127-57.sslip.io/metadata` (fallback) | 200 | same base-sepolia payload, `chainId 84532` |

`/latest` returns the last indexed `Sync` observation, not the chain head
([src/api/index.ts](https://github.com/chenhynju/w07-chain-observatory/blob/main/src/api/index.ts)),
so `55659158` / `12083602` are the fixture's last swap, not a stalled indexer. Chain heads at run
time were Base Sepolia `58896241` (2026-11-15 00:05Z) and Ethereum Sepolia `12136557`
(2026-11-15 00:05Z).

## 3. Vercel

| Check | Result |
| --- | --- |
| `GET https://w07-chain-observatory.vercel.app` | `200`, body `24301` bytes |
| HTML contains `84532` | yes |
| HTML contains `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | yes |
| HTML contains `11155111` | no (Ethereum Sepolia series is not server-rendered on the landing view) |
| `x-vercel-id` | `sfo1::iad1::grqlq-1794701267391-ce8936c719d2` |

No deployment error was observed and no new Vercel deployment was required; the live build responds
normally. This run's commit only touches `docs/deployment/`, so the rendered landing page is
unchanged.

## 4. Testnet fixtures

Both deploy records exist and match on-chain state; therefore **no** `npm run deploy:testnet` was
executed for either chain and this run produced no new transaction hash.

| Network | PairFixture | Recorded block | Runtime code | Deployer balance |
| --- | --- | --- | --- | --- |
| Base Sepolia (84532) | `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | 55659119 | 9,162 hex chars (4,581 bytes) | 27,673,545,624,395,899 wei ≈ 0.027674 ETH |
| Ethereum Sepolia (11155111) | `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999` | 12083600 | 9,162 hex chars (4,581 bytes) | 98,339,098,586,003,849 wei ≈ 0.098339 ETH |

RPC endpoints: `https://base-sepolia.gateway.tenderly.co` (`eth_chainId 0x14a34`) and
`https://ethereum-sepolia-rpc.publicnode.com` (`eth_chainId 0xaa36a7`). Both balances are
unchanged from 2026-11-14, consistent with no signing activity.

Wallet handling: deployer `0x0118e172324801a6333e7d0fAF7f9BB4ED72628F`; keystore
`~/.foundry/keystores/w07-legacy-deployer` present (mode 600, 436 bytes). The rotated password file
`~/.config/w07/legacy-deployer.password` is present (mode 600, 32 bytes); its contents were not
read, printed or recorded, and the retired five-character password was not used. The deprecated
`0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B` was not used. No mainnet transaction was sent.

## 5. Not performed

- No indexer restart — both instances returned 200 on the first probe.
- No testnet redeploy — deploy records present and runtime code non-empty on both chains.
- No change to repository visibility (public → private requires an owner decision).
- No mainnet deployment, no faucet interaction, no signing or broadcasting.

## Reproduce

```sh
# GitHub (Windows egress; WSL network was intercepted for this run)
gh auth status
gh repo view chenhynju/w07-chain-observatory --json nameWithOwner,visibility,defaultBranchRef
Set-Location \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory
git -c core.filemode=false -c core.autocrlf=false fetch origin main
git ls-remote origin refs/heads/main

# Indexers
curl -s https://onchaindata.purelamp.uk/metadata
curl -s https://onchaindata.purelamp.uk/latest
curl -s https://onchaindata.purelamp.uk/eth/metadata
curl -s https://onchaindata.purelamp.uk/eth/latest
curl -s -o /dev/null -w '%{http_code}\n' https://onchaindata.purelamp.uk/health
curl -s -o /dev/null -w '%{http_code}\n' https://onchaindata.purelamp.uk/eth/health
curl -s -o /dev/null -w '%{http_code}\n' https://43-130-127-57.sslip.io/metadata

# Vercel
curl -s https://w07-chain-observatory.vercel.app | grep -o "84532\|0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F"

# Testnet state (JSON-RPC, read-only)
# eth_getCode 0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F @ https://base-sepolia.gateway.tenderly.co
# eth_getCode 0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999 @ https://ethereum-sepolia-rpc.publicnode.com
```
