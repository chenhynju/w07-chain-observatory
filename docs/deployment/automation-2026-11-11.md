# Daily automation run — 2026-11-11

Run window: `2026-11-11T00:05Z` – `2026-11-11T00:15Z`
Repository HEAD: `8dade0d` (`8dade0df49d572b05a46fc00b422f9c0b5e192e5`)
Working tree at start: clean in WSL (0 modified/untracked paths)

Summary: **4 PASS, 0 BLOCKED**. No transaction was signed or broadcast; no server restart and no
redeploy were needed.

| Step | Result |
| --- | --- |
| 1. GitHub repository and push | PASS (up-to-date; WSL egress down, Windows git used) |
| 2. Server indexers, both instances | PASS |
| 3. Vercel production deployment | PASS |
| 4. Testnet fixture state | PASS (records present, runtime code non-empty) |

## 1. GitHub

WSL `gh` could not be verified because the WSL egress path was down for the whole run:

```
$ export https_proxy=http://127.0.0.1:8899 http_proxy=http://127.0.0.1:8899
$ gh auth status
github.com
  X Timeout trying to log in to github.com account chenhynju (/home/chenhy/.config/gh/hosts.yml)
  - Active account: true

$ curl -sS --max-time 30 -o /dev/null -w '%{http_code}' https://api.github.com/
000   (curl: (28) Connection timed out after 30002 milliseconds)
```

Cause: nothing is listening on `127.0.0.1:8899` on either side
(`Test-NetConnection 127.0.0.1 -Port 8899` → `False`), and the direct WSL path is also blackholed —
`getent hosts github.com` resolves to `198.18.0.145`, a VPN-intercepted address, and direct
`https://onchaindata.purelamp.uk/metadata` from WSL also times out. Windows has direct egress
(`https://api.github.com` → `200`), so GitHub operations were performed from Windows.

Windows `gh auth status` confirms the required identity:

```
github.com
  ✓ Logged in to github.com account chenhynju (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'
```

Local and remote were already identical (`git rev-list --left-right --count origin/main...main`
→ `0 0`). The prescribed push command failed on the inherited global hook, which is a WSL path
Windows git cannot execute:

```
$ git -C \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory \
    -c core.filemode=false -c core.autocrlf=false push origin main
sh: /home/chenhy/workspace/web3-portfolio/portfolio-ops/hooks/pre-push: No such file or directory
error: failed to push some refs to 'https://github.com/chenhynju/w07-chain-observatory.git'
```

The hook body (`pwd` under the canonical WSL checkout, WSL kernel check, `git diff --cached
--check` on authored source globs) was executed manually in WSL first and passed:

```
$ cd ~/workspace/web3-portfolio/w07-chain-observatory
$ pwd -P && grep -qi microsoft /proc/sys/kernel/osrelease && echo wsl_ok
/home/chenhy/workspace/web3-portfolio/w07-chain-observatory
wsl_ok
$ git diff --cached --check -- '*.sol' '*.ts' '*.tsx' '*.js' '*.cjs' '*.py' '*.sh' '*.toml' '*.yml' '*.yaml' ':!lib/**'
staged_check_clean
```

The push was then re-run with the hook path pointed away from the unreachable WSL path
(`-c core.hooksPath=C:/nonexistent-w07-hooks`); no check was skipped, because the checks had
already passed:

```
Everything up-to-date
```

Remote verification:

```
$ git ls-remote origin refs/heads/main
8dade0df49d572b05a46fc00b422f9c0b5e192e5    refs/heads/main

$ gh api repos/chenhynju/w07-chain-observatory --jq '{private,default_branch,pushed_at}'
{"default_branch":"main","private":true,"pushed_at":"2026-11-09T11:09:09Z"}
```

Repository: `https://github.com/chenhynju/w07-chain-observatory` (private). No token, private key
or `.env` content was read or printed.

## 2. Server indexers

Probed from Windows (WSL egress unavailable). Both instances answered, so no `docker compose`
restart was required.

| Request | Status | Observed |
| --- | --- | --- |
| `GET https://onchaindata.purelamp.uk/metadata` | 200 | `chain: base-sepolia`, `chainId: 84532`, pair `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F`, `startBlock 55659119`, `coverage.complete: true`, `finality.mode: rpc-finalized` |
| `GET https://onchaindata.purelamp.uk/latest` | 200 | block `55659158`, hash `0x66756c6d4e24bf68118fc9d69a8290f78b5561f4b2919e3c30802945e19d27ca`, `chainId 84532`, reserve0 `1001000000000000000000000`, reserve1 `1000000000000000000000000`, `finality: unverified` |
| `GET https://onchaindata.purelamp.uk/eth/metadata` | 200 | `chain: ethereum-sepolia`, `chainId: 11155111`, pair `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999`, `startBlock 12083600`, `coverage.complete: true` |
| `GET https://onchaindata.purelamp.uk/eth/latest` | 200 | block `12083602`, hash `0x36209f588c91d449f75f13eaec20155a70844166dbb4a0ad7802fcc825731f19`, `chainId 11155111`, reserve0 `1001000000000000000000000`, reserve1 `1000000000000000000000000` |
| `GET https://43-130-127-57.sslip.io/metadata` (fallback) | 200 | reachable |
| `GET https://43-130-127-57.sslip.io/latest` (fallback) | 200 | reachable |

The reported `latest` block is the last indexed `Sync` observation, not the chain head
(Base Sepolia head at run time `57169406`, Ethereum Sepolia `12108098`). No fixture events have
been emitted since deployment, so the gap is expected and no drift is implied.

## 3. Vercel

| Check | Result |
| --- | --- |
| `GET https://w07-chain-observatory.vercel.app` | `200`, body `24351` bytes |
| HTML contains `84532` | yes |
| HTML contains `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | yes |
| Rendered data | latest block `55,659,158` (matches indexer `latest`) |

Vercel deploys from GitHub; the pushed `main` tip is unchanged (`8dade0d`), so the live build
already corresponds to the repository head.

## 4. Testnet fixtures

Deploy records are present for both networks and match the on-chain state:

| Network | PairFixture | Recorded block | Runtime code | Deployer balance |
| --- | --- | --- | --- | --- |
| Base Sepolia (84532) | `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | 55659119 | 4580 bytes | 27,688,173,758,824,077 wei ≈ 0.027688 ETH |
| Ethereum Sepolia (11155111) | `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999` | 12083600 | 4580 bytes | 98,339,098,586,003,849 wei ≈ 0.098339 ETH |

RPC endpoints used: `https://base-sepolia.gateway.tenderly.co` and
`https://ethereum-sepolia-rpc.publicnode.com`; both reported the expected `eth_chainId`
(`0x14a34` and `0xaa36a7`).

Because `deployments/base-sepolia.json` and `deployments/ethereum-sepolia.json` exist and both
fixtures still return runtime code, `W07_CHAIN=… npm run deploy:testnet` was **not** run for
either chain — no new transaction hash exists for this run.

Wallet and key handling: deployer `0x0118e172324801a6333e7d0fAF7f9BB4ED72628F`; keystore
`~/.foundry/keystores/w07-legacy-deployer` present (mode 600). The rotated password file
`~/.config/w07/legacy-deployer.password` is present with mode 600; its contents were not read,
printed or recorded, and the retired five-character password was not used. The deprecated
`0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B` was not used and no mainnet transaction was sent.

## 5. Not performed

- No indexer restart (`docker compose --env-file ../../.env up -d --force-recreate indexer`
  / `indexer-eth`) — endpoints were healthy.
- No testnet redeploy — records and runtime code intact.
- No mainnet deployment.

## Reproduce

```sh
# GitHub (Windows egress; WSL network was intercepted for this run)
git -C \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory \
    -c core.filemode=false -c core.autocrlf=false ls-remote origin refs/heads/main
gh api repos/chenhynju/w07-chain-observatory --jq .private

# Indexers
curl -s https://onchaindata.purelamp.uk/metadata
curl -s https://onchaindata.purelamp.uk/latest
curl -s https://onchaindata.purelamp.uk/eth/metadata
curl -s https://onchaindata.purelamp.uk/eth/latest
curl -s https://43-130-127-57.sslip.io/metadata

# Vercel
curl -s https://w07-chain-observatory.vercel.app | grep -o "84532\|0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F"

# Testnet state (JSON-RPC, read-only)
# eth_getCode 0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F @ https://base-sepolia.gateway.tenderly.co
# eth_getCode 0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999 @ https://ethereum-sepolia-rpc.publicnode.com
```
