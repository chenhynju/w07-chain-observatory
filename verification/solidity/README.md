# W07 Solidity verification model

This directory models the existing TypeScript markInToken0 valuation function.
All four Solidity inputs are uint112. TypeScript supports larger integers, so
this bounded model does not cover its entire input domain. The model is not
deployed to a public chain and does not hold funds.

## Executed tool results

| Tool | Result | Evidence |
| --- | --- | --- |
| Foundry | PASS, 1,024 rounding fuzz cases | reports/forge.log |
| Slither | PASS, 102 detectors, zero findings | reports/slither.json |
| Aderyn | 88 detectors, one low visibility suggestion, reviewed below | report.md |
| Halmos | PASS, three symbolic properties | reports/halmos.json |
| Echidna | PASS, seed 5707, 10,003 calls | reports/echidna.log |
| Medusa | PASS, 5 assertion targets, 10,106 calls | reports/medusa.log |
| Wake | PASS, no detections | reports/wake.log |
| Mythril | One arithmetic warning, triaged as compiler ABI arithmetic; replay passed | reports/mythril-runtime.json |
| Certora | PASS local compilation and CVL checks; remote proof NOT RUN | reports/certora-local.log |

Halmos proves zero denominator, zero token1 input and unit-price properties.
General nonlinear rounding was exercised by Foundry/Echidna/Medusa; it was not
proved by Halmos. The differential script deploys the actual model bytecode
locally and compares 131 cases against the TypeScript implementation, including
maximum uint112 values and zero denominator.

Aderyn L-1 observes no internal call in its source-only scope. The inherited
property harness calls mark internally. Public visibility supports both the
differential external ABI and inherited property tests. The original finding
is retained without disabling the detector.

Mythril reports SWC-101 at PC 48 in the compiler-generated calldata size check.
Its supplied input uses all-zero arguments. Modular arithmetic in the ABI
length check is intentional; replay evidence and the report are retained.
A successful input replay alone is not a proof that every arithmetic path is
safe. The independent bounds used here imply the financial product fits
224 bits and the resulting sum fits 225 bits.

Certora CLI was invoked with compilation_steps_only, and no remote proof was
submitted. A checksum-verified portable Java 21 runtime was installed at ~/.local/share/w07-jre21 for this invocation.
Remote proof execution and any service cost require explicit authorization.

This is AI-Assisted Self-Assessment. These results apply to the bounded model.
Indexer rollback, RPC correctness, PostgreSQL state and the complete W07
application retain their separate tests and acceptance criteria.

## Reproduction

From this directory, with the installed tools on PATH:

```sh
forge test -vv
slither . --json reports/slither.json
aderyn .
halmos --contract ValuationTest --function check_ --json-output reports/halmos.json
echidna test/Valuation.t.sol --contract ValuationTest --test-mode assertion --test-limit 10000 --seq-len 1 --seed 5707
medusa fuzz --compilation-target test/Valuation.t.sol --target-contracts ValuationTest --workers 2 --test-limit 10000 --seq-len 1 --timeout 45 --no-color
wake detect all
myth analyze --bin-runtime -c "$(cat reports/runtime.hex)" --execution-timeout 30 -o json
JAVA_HOME="$HOME/.local/share/w07-jre21" PATH="$HOME/.local/share/w07-jre21/bin:$PATH" certoraRun src/ValuationModel.sol --verify ValuationModel:certora/Valuation.spec --solc "$HOME/.solc-select/artifacts/solc-0.8.28/solc-0.8.28" --compilation_steps_only
```

From the repository root, run `node scripts/differential-model.ts` with Anvil on
PATH and local port 18546 free. The script also replays the retained Mythril
input. Run compile and analysis commands sequentially because some tools clean
or regenerate Foundry artifacts.
