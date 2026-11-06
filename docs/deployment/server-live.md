# Server deployment — 2026-11-07

Status: **LIVE (preliminary)**. The read-only indexer API is running on a Tencent Cloud
server. The Vercel dashboard import and the `purelamp.uk` DNS record are separate steps.

## Public endpoint

| Item | Value |
| --- | --- |
| API | `https://43-130-127-57.sslip.io` |
| Host | Tencent Cloud, Virginia, Ubuntu 24.04 |
| Path | `/opt/w07-chain-observatory` |
| Runtime | Docker Compose: `postgres:16-alpine` + Node 24 indexer |
| Caddy | `w07-api.purelamp.uk` configured; DNS record pending |
| Data source | Ethereum mainnet USDC/WETH (`0xB4e16...C9Dc`) |
| Indexing window | block `26,350,904` to live head; pair creation not asserted |
| Coverage | partial; `/metadata` reports `pair-creation-not-configured` |

## Verified responses

`GET https://43-130-127-57.sslip.io/metadata` returned chain id `1`, the USDC/WETH pair,
`startBlock: "26350904"`, `pairCreationBlock: null`, `coverage.complete: false`, and the
configured API limits.

`GET https://43-130-127-57.sslip.io/latest` returned a live Sync snapshot with reserves,
`completeWindow: true`, 24-hour volume and a gross fee APR. Values are real mainnet data for
the configured window; they are not a full-history claim.

## Reproduce

```sh
# On the server:
cd /opt/w07-chain-observatory
docker compose --env-file .env -f deploy/server/docker-compose.yml ps
docker logs --tail 50 server-indexer-1
curl -sS http://127.0.0.1:42069/metadata | jq
```

## Pending

1. Add a Cloudflare A record `w07-api` -> `43.130.127.57` (DNS only). Caddy will then obtain
   a certificate for `https://w07-api.purelamp.uk`.
2. Import the private GitHub repository into Vercel with Root Directory `apps/web` and
   `INDEXER_URL=https://43-130-127-57.sslip.io` (switch to the `purelamp.uk` host after DNS).
3. Switch the server `.env` to the Base Sepolia fixture once that testnet deployment exists.

## Security notes

- The server `.env` is mode 600 and is not in the repository.
- The PostgreSQL container is not published to the host; only the indexer port is bound to
  `127.0.0.1:42069` and proxied by Caddy.
- No private key, password, or token is recorded in this file.
