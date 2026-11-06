import { verifyFinality } from "../finality";
import { dashboard } from "./dashboard";
import { createPublicClient, getAddress, http, isAddress } from "viem";
import { Hono } from "hono";
import { db } from "ponder:api";
import { and, desc, eq, gt, gte, lte, or, sql } from "ponder";
import { lpBalance, pairEvent } from "../../ponder.schema";
import { markInToken0 } from "../math";

const app = new Hono();
const rpcUrl = process.env.RPC_URL;
const finalityClient = rpcUrl
  ? createPublicClient({ transport: http(rpcUrl, { timeout: 3000, retryCount: 0 }) })
  : undefined;
app.use("*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store");
});
app.get("/", (c) => c.html(dashboard));

app.get("/snapshot/:height", async (c) => {
  const height = c.req.param("height");
  if (!/^\d{1,16}$/.test(height)) return c.json({ error: "Invalid height" }, 400);
  const requestedFinality = c.req.query("finality");
  if (requestedFinality !== undefined && requestedFinality !== "finalized") {
    return c.json({ error: "Unsupported finality mode" }, 400);
  }
  const block = BigInt(height);
  const latestSync = db.$with("latest_sync").as(
    db.select({
      block: pairEvent.block, hash: pairEvent.hash, timestamp: pairEvent.timestamp,
      reserve0: pairEvent.amount0, reserve1: pairEvent.amount1
    }).from(pairEvent)
      .where(and(eq(pairEvent.kind, "Sync"), eq(pairEvent.block, block)))
      .orderBy(desc(pairEvent.log)).limit(1)
  );
  const firstObserved = db.$with("first_observed").as(
    db.select({ timestamp: pairEvent.timestamp }).from(pairEvent)
      .where(eq(pairEvent.kind, "Sync"))
      .orderBy(pairEvent.block, pairEvent.log).limit(1)
  );
  const [sync] = await db.with(latestSync, firstObserved).select({
    historyStart: firstObserved.timestamp,
    hash: latestSync.hash, timestamp: latestSync.timestamp,
    amount0: latestSync.reserve0, amount1: latestSync.reserve1,
    token0: sql<string>`coalesce(sum(${pairEvent.amount0}), 0)::text`,
    token1: sql<string>`coalesce(sum(${pairEvent.amount1}), 0)::text`
  }).from(latestSync).innerJoin(firstObserved, sql`true`).leftJoin(pairEvent, and(
    eq(pairEvent.kind, "Swap"), lte(pairEvent.block, latestSync.block),
    gte(pairEvent.timestamp, sql`${latestSync.timestamp} - 86400`)
  )).groupBy(latestSync.hash, latestSync.timestamp, latestSync.reserve0, latestSync.reserve1, firstObserved.timestamp);
  if (!sync) return c.json({ error: "No Sync observation at this height" }, 404);
  let finality: "unverified" | "finalized" = "unverified";
  if (c.req.query("finality") === "finalized") {
    const verified = await verifyFinality(finalityClient, block, sync.hash);
    if (verified === "unavailable") return c.json({ error: "Finality verification unavailable" }, 503);
    if (verified === "pending") return c.json({ error: "Block is not yet finalized" }, 409);
    if (verified === "orphaned") return c.json({ error: "Indexed block is no longer canonical" }, 409);
    finality = "finalized";
  }

  const completeWindow = sync.timestamp - sync.historyStart >= 86400n;
  const volume = completeWindow ? { token0: sync.token0, token1: sync.token1 } : null;
  const marked = volume && markInToken0(BigInt(volume.token0), BigInt(volume.token1), sync.amount0, sync.amount1);
  const tvl = markInToken0(sync.amount0, sync.amount1, sync.amount0, sync.amount1);
  const grossFeeAprBps = tvl && marked !== null ? marked * 30n * 365n / tvl : null;
  return c.json({
    block: height, hash: sync.hash, timestamp: String(sync.timestamp),
    reserve0: String(sync.amount0), reserve1: String(sync.amount1),
    finality, completeWindow, volume24h: volume, spotTvlToken0: tvl?.toString() ?? null,
    annualizedGrossFeeBps: grossFeeAprBps?.toString() ?? null
  });
});

app.get("/wallet/:address", async (c) => {
  const address = c.req.param("address");
  if (!isAddress(address)) return c.json({ error: "Invalid wallet address" }, 400);
  const wallet = getAddress(address).toLowerCase() as `0x${string}`;
  const rows = await db.select().from(pairEvent)
    .where(and(eq(pairEvent.kind, "Transfer"),
      or(eq(pairEvent.sender, wallet), eq(pairEvent.recipient, wallet))))
    .orderBy(desc(pairEvent.block), desc(pairEvent.log)).limit(50);
  return c.json(rows.map(({ id, block, hash, log, timestamp, amount0, sender, recipient }) => ({
    id, block: String(block), hash, log, timestamp: String(timestamp),
    amount: String(amount0), sender, recipient
  })));
});

app.get("/alerts", async (c) => {
  const minimum = c.req.query("minToken0");
  if (!minimum || !/^\d{1,78}$/.test(minimum)) {
    return c.json({ error: "minToken0 must be an integer in raw token0 units" }, 400);
  }
  const height = c.req.query("height");
  if (!height || !/^\d{1,16}$/.test(height)) {
    return c.json({ error: "height must be a decimal block number" }, 400);
  }
  const end = BigInt(height);
  const start = end > 7199n ? end - 7199n : 0n;
  const threshold = BigInt(minimum);
  if (threshold === 0n || threshold >= 2n ** 256n) return c.json({ error: "Threshold out of range" }, 400);
  const rows = await db.select().from(pairEvent)
    .where(and(eq(pairEvent.kind, "Swap"), gte(pairEvent.amount0, threshold), gte(pairEvent.block, start), lte(pairEvent.block, end)))
    .orderBy(desc(pairEvent.block), desc(pairEvent.log)).limit(25);
  return c.json(rows.map(({ id, block, hash, amount0, amount1 }) => ({
    id, block: String(block), hash, token0In: String(amount0), token1In: String(amount1)
  })));
});

app.get("/lp-holders", async (c) => {
  const rows = await db.select().from(lpBalance)
    .where(gt(lpBalance.balance, 0n))
    .orderBy(desc(lpBalance.balance), desc(lpBalance.wallet)).limit(25);
  return c.json({
    coverage: "indexed-transfer-deltas",
    complete: false,
    holders: rows.map(({ wallet, balance }) => ({ wallet, balance: String(balance) }))
  });
});

export default app;

