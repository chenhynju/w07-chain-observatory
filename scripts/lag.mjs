const rpc = process.env.RPC_URL;
const indexer = process.env.INDEXER_URL ?? "http://127.0.0.1:42069";
const limit = Number(process.env.MAX_LAG_BLOCKS ?? "12");
if (!rpc || !Number.isSafeInteger(limit) || limit < 0) {
  throw new Error("Set RPC_URL and a nonnegative integer MAX_LAG_BLOCKS");
}

async function read(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error(`Upstream returned HTTP ${response.status}`);
  return response.json();
}

const [status, head] = await Promise.all([
  read(new URL("/status", indexer)),
  read(rpc, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_blockNumber", params: [] })
  })
]);
const indexed = status.ethereum?.block?.number;
if (!Number.isSafeInteger(indexed) || indexed < 0 || !/^0x[0-9a-f]+$/i.test(head.result)) {
  throw new Error("Missing chain head or indexing checkpoint");
}
const lag = BigInt(head.result) - BigInt(indexed);
console.log(JSON.stringify({ indexed, head: BigInt(head.result).toString(), lag: lag.toString() }));
if (lag < 0n || lag > BigInt(limit)) process.exitCode = 1;
