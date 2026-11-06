# Local verification 2026-11-05

- TypeScript check: PASS
- Node test runner: PASS, 4 tests
- Anvil backfill and live Sync branch replacement: PASS
- LP Transfer accounting, persistent PostgreSQL restart, live Ethereum reconciliation: NOT RUN

Command: `TMPDIR=/dev/shm bash scripts/smoke-anvil.sh` with Node 24.20.0 and Foundry on PATH.

The fixture first indexes reserve0=2, then observes reserve0=9 at the same height under a different hash. The fixture tests canonical snapshot replacement.

```text
{"block":"1","hash":"0x8c57cfe3c55b0513708bd65a8607631d2678b7e961fd50644a18239e941e1ed9","timestamp":"1793866153","reserve0":"2","reserve1":"3","volume24h":{"token0":"0","token1":"0"},"spotTvlToken0":"4","annualizedGrossFeeBps":"0"}
{"orphan":"0xa78c7487a4ef9758b29bc3b197fa9debb785d41eefc53662062471eaeace27e9","canonical":"0x6af4d4fd9c8880563f56aea418bbc8c22625bf8a6f858d3c988c385561aac2d8","reserve0":"9"}
Smoke logs: /dev/shm/tmp.G8NO0ubQtK
```
