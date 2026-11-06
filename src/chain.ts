import { getAddress, isAddress } from "viem";

export type ChainName = "ethereum" | "base-sepolia" | "ethereum-sepolia";

export interface ChainProfile {
  /** Public profile name used in API metadata and documentation. */
  name: ChainName;
  /** Ponder chain key. Camel case avoids generated registry identifier issues. */
  ponderName: string;
  id: number;
  defaultPair?: `0x${string}`;
  defaultStartBlock: bigint;
  defaultCreationBlock?: bigint;
  explorer?: string;
}

export interface ResolvedRuntime {
  name: ChainName;
  ponderName: string;
  id: number;
  pair: `0x${string}`;
  startBlock: bigint;
  creationBlock?: bigint;
  explorer?: string;
}

export const CHAIN_PROFILES: Record<ChainName, ChainProfile> = {
  ethereum: {
    name: "ethereum",
    ponderName: "ethereum",
    id: 1,
    defaultPair: "0xB4e16d0168e52d35CaCD2c6185b44281Ec28C9Dc",
    defaultStartBlock: 10_008_355n,
    // The default pair creation block is not asserted without chain evidence.
  },
  "base-sepolia": {
    name: "base-sepolia",
    ponderName: "baseSepolia",
    id: 84532,
    defaultStartBlock: 0n,
    explorer: "https://base-sepolia.blockscout.com",
  },
  "ethereum-sepolia": {
    name: "ethereum-sepolia",
    ponderName: "ethereumSepolia",
    id: 11_155_111,
    defaultStartBlock: 0n,
    explorer: "https://eth-sepolia.blockscout.com",
  },
};

function parseBlockNumber(value: string, label: string): bigint {
  if (!/^\d{1,16}$/.test(value)) throw new Error(`${label} must be a decimal block number`);
  const parsed = BigInt(value);
  if (parsed > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error(`${label} exceeds Number.MAX_SAFE_INTEGER`);
  return parsed;
}

/**
 * Resolves the chain, pair and indexing window from environment variables.
 * Pure function: both Ponder config and the HTTP API use the same semantics.
 */
export function resolveRuntime(env: Record<string, string | undefined>): ResolvedRuntime {
  const profile = CHAIN_PROFILES[(env.W07_CHAIN ?? "ethereum") as ChainName];
  if (!profile) {
    throw new Error(`Unsupported W07_CHAIN "${env.W07_CHAIN}". Use ethereum, base-sepolia, or ethereum-sepolia.`);
  }

  const pairRaw = env.PAIR_ADDRESS ?? profile.defaultPair;
  if (!pairRaw) throw new Error(`PAIR_ADDRESS is required for ${profile.name}`);
  if (!isAddress(pairRaw)) throw new Error("PAIR_ADDRESS is not a valid 20-byte address");

  const startBlock = env.START_BLOCK === undefined
    ? profile.defaultStartBlock
    : parseBlockNumber(env.START_BLOCK, "START_BLOCK");

  const creationBlock = env.PAIR_CREATION_BLOCK === undefined
    ? profile.defaultCreationBlock
    : parseBlockNumber(env.PAIR_CREATION_BLOCK, "PAIR_CREATION_BLOCK");

  if (creationBlock !== undefined && startBlock > creationBlock) {
    // Accepted, but the API will disclose that coverage is incomplete.
  }

  return {
    name: profile.name,
    ponderName: profile.ponderName,
    id: profile.id,
    pair: getAddress(pairRaw),
    startBlock,
    creationBlock,
    explorer: profile.explorer,
  };
}
