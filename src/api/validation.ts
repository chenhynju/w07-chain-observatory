import { getAddress, isAddress } from "viem";

export type FinalityMode = "unverified" | "finalized";

/** Accepts a decimal block height that fits the database integer range. */
export function parseHeight(value: string | undefined): bigint | null {
  if (!value || !/^\d{1,16}$/.test(value)) return null;
  return BigInt(value);
}

/** Undefined means the default unverified preview; any other value must be "finalized". */
export function parseFinalityMode(value: string | undefined): FinalityMode | null {
  if (value === undefined) return "unverified";
  if (value === "finalized") return "finalized";
  return null;
}

export function parseWallet(value: string | undefined): `0x${string}` | null {
  if (!value || !isAddress(value)) return null;
  return getAddress(value).toLowerCase() as `0x${string}`;
}

/** Raw token amount: positive, decimal, and strictly below 2^256. */
export function parseTokenAmount(value: string | undefined): bigint | null {
  if (!value || !/^\d{1,78}$/.test(value)) return null;
  const parsed = BigInt(value);
  if (parsed === 0n || parsed >= 2n ** 256n) return null;
  return parsed;
}
