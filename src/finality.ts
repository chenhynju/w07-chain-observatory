import type { PublicClient } from "viem";

/** Checks canonicality against the configured trusted RPC, failing closed. */
export async function verifyFinality(
  client: Pick<PublicClient, "getBlock"> | undefined,
  height: bigint,
  hash: string,
): Promise<"finalized" | "pending" | "orphaned" | "unavailable"> {
  if (!client) return "unavailable";
  try {
    const finalized = await client.getBlock({ blockTag: "finalized", includeTransactions: false });
    if (typeof finalized.number !== "bigint" || !/^0x[0-9a-f]{64}$/i.test(finalized.hash ?? "")) return "unavailable";
    if (finalized.number < height) return "pending";
    const canonical = finalized.number === height
      ? finalized
      : await client.getBlock({ blockNumber: height, includeTransactions: false });
    if (canonical.number !== height || !/^0x[0-9a-f]{64}$/i.test(canonical.hash ?? "")) return "unavailable";
    return canonical.hash.toLowerCase() === hash.toLowerCase() ? "finalized" : "orphaned";
  } catch {
    return "unavailable";
  }
}
