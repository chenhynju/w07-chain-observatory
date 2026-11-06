import assert from "node:assert/strict";

const rpc = process.env.RPC_URL;
const pair = process.env.PAIR_ADDRESS ?? "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc";
const height = process.argv[2];
const indexer = process.env.INDEXER_URL ?? "http://127.0.0.1:42069";
if (!rpc || !/^0x[0-9a-f]{40}$/i.test(pair) || !/^\d{1,16}$/.test(height)) {
  throw new Error("Set RPC_URL and pass a decimal block height");
}

async function json(url, init) {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
  if (!response.ok) throw new Error(`Request failed with HTTP ${response.status}`);
  return response.json();
}

const snapshot = await json(new URL(`/snapshot/${height}`, indexer));
assert.match(snapshot.hash, /^0x[0-9a-f]{64}$/i);
const { result, error } = await json(rpc, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    jsonrpc: "2.0", id: 1, method: "eth_call",
    params: [{ to: pair, data: "0x0902f1ac" }, { blockHash: snapshot.hash, requireCanonical: true }]
  })
});
if (error) throw new Error(`eth_call failed with RPC code ${error.code}`);
assert.match(result, /^0x[0-9a-f]{192}$/i);
assert.equal(BigInt(snapshot.reserve0), BigInt("0x" + result.slice(2, 66)), "reserve0");
assert.equal(BigInt(snapshot.reserve1), BigInt("0x" + result.slice(66, 130)), "reserve1");
console.log(JSON.stringify({ height, hash: snapshot.hash, reserve0: snapshot.reserve0, reserve1: snapshot.reserve1 }));
