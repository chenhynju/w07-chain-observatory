# Server deployment — 2026-11-07

Status: **LIVE**. The read-only indexer API runs on a Tencent Cloud server and indexes both
testnet fixtures: Base Sepolia at `https://onchaindata.purelamp.uk` and Ethereum Sepolia under
the `/eth` prefix on the same host.

## Public endpoints

| Item | Base Sepolia | Ethereum Sepolia |
| --- | --- | --- |
| API | `https://onchaindata.purelamp.uk` | `https://onchaindata.purelamp.uk/eth` |
| Alternate host | `https://43-130-127-57.sslip.io` | `http://127.0.0.1:42070` (server only) |
| Data source | `PairFixture` `0x3d47126774E5B1E10d4Bf2093A52A1F0b2C6044F` | `PairFixture` `0x4A9c4C103EC26ED88528A9c8DAf032BEdB854999` |
| RPC | `https://base-sepolia.gateway.tenderly.co` | `https://ethereum-sepolia-rpc.publicnode.com` |
| Indexing window | block `55,659,119` to live head | block `12,083,600` to live head |
| Coverage | complete (`START_BLOCK` equals the fixture creation block) | complete (`START_BLOCK` equals the fixture creation block) |
| Compose service | `indexer` (port 42069, database `w07`) | `indexer-eth` (port 42070, database `w07_eth`) |

Shared infrastructure: Tencent Cloud Virginia, Ubuntu 24.04, `/opt/w07-chain-observatory`,
Docker Compose with `postgres:16-alpine` and two Node 24 indexer containers. Caddy site blocks:
`onchaindata.purelamp.uk` (with `/eth/*` routed to 42070), `w07-api.purelamp.uk` (DNS pending),
and sslip.io.

The two indexers never share a database or schema, so one pair profile cannot overwrite the
other's sync state.

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

## Verified responses — Ethereum Sepolia

Checked on 2026-11-07 against `https://onchaindata.purelamp.uk/eth`:

- `/metadata` → chain id `11155111`, pair `0x4A9c...4999`, `coverage.complete: true`.
- `/latest` → block `12083602`, reserves `1,001,000 / 1,000,000`, `spotTvlToken0: 2,002,000`.
- `/series?from=12083600&to=12083872` → two `Sync` points, blocks `12083601` and `12083602`.
- `/wallet/0x0118e172324801a6333e7d0fAF7f9BB4ED72628F` → LP `Mint` transfer of `2,000,000` LP.
- `/lp-holders` → deployer balance `2,000,000` LP, `coverage: indexed-transfer-deltas`.
- `/alerts?minToken0=500000000000000000000&height=12083602` → post-Sync swap with
  `token0In: 1,000`.

`/latest?finality=finalized` still reports `finality: unverified` because the newest fixture
block is only minutes old and has not reached the RPC's finalized height yet. The endpoint
does not silently upgrade finality when the requested block is not finalized.

## Reproduce

```sh
# On the server:
cd /opt/w07-chain-observatory/deploy/server
docker compose --env-file ../../.env ps
docker compose --env-file ../../.env logs --tail 50 indexer
docker compose --env-file ../../.env logs --tail 50 indexer-eth
curl -sS http://127.0.0.1:42069/metadata | jq
curl -sS http://127.0.0.1:42070/metadata | jq
```

## Limitations

1. The fixture emits synthetic events; they do not represent real trading activity.
2. Blockscout accepted both testnet verification submissions but returned
   `Fail - Unable to verify`; Sourcify verified the same bytecode with `exact_match`.
3. The dashboard on Vercel reads the Base Sepolia instance through `INDEXER_URL`; the Ethereum
   Sepolia instance is available over HTTP but has no dedicated dashboard view yet.
4. The 24-hour volume and fee APR are `null` until the fixture window spans 24 hours.
5. The Ethereum Sepolia RPC is a public endpoint without an SLA; sustained rate limits would
   slow catch-up after downtime.

## Security notes

- The server `.env` is mode 600 and is not in the repository.
- The PostgreSQL container is not published to the host; only the indexer port is bound to
  `127.0.0.1:42069` and proxied by Caddy.
- No private key, password, or token is recorded in this file.
