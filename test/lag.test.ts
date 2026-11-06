import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import test from "node:test";

test("lag probe fails when the checkpoint is stale or ahead of the RPC", async () => {
  let indexed = 95;
  const server = createServer((request, response) => {
    response.setHeader("content-type", "application/json");
    response.end(JSON.stringify(request.url === "/status"
      ? { ethereum: { block: { number: indexed } } }
      : { jsonrpc: "2.0", id: 1, result: "0x64" }));
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const origin = `http://127.0.0.1:${address.port}`;
    for (const [checkpoint, expected] of [[95, 0], [94, 1], [101, 1]]) {
      indexed = checkpoint;
      const child = spawn(process.execPath, ["scripts/lag.mjs"], {
        env: { ...process.env, RPC_URL: origin, INDEXER_URL: origin, MAX_LAG_BLOCKS: "5" },
        stdio: "ignore"
      });
      const [code] = await once(child, "exit");
      assert.equal(code, expected);
    }
  } finally {
    server.close();
    await once(server, "close");
  }
});
