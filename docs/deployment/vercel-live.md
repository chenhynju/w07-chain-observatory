# Vercel dashboard deployment — 2026-11-07

Status: **LIVE**.

| Item | Value |
| --- | --- |
| Production URL | `https://w07-chain-observatory.vercel.app` |
| Source | Private repo `chenhynju/w07-chain-observatory` |
| Root Directory | `apps/web` |
| Framework | Next.js 15 (detected) |
| API source | `https://43-130-127-57.sslip.io` (code default, overridable by `INDEXER_URL`) |
| Trigger | GitHub integration: push to `main` deploys automatically |

## Verification

`GET https://w07-chain-observatory.vercel.app` returned HTTP 200. The rendered HTML
contained the hero `Reserve truth at a specific block.` and the metric cards `Spot TVL`,
`24h input`, `Gross fee APR` and `Indexed LP holders`. It did not contain the
`Indexer is offline` state, so the server-side fetch reached the cloud indexer.

## Pending

- Custom domain `w07.purelamp.uk`: add it in the Vercel project and point Cloudflare DNS at
  Vercel. The apex `purelamp.uk` already resolves to Vercel; the API subdomain is separate.
- After `w07-api.purelamp.uk` has an A record to `43.130.127.57`, the API URL can be switched
  from the `sslip.io` hostname to the branded hostname.
- The Vercel project is private-repo backed; reviewers need repository access or a public
  deployment URL.
