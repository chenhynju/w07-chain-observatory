# Daily automation run — 2026-11-16

Run window: `2026-11-16T00:05Z` – `2026-11-16T00:20Z`
Repository HEAD at start: `180a6fb` (`180a6fb3371dbe056a89be78a297f293e72edb64`)
Working tree at start: clean relative to `origin/main`, with two pre-existing untracked paths
(`README.zh-CN.md`, `evidence/closeout-20261114/`) left untouched by this run.

Summary: **5 PASS, 2 BLOCKED, 0 FAIL**. No transaction was signed or broadcast, no indexer was
restarted, and no fixture was redeployed.

| Step | Result |
| --- | --- |
| 1a. GitHub identity check inside WSL | PASS (direct egress; documented local proxy `127.0.0.1:8899` is gone) |
| 1b. Push of this run's report commit | PASS from WSL (Windows git rejected: connection reset) |
| 1c. Repository visibility = private | BLOCKED (repo is still **PUBLIC**, unchanged) |
| 2. Server indexers, both instances | PASS |
| 3. Vercel production deployment | PASS (verified from an external vantage point; local direct access BLOCKED) |
| 4. Testnet fixture state | PASS (records present, runtime code non-empty, balances non-zero) |

## 1. GitHub

### 1a. Identity check — PASS, but the documented proxy no longer applies

The runbook says to `export https_proxy=http://127.0.0.1:8899 http_proxy=http://127.0.0.1:8899`
before calling `gh`. That port is not listening on this host, and with it exported every request
fails:

```
$ export https_proxy=http://127.0.0.1:8899 http_proxy=http://127.0.0.1:8899
$ gh auth status
github.com
  X Timeout trying to log in to github.com account chenhynju (/home/chenhy/.config/gh/hosts.yml)
  - Active account: true

$ curl -s -o /dev/null -w '%{http_code}\n' https://api.github.com/rate_limit
000
```

With the proxy variables removed, WSL reaches GitHub directly. `~/.wslconfig` sets
`networkingMode=mirrored` + `autoProxy=true`, so egress follows the Windows network stack. No listener
exists on any common proxy port:

```
$ Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1 |
    Where LocalPort -in 7890,7891,7897,8899,10808,10809,8889,1080,8080,20171,2080
# empty
```

Re-run without proxy variables:

```
$ unset https_proxy http_proxy HTTPS_PROXY HTTP_PROXY
$ gh auth status
github.com
  ✓ Logged in to github.com account chenhynju (/home/chenhy/.config/gh/hosts.yml)
  - Active account: true
  - Git operations protocol: https
  - Token: <redacted>
  - Token scopes: 'gist', 'read:org', 'repo', 'workflow'

$ curl -s -o /dev/null -w '%{http_code} %{time_total}s\n' https://api.github.com/rate_limit
200 0.391197s
```

The token value was never printed; the output above is the redacted form of `gh`'s own summary.

### 1b. Push — PASS from WSL, after the Windows route failed

Sync state before the report commit:

```
$ git ls-remote origin refs/heads/main
180a6fb3371dbe056a89be78a297f293e72edb64	refs/heads/main

$ git status --short --branch
## main...origin/main
?? README.zh-CN.md
?? evidence/closeout-20261114/
```

Local `main` was level with `origin/main` at `180a6fb`, so no rebase was needed. Only
`docs/deployment/automation-2026-11-16.md` was committed; the two pre-existing untracked paths were
deliberately left out.

Commit (from WSL, so the `portfolio-ops` `pre-commit` hook applies normally):

```
$ git add docs/deployment/automation-2026-11-16.md
$ git commit -m "Record 2026-11-16 daily automation run"
[main e73bda0] Record 2026-11-16 daily automation run
 1 file changed, 208 insertions(+)
```

The runbook's preferred Windows route ran but could not reach GitHub — the real failure, recorded
verbatim rather than worked around silently:

```
$ git -C \\wsl.localhost\Ubuntu-24.04\home\chenhy\workspace\web3-portfolio\w07-chain-observatory \
    -c core.filemode=false -c core.autocrlf=false push origin main
fatal: unable to access 'https://github.com/chenhynju/w07-chain-observatory.git/':
Recv failure: Connection was reset
```

The same push from WSL first hit a transient TLS reset, then succeeded on retry:

```
$ GIT_TERMINAL_PROMPT=0 git push origin main
fatal: unable to access 'https://github.com/chenhynju/w07-chain-observatory.git/':
GnuTLS recv error (-110): The TLS connection was non-properly terminated.   # attempt 1

$ GIT_TERMINAL_PROMPT=0 git push origin main
To https://github.com/chenhynju/w07-chain-observatory.git
   180a6fb..e73bda0  main -> main                                          # attempt 2
```

Verified afterwards: `git ls-remote origin refs/heads/main` → `e73bda0`. No force-push, no hook
bypass (`--no-verify` was not used on either attempt).

A follow-up commit correcting this section's first draft had to be pushed the same way and needed
three attempts (`connection reset`, `connection reset`, then `e73bda0..018321a  main -> main`), so
the instability is reproducible rather than a one-off. Final state: local `main` = remote `main` =
`018321a`, with `?? README.zh-CN.md` and `?? evidence/closeout-20261114/` still untracked as before.

### 1c. Repository visibility — BLOCKED

The runbook describes the repository as private. It is not, and this run changed nothing about it:

```
$ gh repo view chenhynju/w07-chain-observatory --json nameWithOwner,visibility,defaultBranchRef
{"defaultBranchRef":{"name":"main"},"nameWithOwner":"chenhynju/w07-chain-observatory","visibility":"PUBLIC"}
```

This is a standing mismatch with the runbook, reported on 2026-11-15 as well. It is **not** flipped
unilaterally here: the same repository is used as a public portfolio artifact, so making it private
is a decision for the owner, not a routine automation step. Nothing secret lives in the tree — the
keystore and password file are outside the repository, and no `.env` is tracked.

## 2. Server indexers — PASS

Fresh probes, no restart required:

| Endpoint | Status | Payload summary |
| --- | --- | --- |
| `https://onchaindata.purelamp.uk/metadata` | 200 (1.23 s) | `chain: base-sepolia`, `chainId: 84532`, pair `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F`, `startBlock 55659119`, `coverage.complete: true`, `finality.mode: rpc-finalized` |
| `https://onchaindata.purelamp.uk/latest` | 200 | block `55659158`, hash `0x66756c6d…19d27ca`, `chainId 84532`, reserve0 `1001000000000000000000000`, reserve1 `1000000000000000000000000` |
| `https://onchaindata.purelamp.uk/eth/metadata` | 200 (1.09 s) | `chain: ethereum-sepolia`, `chainId: 11155111`, pair `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999`, `startBlock 12083600`, `coverage.complete: true` |
| `https://onchaindata.purelamp.uk/eth/latest` | 200 | block `12083602`, hash `0x36209f58…c825731f19`, `chainId 11155111` |

The `/latest` blocks equal the last synthetic swap of each fixture (`55659158` / `12083602`), so they
are the pair's last event, not a stalled indexer. Chain heads at run time were Base Sepolia
`59,331,189` and Ethereum Sepolia `12,143,706`; the pair has emitted no events since deployment, as
expected for a static fixture. `docker compose ... --force-recreate` was therefore not run.

## 3. Vercel — PASS, with a local network caveat

Direct access from this host fails, and the failure is local DNS poisoning rather than a deployment
problem:

```
$ curl -sS -m 25 -o /dev/null -w '%{http_code}\n' https://w07-chain-observatory.vercel.app/
curl: (28) Failed to connect to w07-chain-observatory.vercel.app:443 after 21086 ms
000

$ Resolve-DnsName w07-chain-observatory.vercel.app -Type A
173.255.209.47            # Linode range, not Vercel anycast
$ Resolve-DnsName w07-chain-observatory.vercel.app -Server 1.1.1.1 -Type A
31.13.68.169              # Facebook range
$ Resolve-DnsName w07-chain-observatory.vercel.app -Server 8.8.8.8 -Type A
199.59.148.201            # unrelated
```

Three mutually inconsistent answers for one name, none of them a Vercel edge address, means the
answers are being rewritten in transit. DoH is blocked as well (`cloudflare-dns.com` resets the
connection, `dns.google` times out), and `https://api.vercel.com/` does return `308`, so general
egress works and only this hostname is affected. Forcing known Vercel anycast IPs
(`76.76.21.21`, `76.76.21.98`, `216.198.79.1`, `64.29.17.1`) via `--resolve` also timed out, so the
block is applied to the connection, not only to DNS.

Content was therefore verified from an external vantage point
(`https://api.allorigins.win/raw?url=...`), which fetched the deployed page from Vercel's edge:

| Check | Result |
| --- | --- |
| `GET https://w07-chain-observatory.vercel.app/` (external fetch) | `200`, body `24,351` bytes |
| `<title>` | `W07 Chain Observatory` |
| HTML contains `84532` | yes — rendered as `chain <strong>base-sepolia</strong> · id <strong>84532</strong>` |
| HTML contains `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | yes — rendered as `pair <strong>0x3d47…044F</strong>` |
| HTML contains `11155111` | no (the Ethereum Sepolia series is not server-rendered on the landing view) |

No deployment error was observed; this run's commit only touches `docs/deployment/`, so the
rendered landing page is unchanged and no redeploy was triggered deliberately.

The local Vercel CLI credential is expired, so the deployments API could not be used as a
cross-check:

```
$ curl -H "Authorization: Bearer <redacted>" "https://api.vercel.com/v6/deployments?projectId=..."
{"error":{"code":"forbidden","message":"Not authorized","invalidToken":true}}
```

## 4. Testnet fixtures — PASS

Deployment records match the live chain; nothing was redeployed.

| Network | PairFixture | Recorded block | Runtime code | Deployer balance |
| --- | --- | --- | --- | --- |
| Base Sepolia (84532) | `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | 55659119 | 9,162 hex chars (4,581 bytes) | 27,673,545,624,395,899 wei ≈ 0.027674 ETH |
| Ethereum Sepolia (11155111) | `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999` | 12083600 | 9,162 hex chars (4,581 bytes) | 98,339,098,586,003,849 wei ≈ 0.098339 ETH |

Read-only checks used, with `RPC_URL` on Base Sepolia kept on
`https://base-sepolia.gateway.tenderly.co` and Ethereum Sepolia on
`https://ethereum-sepolia-rpc.publicnode.com`:

```
eth_chainId      → 0x14a34  (84532)   | 0xaa36a7 (11155111)
eth_blockNumber  → 59,331,189         | 12,143,706
eth_getBalance   → deployer 0x0118e172324801a6333e7d0fAF7f9BB4ED72628F, non-zero on both
eth_getCode      → both pair addresses return 4,581 bytes, matching deployments/*.json
```

`deployments/base-sepolia.json` and `deployments/ethereum-sepolia.json` both report
`status: DEPLOYED`, `sourceVerification: VERIFIED_SOURCIFY`, and `indexer.latestSyncBlock`
`55659158` / `12083602`, consistent with what the indexer APIs return.

Keystore presence only — no password was read, printed, or recorded:

```
$ ls -l ~/.foundry/keystores/w07-legacy-deployer
-rw------- 1 chenhy chenhy 436 Nov  7 20:49 .../w07-legacy-deployer
$ stat -c '%a %U %n' ~/.config/w07/legacy-deployer.password
600 chenhy /home/chenhy/.config/w07/legacy-deployer.password
```

Both files exist with the expected permissions, so the redeploy path (`W07_CHAIN=base-sepolia|ethereum-sepolia
npm run deploy:testnet`) would be available if a record were ever missing. It was not needed. No
mainnet transaction was sent, and the retired address `0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B`
was not used.

## Open items for the next run

1. Drop the `127.0.0.1:8899` proxy export from the runbook — WSL is on mirrored networking and
   reaches GitHub directly. Keeping the export makes `gh` fail outright.
2. Decide on repository visibility. Either flip it to private (`gh repo edit --visibility private`)
   or correct the runbook, which currently claims the repository is private.
3. Vercel verification from this host needs an external fetch helper or a working proxy; treat a
   direct `000` from this machine as inconclusive rather than a failed deployment.
4. Refresh the Vercel CLI credential if the deployments API is wanted for cross-checking.
5. The Windows `git ... push` route is currently unusable from this host (connection reset to
   github.com), so the runbook's "prefer Windows git" rule needs rethinking alongside item 1.
