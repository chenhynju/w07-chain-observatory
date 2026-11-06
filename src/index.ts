import { ponder } from "ponder:registry";
import { zeroAddress } from "viem";
import { lpBalance, pairEvent } from "../ponder.schema";
import { swapInputs } from "./math";

ponder.on("Pair:Swap", async ({ event, context }) => {
  const [amount0, amount1] = swapInputs(event.args);
  await context.db.insert(pairEvent).values({
    id: `${event.block.hash}:${event.log.logIndex}`, kind: "Swap", block: event.block.number, hash: event.block.hash,
    log: event.log.logIndex, timestamp: event.block.timestamp,
    amount0, amount1, sender: event.args.sender, recipient: event.args.to
  });
});

ponder.on("Pair:Sync", async ({ event, context }) => {
  await context.db.insert(pairEvent).values({
    id: `${event.block.hash}:${event.log.logIndex}`, kind: "Sync", block: event.block.number, hash: event.block.hash,
    log: event.log.logIndex, timestamp: event.block.timestamp,
    amount0: event.args.reserve0, amount1: event.args.reserve1
  });
});

ponder.on("Pair:Mint", async ({ event, context }) => {
  await context.db.insert(pairEvent).values({
    id: `${event.block.hash}:${event.log.logIndex}`, kind: "Mint", block: event.block.number, hash: event.block.hash,
    log: event.log.logIndex, timestamp: event.block.timestamp,
    amount0: event.args.amount0, amount1: event.args.amount1, sender: event.args.sender
  });
});

ponder.on("Pair:Burn", async ({ event, context }) => {
  await context.db.insert(pairEvent).values({
    id: `${event.block.hash}:${event.log.logIndex}`, kind: "Burn", block: event.block.number, hash: event.block.hash,
    log: event.log.logIndex, timestamp: event.block.timestamp,
    amount0: event.args.amount0, amount1: event.args.amount1, sender: event.args.sender, recipient: event.args.to
  });
});

ponder.on("Pair:Transfer", async ({ event, context }) => {
  await context.db.insert(pairEvent).values({
    id: `${event.block.hash}:${event.log.logIndex}`, kind: "Transfer", block: event.block.number, hash: event.block.hash,
    log: event.log.logIndex, timestamp: event.block.timestamp,
    amount0: event.args.value, amount1: 0n, sender: event.args.from, recipient: event.args.to
  });
  const { from, to, value } = event.args;
  if (from === to || value === 0n) return;
  for (const [wallet, delta] of [[from, -value], [to, value]] as const) {
    if (wallet === zeroAddress) continue;
    await context.db.insert(lpBalance).values({ wallet, balance: delta })
      .onConflictDoUpdate((row) => ({ balance: row.balance + delta }));
  }
});

