# Server deployment — 2026-11-07

Status: **LIVE**. The read-only indexer API runs on a Tencent Cloud server, indexes the Base
Sepolia `PairFixture`, and is published at `https://onchaindata.purelamp.uk`.

## Public endpoint

| Item | Value |
| --- | --- |
| API | `https://onchaindata.purelamp.uk` |
| Alternate host | `https://43-130-127-57.sslip.io` |
| Caddy site blocks | `onchaindata.purelamp.uk`, `w07-api.purelamp.uk` (DNS pending), sslip.io |
| Host | Tencent Cloud, Virginia, Ubuntu 24.04 |
| Path | `/opt/w07-chain-observatory` |
| Runtime | Docker Compose: `postgres:16-alpine` + Node 24 indexer |
| Data source | Base Sepolia `PairFixture` `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` |
| RPC | `https://base-sepolia.gateway.tenderly.co` |
| Indexing window | block `55,659,119` to live head |
| Coverage | complete (`START_BLOCK` equals the fixture creation block) |

The RPC is archive-capable because Ponder probes a historical block while resolving its
finalized boundary; `sepolia.base.org` prunes history before block 46,500,000 and stalls that
probe. The public Tenderly gateway rate-limits, but Ponder's retries keep the indexer moving.

## Verified responses

Checked on 2026-11-07 against `https://onchaindata.purelamp.uk`:

- `/metadata` → chain id `84532`, pair `0x3d47...044F`, `coverage.complete: true`,
  `finality.mode: rpc-finalized`.
- `/latest` → block `55659158`, reserves `1,001,000 / 1,000,000` (raw 18-decimal units),
  `completeWindow: false` because the fixture is younger than 24 hours, so `volume24h` is `null`.
- `/snapshot/55659158` → same snapshot as `/latest`.
- `/series?from=55659119&to=55659158` → two `Sync` points, at blocks `55659138` and `55659158`.
- `/wallet/0x0118e172324801a6333e7d0fAF7f9BB4ED72628F` → LP `Mint` transfer of `2,000,000` LP.
- `/lp-holders` → deployer balance `2,000,000` LP, `coverage: indexed-transfer-deltas`.
- `/alerts?minToken0=500000000000000000000&height=55659158` → the post-Sync swap with
  `token0In: 1,000`.

TLS for `onchaindata.purelamp.uk` is issued by Caddy automatically; the former Caddyfile only
served `w07-api.purelamp.uk` and sslip.io, which is why the new hostname initially returned a
TLS alert.

## Reproduce

```sh
# On the server:
cd /opt/w07-chain-observatory/deploy/server
docker compose --env-file ../../.env ps
docker compose --env-file ../../.env logs --tail 50 indexer
curl -sS http://127.0.0.1:42069/metadata | jq
```

## Limitations

1. The fixture emits synthetic events; they do not represent real trading activity.
2. Blockscout accepted both testnet verification submissions but returned
   `Fail - Unable to verify`; Sourcify verified the same bytecode with `exact_match`.
3. Only one chain is indexed at a time. The server currently indexes Base Sepolia; the Ethereum
   Sepolia fixture deployment is verified on-chain but not indexed by this instance.
4. The 24-hour volume and fee APR are `null` until the fixture window spans 24 hours.

## Security notes

- The server `.env` is mode 600 and is not in the repository.
- The PostgreSQL container is not published to the host; only the indexer port is bound to
  `127.0.0.1:42069` and proxied by Caddy.
- No private key, password, or token is recorded in this file.
