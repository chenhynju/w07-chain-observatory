import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { createPublicClient, createWalletClient, http } from "viem";
import { markInToken0 } from "../src/math.ts";

const url = "http://127.0.0.1:18546";
const node = spawn("anvil", ["--port", "18546", "--silent"], { stdio: ["ignore", "ignore", "inherit"] });
try {
  const client = createPublicClient({ transport: http(url, { retryCount: 0, timeout: 1000 }) });
  for (let attempt = 0; attempt < 30; attempt++) {
    if (node.exitCode !== null) throw new Error("Local Anvil exited");
    try { await client.getBlockNumber(); break; } catch { await new Promise(r => setTimeout(r, 200)); }
  }
  const wallet = createWalletClient({ transport: http(url) });
  const [account] = await wallet.getAddresses();
  const artifact = JSON.parse(readFileSync("verification/solidity/out/ValuationModel.sol/ValuationModel.json", "utf8"));
  const hash = await wallet.deployContract({ account, chain: null, abi: artifact.abi, bytecode: artifact.bytecode.object });
  const receipt = await client.waitForTransactionReceipt({ hash });
  assert.ok(receipt.contractAddress);
  const limit = (1n << 112n) - 1n;
  const cases = [[0n, 0n, 0n, 0n], [limit, limit, limit, 1n], [limit, limit, limit, limit]];
  let seed = 0x5707n;
  function next() { seed = (seed * 6364136223846793005n + 1n) & limit; return seed; }
  for (let i = 0; i < 128; i++) cases.push([next(), next(), next(), next()]);
  for (const args of cases) {
    const result = await client.readContract({ address: receipt.contractAddress, abi: artifact.abi, functionName: "mark", args }) as [boolean, bigint];
    const expected = markInToken0(args[0], args[1], args[2], args[3]);
    assert.equal(result[0], expected !== null);
    assert.equal(result[1], expected ?? 0n);
  }
  const mythril = JSON.parse(readFileSync("verification/solidity/reports/mythril-runtime.json", "utf8"));
  for (const finding of mythril.issues) {
    for (const step of finding.tx_sequence.steps) {
      const response = await client.call({
        to: receipt.contractAddress,
        data: step.calldata,
        account: step.origin,
        value: BigInt(step.value),
      });
      assert.equal(response.data, "0x" + "0".repeat(128));
    }
  }
  console.log("PASS: Mythril reported calldata replay returns (false, 0)");
  console.log(`PASS: ${cases.length} on-chain Solidity/TypeScript differential cases`);
} finally {
  node.kill();
}
