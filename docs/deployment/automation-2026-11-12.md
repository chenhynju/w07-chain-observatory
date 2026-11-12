# Daily automation run — 2026-11-12

Run window: `2026-11-12T00:05Z` – `2026-11-12T00:35Z`
Repository HEAD at start: `c99022c` (`c99022c3050c2189ee5aa1e25d151785bfefd86a`)
Working tree at start: clean (no modified or untracked paths in WSL)

Summary: **4 PASS, 2 BLOCKED, 0 FAIL**. No transaction was signed or broadcast, no indexer was
restarted, and no fixture was redeployed.

| Step | Result |
| --- | --- |
| 1a. GitHub identity check inside WSL | BLOCKED (local proxy `127.0.0.1:8899` down; WSL egress intercepted) |
| 1b. Push of this run's report commit | PASS via Windows fallback (`c99022c..0a35019`) |
| 2. Server indexers, both instances | PASS |
| 3. Vercel production deployment | PASS |
| 4. Testnet fixture state | PASS (records present, runtime code non-empty) |
| 5. Repository visibility = private | BLOCKED (repo is currently **public**) |

## 1. GitHub

`gh` in WSL could not be verified because WSL egress is down for this run:

```
$ export https_proxy=http://127.0.0.1:8899 http_proxy=http://127.0.0.1:8899
$ gh auth status
github.com
  X Timeout trying to log in to github.com account chenhynju (/home/chenhy/.config/gh/hosts.yml)
  - Active account: true
```

Root cause (measured, not assumed):

```
$ Test-NetConnection 127.0.0.1 -Port 8899        # Windows side
False                                            # nothing is listening on the local proxy port

$ getent hosts github.com                        # inside WSL
198.18.0.145    github.com                       # VPN fake-IP range, packets blackholed

$ curl -s -o /dev/null -w '%{http_code}' --max-time 15 https://api.github.com/   # WSL, no proxy
000
```

So both paths failed: the documented proxy `127.0.0.1:8899` is not running, and the direct WSL
route is intercepted. Windows has direct egress, and Windows `gh` is authenticated:

```
$ gh auth status
github.com
  ✓ Logged in to github.com account chenhynju (keyring)
  - Active account: true
  - Git operations protocol: https
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'
```

Repository state (fetched from Windows):

```
$ git -C \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory \
    -c core.filemode=false -c core.autocrlf=false fetch origin main
$ git rev-list --left-right --count HEAD...origin/main
0       0

$ git ls-remote origin refs/heads/main
c99022c3050c2189ee5aa1e25d151785bfefd86a    refs/heads/main
```

Nothing was ahead of the remote before this run. The canonical WSL push was attempted for the
report commit and timed out (network, no TCP session):

```
$ cd ~/workspace/web3-portfolio/w07-chain-observatory
$ timeout 20 git push origin main
# killed by timeout — no output, no response from github.com
```

The inherited global hook cannot run under Windows git (`sh: .../portfolio-ops/hooks/pre-push:
No such file or directory`, because that hook path is a WSL path). Its checks were executed
manually in WSL first and passed, then the push was re-run with the hook path redirected:

```
$ pwd -P
/home/chenhy/workspace/web3-portfolio/w07-chain-observatory
$ grep -qi microsoft /proc/sys/kernel/osrelease && echo wsl_ok
wsl_ok
$ git diff --cached --check -- '*.sol' '*.ts' '*.tsx' '*.js' '*.cjs' '*.py' '*.sh' '*.toml' '*.yml' '*.yaml' ':!lib/**'
staged_check_clean

$ git -C \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory \
    -c core.filemode=false -c core.autocrlf=false -c core.hooksPath=C:/nonexistent-w07-hooks \
    push origin main
   c99022c..0a35019  main -> main

$ git ls-remote origin refs/heads/main
0a350199408f7fca0aa1a876f3238c570918394a    refs/heads/main
```

Report commit: `0a35019` (`0a350199408f7fca0aa1a876f3238c570918394a`). Working tree is clean when
Windows git is run with `-c core.filemode=false -c core.autocrlf=false` (without those flags
Windows `git status` reports phantom modifications from autocrlf and filemode).

**Visibility deviation:** the task assumes a private repository, but the GitHub API reports it as
public:

```
$ gh api repos/chenhynju/w07-chain-observatory --jq '{private,visibility,pushed_at}'
{"private":false,"visibility":"public","pushed_at":"2026-11-11T00:13:26Z"}
```

`updated_at` is `2026-11-11T11:32:05Z`, i.e. the flip happened after the 2026-11-11 run, which
recorded `private:true`. Visibility was **not** changed by this run — that is a product decision
for the owner (the repository doubles as a public portfolio artefact).

A tracked-file audit found no credentials. The only `.env`-shaped tracked files are
`.env.example` and `deploy/server/.env.example`; the security-review evidence files contain
SHA-256 digests only (`secret-triage.json` → `fileSHA256`, 64 hex characters, zero raw key
material). No token, private key or `.env` content was read or printed.

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
| `GET https://onchaindata.purelamp.uk/health` | 200 | indexer (42069) healthy behind Caddy |
| `GET https://onchaindata.purelamp.uk/eth/health` | 200 | indexer-eth (42070) healthy behind Caddy |
| `GET https://43-130-127-57.sslip.io/metadata` (fallback) | 200 | alternate host reachable |

`/latest` returns the last indexed `Sync` observation, not the chain head
([src/api/index.ts](https://github.com/chenhynju/w07-chain-observatory/blob/main/src/api/index.ts)),
so `55659158` / `12083602` are the fixture's last swap, not a stalled indexer. Chain heads at run
time were Base Sepolia `57602471` and Ethereum Sepolia `12115206`.

## 3. Vercel

| Check | Result |
| --- | --- |
| `GET https://w07-chain-observatory.vercel.app` | `200`, body `24301` bytes |
| HTML contains `84532` | yes |
| HTML contains `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | yes |
| HTML contains `11155111` | no (Ethereum Sepolia series is not server-rendered on the landing view) |
| HTML references `onchaindata.purelamp.uk`, `/eth/` or `sslip.io` | no (indexer URLs are resolved at runtime, not inlined) |

Two documentation-only commits were pushed during this run (`0a35019`, `b61279b`). The site was
re-checked about 75 s after the push: still `200`, identical body length (`24301` bytes) and the
same `84532` / fixture-address match — expected, because documentation edits do not change the
build output.

## 4. Testnet fixtures

Both deploy records exist and match the on-chain state; therefore **no** `npm run deploy:testnet`
was executed for either chain and this run produced no new transaction hash.

| Network | PairFixture | Recorded block | Runtime code | Deployer balance |
| --- | --- | --- | --- | --- |
| Base Sepolia (84532) | `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | 55659119 | 4580 bytes | 27,688,173,758,824,077 wei ≈ 0.027688 ETH |
| Ethereum Sepolia (11155111) | `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999` | 12083600 | 4580 bytes | 98,339,098,586,003,849 wei ≈ 0.098339 ETH |

RPC endpoints: `https://base-sepolia.gateway.tenderly.co` (`eth_chainId 0x14a34`) and
`https://ethereum-sepolia-rpc.publicnode.com` (`eth_chainId 0xaa36a7`). Both balances are
unchanged from 2026-11-11, consistent with no signing activity.

Wallet handling: deployer `0x0118e172324801a6333e7d0fAF7f9BB4ED72628F`; keystore
`~/.foundry/keystores/w07-legacy-deployer` present (mode 600). The rotated password file
`~/.config/w07/legacy-deployer.password` is present, 32 bytes, mode 600; its contents were not
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
git -C \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory \
    -c core.filemode=false -c core.autocrlf=false fetch origin main
git -C \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory \
    -c core.filemode=false -c core.autocrlf=false ls-remote origin refs/heads/main
gh api repos/chenhynju/w07-chain-observatory --jq '{private,visibility}'

# Indexers
curl -s https://onchaindata.purelamp.uk/metadata
curl -s https://onchaindata.purelamp.uk/latest
curl -s https://onchaindata.purelamp.uk/eth/metadata
curl -s https://onchaindata.purelamp.uk/eth/latest
curl -s -o /dev/null -w '%{http_code}\n' https://onchaindata.purelamp.uk/health
curl -s -o /dev/null -w '%{http_code}\n' https://43-130-127-57.sslip.io/metadata

# Vercel
curl -s https://w07-chain-observatory.vercel.app | grep -o "84532\|0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F"

# Testnet state (JSON-RPC, read-only)
# eth_getCode 0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F @ https://base-sepolia.gateway.tenderly.co
# eth_getCode 0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999 @ https://ethereum-sepolia-rpc.publicnode.com
```
