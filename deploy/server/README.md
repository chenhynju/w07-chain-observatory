# Server deployment (Docker Compose + Caddy)

This directory deploys the read-only indexer API to a Linux server. It does not
deploy the dashboard; the dashboard is hosted on Vercel via the GitHub integration.

## Prerequisites

- Docker Engine and Docker Compose v2
- Caddy listening on ports 80/443
- A DNS record or an `sslip.io` hostname pointing at the server
- A recent Ethereum mainnet RPC with log access

## First deployment

```sh
# On the server, in the repository root:
cp deploy/server/.env.example .env
# Edit .env: set POSTGRES_PASSWORD and the indexing window.
chmod 600 .env

docker compose --env-file .env -f deploy/server/docker-compose.yml up -d --build
curl -sS http://127.0.0.1:42069/metadata | jq
```

## Caddy

Copy `Caddyfile.w07` to `/etc/caddy/sites-enabled/w07.caddy` and ensure the main
Caddyfile imports it:

```caddyfile
import /etc/caddy/sites-enabled/w07.caddy
```

Validate and reload:

```sh
caddy validate --config /etc/caddy/Caddyfile
systemctl reload caddy
```

`w07-api.purelamp.uk` requires an A record to the server IP. Until that record
exists, use `https://43-130-127-57.sslip.io` for the Vercel `INDEXER_URL`.

## Switching to the Base Sepolia fixture

After the testnet deployment writes `deployments/base-sepolia.json`, update `.env`:

```ini
W07_CHAIN=base-sepolia
RPC_URL=https://sepolia.base.org
PAIR_ADDRESS=<fixture address>
START_BLOCK=<deployment block>
PAIR_CREATION_BLOCK=<deployment block>
```

Then `docker compose --env-file .env -f deploy/server/docker-compose.yml up -d --build`.
Use a fresh PostgreSQL volume or a different database name when changing the
pair/profile; one schema holds one pair.
