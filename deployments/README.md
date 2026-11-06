# Deployment records

This directory receives machine-readable records only after a real transaction exists.
The testnet runbook is [docs/deployment/testnet.md](../docs/deployment/testnet.md).

Expected files after funding:

- `base-sepolia.json`
- `ethereum-sepolia.json`
- `local-anvil-simulation.json` (already present; `localSimulation: true`, not a public deployment)

No placeholder addresses, transaction hashes or block numbers are committed. The current
status is **pending faucet funding**; see the runbook for the deployer address and funding
channels. The local simulation record exists to prove the deployment script and keystore
signing path work before spending public testnet ETH; it must not be cited as a testnet
deployment.
