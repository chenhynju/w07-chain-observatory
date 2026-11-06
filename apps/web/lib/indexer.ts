export interface Coverage {
  complete: boolean;
  reason: "pair-creation-not-configured" | "starts-after-pair-creation" | "complete";
  configuredStartBlock: string;
  pairCreationBlock: string | null;
}

export interface Metadata {
  service: string;
  chain: string;
  chainId: number;
  pair: string;
  explorer: string | null;
  startBlock: string;
  pairCreationBlock: string | null;
  coverage: Coverage;
  limits: { rateLimitPerMinute: number; requestTimeoutMs: number; alertsWindowBlocks: number };
  finality: { mode: string; rpcConfigured: boolean };
}

export interface Snapshot {
  block: string;
  hash: string;
  timestamp: string;
  chainId: number;
  pair: string;
  historyStartBlock: string;
  reserve0: string;
  reserve1: string;
  finality: "unverified" | "finalized";
  completeWindow: boolean;
  volume24h: { token0: string; token1: string } | null;
  spotTvlToken0: string | null;
  annualizedGrossFeeBps: string | null;
  coverage: Coverage;
}

export interface SeriesPoint {
  block: string;
  hash: string;
  timestamp: string;
  reserve0: string;
  reserve1: string;
}

export interface Holder {
  wallet: string;
  balance: string;
}

export interface HolderResponse {
  coverage: string;
  complete: boolean;
  coverageDetail: Coverage;
  holders: Holder[];
}

export interface WalletEvent {
  id: string;
  block: string;
  hash: string;
  log: number;
  timestamp: string;
  amount: string;
  sender: string | null;
  recipient: string | null;
}

export interface Alert {
  id: string;
  block: string;
  hash: string;
  token0In: string;
  token1In: string;
}

const INDEXER_URL = process.env.INDEXER_URL ?? "http://127.0.0.1:42069";

async function get<T>(path: string): Promise<T | null> {
  try {
    const response = await fetch(`${INDEXER_URL}${path}`, {
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export const indexer = {
  metadata: () => get<Metadata>("/metadata"),
  latest: () => get<Snapshot>("/latest"),
  series: (from: string, to: string, limit = 200) =>
    get<SeriesPoint[]>(`/series?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&limit=${limit}`),
  holders: () => get<HolderResponse>("/lp-holders"),
  wallet: (address: string) => get<WalletEvent[]>(`/wallet/${encodeURIComponent(address)}`),
  alerts: (minToken0: string, height: string) =>
    get<Alert[]>(`/alerts?minToken0=${encodeURIComponent(minToken0)}&height=${encodeURIComponent(height)}`),
};

export function indexerUrl(): string {
  return INDEXER_URL;
}
