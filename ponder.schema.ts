import { index, onchainTable } from "ponder";

export const pairEvent = onchainTable("pair_event", (p) => ({
  id: p.text().primaryKey(),
  kind: p.text().notNull(),
  block: p.bigint().notNull(),
  hash: p.hex().notNull(),
  log: p.integer().notNull(),
  timestamp: p.bigint().notNull(),
  amount0: p.bigint().notNull(),
  amount1: p.bigint().notNull(),
  sender: p.hex(),
  recipient: p.hex()
}), (t) => ({ byBlock: index().on(t.kind, t.block, t.log), byTime: index().on(t.kind, t.timestamp),
  bySender: index().on(t.kind, t.sender, t.block, t.log),
  byRecipient: index().on(t.kind, t.recipient, t.block, t.log) }));


export const lpBalance = onchainTable("lp_balance", (p) => ({
  wallet: p.hex().primaryKey(),
  balance: p.bigint().notNull()
}), (t) => ({ byBalance: index().on(t.balance, t.wallet) }));
