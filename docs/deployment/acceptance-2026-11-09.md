# W07 chain observatory acceptance evidence

Evidence index prepared 2026-11-09. Repository inspected at `ae2a87957a884608d689ae3556629b578cec4ceb`. Individual reports and deployment manifests identify the source that was tested or deployed.

| Gate | Result |
| --- | --- |
| Local engineering | PASS within the tested scope |
| Security self-review | Recorded in [AI-Assisted Self-Assessment](../audit/review-2026-11-08.md) |
| Independent third-party audit | NOT RUN |
| Owner learning mastery | NOT RUN |

## Local verification

14 TypeScript tests and eight Solidity fixture tests passed. Local chain reorg and indexer recovery, native PostgreSQL smoke, and protected hosted desktop/mobile rendering have separate evidence. [Engineering review](../audit/review-2026-11-08.md) and [hosted UI](../../evidence/hosted-ui-20261109/acceptance.json).

## Public testnet

Ethereum Sepolia and Base Sepolia fixtures PASS. Both recorded a creation transaction, synthetic mint and synthetic swap. All six successful receipts were rechecked by JSON-RPC on 2026-11-09 with chain IDs and block numbers matched. [Ethereum Sepolia record](../../deployments/ethereum-sepolia.json) and [Base Sepolia record](../../deployments/base-sepolia.json).

## Remaining scope

PairFixture emits synthetic events without asset transfers. The two fixture runs do not establish general historical index completeness or production durability. [Dual indexer service observation](automation-2026-11-09.md).
