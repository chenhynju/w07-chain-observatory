# Testnet preflight — 2026-11-07

> Update: the target deployer was changed to the funded legacy wallet
> `0x0118e172324801a6333e7d0fAF7f9BB4ED72628F` (Base Sepolia 0.007976 ETH,
> Ethereum Sepolia 0.05 ETH). The zero-balance preflight below is historical and applies to
> the retired bootstrap wallet `0xA675...2d1B`.

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
