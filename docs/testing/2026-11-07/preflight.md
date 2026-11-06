# Testnet preflight — 2026-11-07

No transaction was broadcast. Both commands stopped at the balance guard.

| Profile | Chain id | RPC | Deployer | Balance | Exit |
| --- | --- | --- | --- | --- | --- |
| Base Sepolia | 84532 | `https://sepolia.base.org` | `0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B` | 0 ETH | 3 (funding required) |
| Ethereum Sepolia | 11155111 | `https://ethereum-sepolia-rpc.publicnode.com` | `0xA6755ec7C3f626a4C4c0D30803CE95D025D12d1B` | 0 ETH | 3 (funding required) |

Logs:

- [preflight-base-sepolia.log](preflight-base-sepolia.log)
- [preflight-ethereum-sepolia.log](preflight-ethereum-sepolia.log)

The keystore decryption, deployer derivation, RPC chain-id check and zero-balance guard were
exercised. The local Anvil deployment in
[deployments/local-anvil-simulation.json](../../deployments/local-anvil-simulation.json)
proves the rest of the script, including `forge create`, event transactions and record
generation. Public deployment remains **BLOCKED** until the deployer is funded.
