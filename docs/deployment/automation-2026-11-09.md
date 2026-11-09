# Daily automation run — 2026-11-09

Run window: `2026-11-09T00:05Z` – `2026-11-09T00:20Z`
Repository HEAD: `e126d9f47e566f89832497395e4452a411112e82`
Working tree at start: clean (0 modified/untracked paths)

Summary: **4 PASS, 0 BLOCKED**. No transaction was signed or broadcast; no server restart and
no redeploy were needed.

| Step | Result |
| --- | --- |
| 1. GitHub repository and push | PASS (up-to-date; hook path workaround recorded) |
| 2. Server indexers, both instances | PASS |
| 3. Vercel production deployment | PASS |
| 4. Testnet fixture state | PASS (records present, runtime code non-empty) |

## 1. GitHub

`gh` identity in WSL is `chenhynju` (`~/.config/gh/hosts.yml`, token redacted). The live
`gh auth status` check could not complete:

```
$ export https_proxy=http://127.0.0.1:8899 http_proxy=http://127.0.0.1:8899
$ gh auth status
github.com
  X Timeout trying to log in to github.com account chenhynju (/home/chenhy/.config/gh/hosts.yml)
```

Cause: no listener on the Windows side at `127.0.0.1:8899` at run time
(`Test-NetConnection 127.0.0.1 -Port 8899` → `False`), and the direct WSL path to
`api.github.com` also timed out. Windows has direct egress (`https://api.github.com/rate_limit`
→ `200`), so the push was attempted from Windows git.

First push attempt failed on the inherited global hook path:

```
$ git -C \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory \
    -c core.filemode=false -c core.autocrlf=false push origin main
sh: /home/chenhy/workspace/web3-portfolio/portfolio-ops/hooks/pre-push: No such file or directory
```

Cause: global `core.hooksPath=/home/chenhy/workspace/web3-portfolio/portfolio-ops/hooks` is a
WSL path that Windows git resolves against the Windows filesystem, so the hook cannot execute.
The hook was therefore run manually in its native environment first:

```
$ cd ~/workspace/web3-portfolio/w07-chain-observatory
$ sh ~/workspace/web3-portfolio/portfolio-ops/hooks/pre-push
hook_exit=0
```

The push was then re-run with the hook path pointed at the repository's own empty hook
directory (no checks skipped — the checks already passed above):

```
$ git -C \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory \
    -c core.filemode=false -c core.autocrlf=false -c core.hooksPath=.git/hooks push origin main
Everything up-to-date
```

`git ls-remote origin refs/heads/main` → `e126d9f47e566f89832497395e4452a411112e82`, identical to
local `HEAD`. Repository: `https://github.com/chenhynju/w07-chain-observatory` (private).

## 2. Server indexers

Probed from Windows; both instances answered, so no `docker compose` restart was required.

| Request | Status | Observed |
| --- | --- | --- |
| `GET https://onchaindata.purelamp.uk/metadata` | 200 | `chain: base-sepolia`, `chainId: 84532`, pair `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F`, `startBlock 55659119`, `coverage.complete: true`, `finality.mode: rpc-finalized` |
| `GET https://onchaindata.purelamp.uk/latest` | 200 | block `55659158`, hash `0x66756c6d4e24bf68118fc9d69a8290f78b5561f4b2919e3c30802945e19d27ca`, reserve0 `1001000000000000000000000`, reserve1 `1000000000000000000000000`, `chainId 84532` |
| `GET https://onchaindata.purelamp.uk/eth/metadata` | 200 | `chain: ethereum-sepolia`, `chainId: 11155111`, pair `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999`, `startBlock 12083600`, `coverage.complete: true` |
| `GET https://onchaindata.purelamp.uk/eth/latest` | 200 | block `12083602`, hash `0x36209f588c91d449f75f13eaec20155a70844166dbb4a0ad7802fcc825731f19`, reserve0 `1001000000000000000000000`, reserve1 `1000000000000000000000000`, `chainId 11155111` |
| `GET https://43-130-127-57.sslip.io/metadata` (fallback) | 200 | reachable |

The reported `latest` block is the last indexed `Sync` observation, not the chain head
(Base Sepolia head at run time was `56306626`, Ethereum Sepolia `12093901`); no fixture events
have been emitted since deployment, so no drift is implied.

## 3. Vercel

| Check | Result |
| --- | --- |
| `GET https://w07-chain-observatory.vercel.app` | `200`, body length `24301` |
| HTML contains `84532` | yes (`chain base-sepolia · id 84532`) |
| HTML contains `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | yes (pair link `href` to Base Sepolia Blockscout) |
| Rendered data | latest block `55,659,158`, reserve0 `1,001,000`, reserve1 `1,000,000`, 1 indexed LP holder (`0x0118…628f`) |

The visible label is shortened to `0x3d47…044F`; the full address appears in the anchor `href`.

## 4. Testnet fixtures

Deploy records are present for both networks and match the on-chain state:

| Network | PairFixture | Recorded block | Runtime code | Deployer balance |
| --- | --- | --- | --- | --- |
| Base Sepolia (84532) | `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | 55659119 | non-empty, 9,162 hex chars | 17,688,173,758,824,077 wei ≈ 0.01769 ETH |
| Ethereum Sepolia (11155111) | `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999` | 12083600 | non-empty, 9,162 hex chars | 48,339,098,586,003,849 wei ≈ 0.04834 ETH |

RPC endpoints used: `https://base-sepolia.gateway.tenderly.co` and
`https://ethereum-sepolia-rpc.publicnode.com`; both reported the expected `eth_chainId`.

Because `deployments/base-sepolia.json` and `deployments/ethereum-sepolia.json` exist and both
fixtures still have runtime code, `npm run deploy:testnet` was **not** run for either chain — no
new transaction hash exists for this run.

Wallet and key handling: deployer `0x0118e172324801a6333e7d0fAF7f9BB4ED72628F`; keystore
`~/.foundry/keystores/w07-legacy-deployer` (mode 600). The rotated password file
`~/.config/w07/legacy-deployer.password` is present with mode 600 and 32 bytes; its contents
were not read, printed, or recorded. The deprecated `0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B`
was not used and no mainnet transaction was sent.

## 5. Not performed

- No indexer restart (`docker compose --env-file ../../.env up -d --force-recreate`) — endpoints
  were healthy.
- No testnet redeploy — records and runtime code intact.
- No mainnet deployment.

## Reproduce

```sh
# GitHub
git -C ~/workspace/web3-portfolio/w07-chain-observatory ls-remote origin refs/heads/main

# Indexers
curl -s https://onchaindata.purelamp.uk/metadata
curl -s https://onchaindata.purelamp.uk/latest
curl -s https://onchaindata.purelamp.uk/eth/metadata
curl -s https://onchaindata.purelamp.uk/eth/latest
curl -s https://43-130-127-57.sslip.io/metadata

# Vercel
curl -s https://w07-chain-observatory.vercel.app | grep -o "84532\|0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F"

# Testnet state (Windows, direct egress)
# eth_getCode 0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F @ https://base-sepolia.gateway.tenderly.co
# eth_getCode 0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999 @ https://ethereum-sepolia-rpc.publicnode.com
```
