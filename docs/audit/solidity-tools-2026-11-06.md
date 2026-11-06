# Solidity tool execution — 2026-11-06

AI-Assisted Self-Assessment. The bounded model and complete tool outputs are
under ../../verification/solidity/. This is a newly authored uint112 valuation
model with 131 on-chain differential cases against the existing TypeScript
function. It is not evidence of a Solidity implementation of the indexer.

Slither (102 detectors) found zero results. Aderyn (88 detectors) reported one
low visibility suggestion, retained and reviewed in the model README.
Halmos proved three restricted symbolic properties. Foundry passed 1,024 fuzz
cases. Echidna passed 10,003 calls, seed 5707. Medusa passed all five assertion
targets over 10,106 calls. Wake completed with no detections after its compiler
cache was populated with a SHA-256 verified solc 0.8.28 binary.

Mythril runtime analysis produced an SWC-101 warning at PC 48, generated ABI
calldata size arithmetic. Replaying its supplied all-zero arguments on Anvil
returned the expected (false, 0). The compiler's modular size arithmetic and
the model's bounded financial arithmetic were reviewed independently.
The original warning and replay are retained.

Certora local compilation and CVL checks completed with exit 0 using portable
Java 21 and an explicit solc 0.8.28 path. No remote proving job was submitted,
so there is no Certora proof result. AGENTS.md section 8.4 requires explicit
authorization for paid operations and remote publication. Source submission
to a proving service remains pending that authorization.

Remaining limits are the full TypeScript bigint domain, general nonlinear
symbolic proof, indexer historical completeness and public-chain reconciliation.
The existing TypeScript and PostgreSQL tests remain separate evidence.
