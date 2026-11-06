import assert from "node:assert/strict";
import test from "node:test";
import { resolveRuntime } from "../src/chain.ts";
import { describeCoverage } from "../src/api/coverage.ts";
import { createFixedWindowRateLimiter } from "../src/api/rate-limit.ts";
import { withTimeout } from "../src/api/timeout.ts";
import { parseFinalityMode, parseHeight, parseTokenAmount, parseWallet } from "../src/api/validation.ts";

const testPair = "0x1000000000000000000000000000000000000001";

test("chain resolution defaults to the Ethereum USDC/WETH pair", () => {
  const runtime = resolveRuntime({});
  assert.equal(runtime.name, "ethereum");
  assert.equal(runtime.id, 1);
  assert.equal(runtime.pair.toLowerCase(), "0xb4e16d0168e52d35cacd2c6185b44281ec28c9dc");
  assert.equal(runtime.startBlock, 10_008_355n);
  assert.equal(runtime.creationBlock, undefined);
});

test("chain resolution accepts a testnet profile and explicit indexing window", () => {
  const runtime = resolveRuntime({
    W07_CHAIN: "base-sepolia",
    PAIR_ADDRESS: testPair,
    START_BLOCK: "123",
    PAIR_CREATION_BLOCK: "120",
  });
  assert.equal(runtime.name, "base-sepolia");
  assert.equal(runtime.id, 84532);
  assert.equal(runtime.ponderName, "baseSepolia");
  assert.equal(runtime.startBlock, 123n);
  assert.equal(runtime.creationBlock, 120n);
});

test("chain resolution rejects unsupported names, missing pair and malformed heights", () => {
  assert.throws(() => resolveRuntime({ W07_CHAIN: "mainnet" }), /Unsupported W07_CHAIN/);
  assert.throws(() => resolveRuntime({ W07_CHAIN: "base-sepolia" }), /PAIR_ADDRESS is required/);
  assert.throws(() => resolveRuntime({ W07_CHAIN: "base-sepolia", PAIR_ADDRESS: "0x123" }), /not a valid/);
  assert.throws(() => resolveRuntime({ START_BLOCK: "1e6" }), /START_BLOCK/);
  assert.throws(() => resolveRuntime({ PAIR_CREATION_BLOCK: "-1" }), /PAIR_CREATION_BLOCK/);
});

test("height, finality, wallet and token amount validation reject ambiguous input", () => {
  assert.equal(parseHeight("0"), 0n);
  assert.equal(parseHeight("123"), 123n);
  assert.equal(parseHeight("12345678901234567"), null);
  assert.equal(parseHeight("1e3"), null);

  assert.equal(parseFinalityMode(undefined), "unverified");
  assert.equal(parseFinalityMode("finalized"), "finalized");
  assert.equal(parseFinalityMode("latest"), null);

  assert.equal(parseWallet(testPair), testPair);
  assert.equal(parseWallet("0x123"), null);

  assert.equal(parseTokenAmount("1"), 1n);
  assert.equal(parseTokenAmount("0"), null);
  assert.equal(parseTokenAmount((2n ** 256n).toString()), null);
  assert.equal(parseTokenAmount("12.5"), null);
});

test("coverage is complete only when indexing starts at or before pair creation", () => {
  assert.deepEqual(describeCoverage(100n, 100n), {
    complete: true,
    reason: "complete",
    configuredStartBlock: "100",
    pairCreationBlock: "100",
  });
  assert.equal(describeCoverage(101n, 100n).complete, false);
  assert.equal(describeCoverage(101n, 100n).reason, "starts-after-pair-creation");
  assert.equal(describeCoverage(100n, undefined).reason, "pair-creation-not-configured");
});

test("fixed-window rate limiter denies the request after the configured budget", () => {
  let clock = 1_000;
  const check = createFixedWindowRateLimiter({ limit: 2, windowMs: 60_000, now: () => clock });
  const first = check("a");
  assert.equal(first.allowed, true);
  assert.equal(first.remaining, 1);
  const second = check("a");
  assert.equal(second.allowed, true);
  assert.equal(second.remaining, 0);
  const denied = check("a");
  assert.equal(denied.allowed, false);
  assert.equal(denied.retryAfterSeconds, 60);
  clock += 60_000;
  assert.equal(check("a").allowed, true);
  assert.throws(() => createFixedWindowRateLimiter({ limit: 0, windowMs: 10 }), /limit/);
});

test("response timeout resolves fast work and rejects work beyond the deadline", async () => {
  assert.equal(await withTimeout(Promise.resolve(7), 100), 7);
  await assert.rejects(
    withTimeout(new Promise((resolve) => setTimeout(() => resolve(1), 50)), 5),
    /Request timeout/,
  );
  await assert.rejects(withTimeout(Promise.resolve(1), 0), /timeoutMs/);
});
