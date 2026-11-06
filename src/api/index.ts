import { verifyFinality } from "../finality";
import { dashboard } from "./dashboard";
import { createPublicClient, http } from "viem";
import { Hono } from "hono";
import { db } from "ponder:api";
import { and, desc, eq, gt, gte, lt, lte, or, sql } from "ponder";
import { lpBalance, pairEvent } from "../../ponder.schema";
import { markInToken0 } from "../math";
import { resolveRuntime } from "../chain";
import { describeCoverage } from "./coverage";
import { createFixedWindowRateLimiter } from "./rate-limit";
import { withTimeout } from "./timeout";
import { parseFinalityMode, parseHeight, parseTokenAmount, parseWallet } from "./validation";

const runtime = resolveRuntime(process.env);
const rpcUrl = process.env.RPC_URL;
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS ?? "5000");
const rateLimitPerMinute = Number(process.env.RATE_LIMIT_PER_MINUTE ?? "120");
const corsOrigin = process.env.CORS_ORIGIN;
const finalityClient = rpcUrl
  ? createPublicClient({ transport: http(rpcUrl, { timeout: 3000, retryCount: 0 }) })
  : undefined;
const checkRateLimit = createFixedWindowRateLimiter({
  limit: rateLimitPerMinute,
  windowMs: 60_000,
});

const app = new Hono();

app.use("*", async (c, next) => {
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  c.header(
    "Content-Security-Policy",
    "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'",
  );
  c.header("X-Chain-Id", String(runtime.id));
  c.header("X-Pair-Address", runtime.pair);
  if (corsOrigin) {
    c.header("Access-Control-Allow-Origin", corsOrigin);
    c.header("Access-Control-Allow-Methods", "GET, OPTIONS");
    c.header("Access-Control-Allow-Headers", "Content-Type");
    c.header("Access-Control-Max-Age", "600");
    c.header("Vary", "Origin");
  }
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  await next();
});

app.use("*", async (c, next) => {
  const forwarded = c.req.header("x-forwarded-for");
  const key = forwarded?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";
  const decision = checkRateLimit(key);
  c.header("X-RateLimit-Limit", String(rateLimitPerMinute));
  c.header("X-RateLimit-Remaining", String(decision.remaining));
  if (!decision.allowed) {
    c.header("Retry-After", String(decision.retryAfterSeconds));
    return c.json({ error: "Rate limit exceeded" }, 429);
  }
  await next();
});

app.onError((error, c) => {
  if (error.message === "Request timeout") return c.json({ error: "Request timeout" }, 503);
  console.error(error);
  return c.json({ error: "Internal server error" }, 500);
});

app.get("/", (c) => c.html(dashboard));

app.get("/metadata", (c) => {
  return c.json({
    service: "w07-chain-observatory",
    chain: runtime.name,
    chainId: runtime.id,
    pair: runtime.pair,
    explorer: runtime.explorer ?? null,
    startBlock: runtime.startBlock.toString(),
    pairCreationBlock: runtime.creationBlock?.toString() ?? null,
    coverage: describeCoverage(runtime.startBlock, runtime.creationBlock),
    limits: {
      rateLimitPerMinute,
      requestTimeoutMs,
      alertsWindowBlocks: 7_200,
    },
    finality: {
      mode: "rpc-finalized",
      rpcConfigured: Boolean(rpcUrl),
    },
  });
});

interface SnapshotRow {
  historyStartBlock: bigint;
  historyStart: bigint;
  hash: string;
  timestamp: bigint;
  amount0: bigint;
  amount1: bigint;
  token0: string;
  token1: string;
}

async function loadSnapshot(block: bigint): Promise<SnapshotRow | null> {
  const latestSync = db.$with("latest_sync").as(
    db.select({
      block: pairEvent.block, hash: pairEvent.hash, log: pairEvent.log, timestamp: pairEvent.timestamp,
      reserve0: pairEvent.amount0, reserve1: pairEvent.amount1,
    }).from(pairEvent)
      .where(and(eq(pairEvent.kind, "Sync"), eq(pairEvent.block, block)))
      .orderBy(desc(pairEvent.log)).limit(1),
  );
  const firstObserved = db.$with("first_observed").as(
    db.select({ block: pairEvent.block, timestamp: pairEvent.timestamp }).from(pairEvent)
      .where(eq(pairEvent.kind, "Sync"))
      .orderBy(pairEvent.block, pairEvent.log).limit(1),
  );
  const [sync] = await withTimeout(db.with(latestSync, firstObserved).select({
    historyStartBlock: firstObserved.block,
    historyStart: firstObserved.timestamp,
    hash: latestSync.hash, timestamp: latestSync.timestamp,
    amount0: latestSync.reserve0, amount1: latestSync.reserve1,
    token0: sql<string>`coalesce(sum(${pairEvent.amount0}), 0)::text`,
    token1: sql<string>`coalesce(sum(${pairEvent.amount1}), 0)::text`,
  }).from(latestSync).innerJoin(firstObserved, sql`true`).leftJoin(pairEvent, and(
    eq(pairEvent.kind, "Swap"),
    // End-of-block reserves are defined by the last Sync log. Swaps after that
    // log in the same block belong to a later state and must not enter this window.
    or(
      lt(pairEvent.block, latestSync.block),
      and(eq(pairEvent.block, latestSync.block), lte(pairEvent.log, latestSync.log)),
    ),
    gte(pairEvent.timestamp, sql`${latestSync.timestamp} - 86400`),
  )).groupBy(
    latestSync.hash, latestSync.log, latestSync.timestamp, latestSync.reserve0, latestSync.reserve1,
    firstObserved.block, firstObserved.timestamp,
  ), requestTimeoutMs);
  return sync ?? null;
}

function snapshotPayload(block: bigint, sync: SnapshotRow, finality: "unverified" | "finalized") {
  const completeWindow = sync.timestamp - sync.historyStart >= 86400n;
  const volume = completeWindow ? { token0: sync.token0, token1: sync.token1 } : null;
  const marked = volume && markInToken0(BigInt(volume.token0), BigInt(volume.token1), sync.amount0, sync.amount1);
  const tvl = markInToken0(sync.amount0, sync.amount1, sync.amount0, sync.amount1);
  const grossFeeAprBps = tvl && marked !== null ? marked * 30n * 365n / tvl : null;
  return {
    block: block.toString(), hash: sync.hash, timestamp: String(sync.timestamp),
    chainId: runtime.id, pair: runtime.pair,
    historyStartBlock: String(sync.historyStartBlock),
    reserve0: String(sync.amount0), reserve1: String(sync.amount1),
    finality, completeWindow, volume24h: volume, spotTvlToken0: tvl?.toString() ?? null,
    annualizedGrossFeeBps: grossFeeAprBps?.toString() ?? null,
    coverage: describeCoverage(runtime.startBlock, runtime.creationBlock),
  };
}

app.get("/snapshot/:height", async (c) => {
  const block = parseHeight(c.req.param("height"));
  if (block === null) return c.json({ error: "Invalid height" }, 400);
  const finalityMode = parseFinalityMode(c.req.query("finality"));
  if (finalityMode === null) return c.json({ error: "Unsupported finality mode" }, 400);

  const sync = await loadSnapshot(block);
  if (!sync) return c.json({ error: "No Sync observation at this height" }, 404);

  let finality: "unverified" | "finalized" = "unverified";
  if (finalityMode === "finalized") {
    const verified = await verifyFinality(finalityClient, block, sync.hash);
    if (verified === "unavailable") return c.json({ error: "Finality verification unavailable" }, 503);
    if (verified === "pending") return c.json({ error: "Block is not yet finalized" }, 409);
    if (verified === "orphaned") return c.json({ error: "Indexed block is no longer canonical" }, 409);
    finality = "finalized";
  }

  return c.json(snapshotPayload(block, sync, finality));
});

app.get("/latest", async (c) => {
  const [latest] = await withTimeout(db.select({ block: pairEvent.block }).from(pairEvent)
    .where(eq(pairEvent.kind, "Sync"))
    .orderBy(desc(pairEvent.block), desc(pairEvent.log)).limit(1), requestTimeoutMs);
  if (!latest) return c.json({ error: "No Sync observation" }, 404);
  const sync = await loadSnapshot(latest.block);
  if (!sync) return c.json({ error: "No Sync observation" }, 404);
  return c.json(snapshotPayload(latest.block, sync, "unverified"));
});

app.get("/series", async (c) => {
  const from = parseHeight(c.req.query("from"));
  const to = parseHeight(c.req.query("to"));
  if (from === null || to === null || from > to) {
    return c.json({ error: "from and to must be ordered decimal block numbers" }, 400);
  }
  const limitRaw = c.req.query("limit");
  const limit = limitRaw === undefined ? 200 : Number(limitRaw);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 500) {
    return c.json({ error: "limit must be an integer between 1 and 500" }, 400);
  }
  const rows = await withTimeout(db.select({
    block: pairEvent.block, hash: pairEvent.hash, timestamp: pairEvent.timestamp,
    reserve0: pairEvent.amount0, reserve1: pairEvent.amount1,
  }).from(pairEvent)
    .where(and(eq(pairEvent.kind, "Sync"), gte(pairEvent.block, from), lte(pairEvent.block, to)))
    .orderBy(desc(pairEvent.block), desc(pairEvent.log)).limit(limit), requestTimeoutMs);
  return c.json(rows.reverse().map((row) => ({
    block: String(row.block), hash: row.hash, timestamp: String(row.timestamp),
    reserve0: String(row.reserve0), reserve1: String(row.reserve1),
  })));
});

app.get("/wallet/:address", async (c) => {
  const wallet = parseWallet(c.req.param("address"));
  if (!wallet) return c.json({ error: "Invalid wallet address" }, 400);
  const rows = await withTimeout(db.select().from(pairEvent)
    .where(and(eq(pairEvent.kind, "Transfer"),
      or(eq(pairEvent.sender, wallet), eq(pairEvent.recipient, wallet))))
    .orderBy(desc(pairEvent.block), desc(pairEvent.log)).limit(50), requestTimeoutMs);
  return c.json(rows.map(({ id, block, hash, log, timestamp, amount0, sender, recipient }) => ({
    id, block: String(block), hash, log, timestamp: String(timestamp),
    amount: String(amount0), sender, recipient,
  })));
});

app.get("/alerts", async (c) => {
  const threshold = parseTokenAmount(c.req.query("minToken0"));
  if (threshold === null) return c.json({ error: "minToken0 must be an integer in raw token0 units" }, 400);
  const end = parseHeight(c.req.query("height"));
  if (end === null) return c.json({ error: "height must be a decimal block number" }, 400);
  const start = end > 7_199n ? end - 7_199n : 0n;
  c.header("X-Alert-Window-Blocks", "7200");
  const rows = await withTimeout(db.select().from(pairEvent)
    .where(and(eq(pairEvent.kind, "Swap"), gte(pairEvent.amount0, threshold), gte(pairEvent.block, start), lte(pairEvent.block, end)))
    .orderBy(desc(pairEvent.block), desc(pairEvent.log)).limit(25), requestTimeoutMs);
  return c.json(rows.map(({ id, block, hash, amount0, amount1 }) => ({
    id, block: String(block), hash, token0In: String(amount0), token1In: String(amount1),
  })));
});

app.get("/lp-holders", async (c) => {
  const rows = await withTimeout(db.select().from(lpBalance)
    .where(gt(lpBalance.balance, 0n))
    .orderBy(desc(lpBalance.balance), desc(lpBalance.wallet)).limit(25), requestTimeoutMs);
  const coverage = describeCoverage(runtime.startBlock, runtime.creationBlock);
  return c.json({
    coverage: "indexed-transfer-deltas",
    complete: coverage.complete,
    coverageDetail: coverage,
    holders: rows.map(({ wallet, balance }) => ({ wallet, balance: String(balance) })),
  });
});

export default app;
