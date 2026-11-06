import assert from "node:assert/strict";
import { createServer } from "node:http";
import { once } from "node:events";
import test from "node:test";
import { createPublicClient, http } from "viem";
import { verifyFinality } from "../src/finality.ts";

test("finality verification over HTTP fails closed across RPC branches", async () => {
  const hash = "0x" + "ab".repeat(32);
  let mode = "same";
  const calls: string[] = [];
  const server = createServer(async (req, res) => {
    let text = "";
    for await (const chunk of req) text += chunk;
    const body = JSON.parse(text);
    calls.push(body.params[0]);
    res.setHeader("content-type", "application/json");
    if (mode === "error") {
      res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { code: -32000, message: "Unavailable" } }));
      return;
    }
    const finalized = body.params[0] === "finalized";
    let number = finalized && mode === "older" ? "0x20" : "0x10";
    if (mode === "pending") number = "0xf";
    if (mode === "wrong-height" && !finalized) number = "0x11";
    if (mode === "wrong-height" && finalized) number = "0x20";
    const result = mode === "null" ? null : {
      number, hash: mode === "orphan" ? "0x" + "cd".repeat(32) : hash,
      transactions: [], timestamp: "0x1", gasLimit: "0x1", gasUsed: "0x0",
    };
    res.end(JSON.stringify({ jsonrpc: "2.0", id: body.id, result }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const client = createPublicClient({ transport: http(`http://127.0.0.1:${address.port}`, { retryCount: 0, timeout: 1000 }) });
  try {
    for (const [scenario, expected] of [
      ["same", "finalized"], ["older", "finalized"], ["pending", "pending"],
      ["orphan", "orphaned"], ["error", "unavailable"], ["null", "unavailable"],
      ["wrong-height", "unavailable"],
    ] as const) {
      mode = scenario;
      calls.length = 0;
      assert.equal(await verifyFinality(client, 16n, hash), expected, scenario);
      assert.equal(calls[0], "finalized");
      if (scenario === "older") assert.deepEqual(calls, ["finalized", "0x10"]);
    }
    assert.equal(await verifyFinality(undefined, 16n, hash), "unavailable");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
