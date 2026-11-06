import Link from "next/link";
import { Badge } from "@/components/Badge";
import { EmptyState } from "@/components/EmptyState";
import { MetricCard } from "@/components/MetricCard";
import { Sparkline } from "@/components/Sparkline";
import { formatBps, formatBlock, formatRaw, formatTimestamp, shortAddress } from "@/lib/format";
import { indexer, indexerUrl } from "@/lib/indexer";

export const dynamic = "force-dynamic";

export default async function OverviewPage() {
  const metadata = await indexer.metadata();
  if (!metadata) {
    return (
      <EmptyState
        title="Indexer is offline"
        command={`INDEXER_URL=${indexerUrl()} npm run dev`}
      >
        The dashboard could not reach the W07 HTTP API. Start the Ponder indexer, wait for
        <code> /ready</code>, then reload this page. No placeholder metrics are shown.
      </EmptyState>
    );
  }

  const latest = await indexer.latest();
  if (!latest) {
    return (
      <>
        <section className="hero">
          <div>
            <span className="eyebrow">On-chain analytics · block-addressable</span>
            <h1>
              Waiting for the first <span>Sync</span>.
            </h1>
            <p>
              The indexer is reachable on {metadata.chain}, but no Sync observation has been
              indexed yet. Emit a swap or liquidity event at or after block {formatBlock(metadata.startBlock)}.
            </p>
          </div>
        </section>
        <div className="callout">
          <strong>Coverage is explicit.</strong> {metadata.coverage.complete
            ? "The configured start block is at or before pair creation."
            : "The configured window may miss events before the start block."}
        </div>
      </>
    );
  }

  const [series, holders, alerts] = await Promise.all([
    indexer.series(metadata.startBlock, latest.block, 200),
    indexer.holders(),
    indexer.alerts("1", latest.block),
  ]);

  const explorerLink = metadata.explorer ? `${metadata.explorer}/address/${metadata.pair}` : null;
  const volumeHint = latest.completeWindow
    ? "Trailing 86,400 seconds; swaps after the selected Sync log are excluded."
    : "The 24-hour window is incomplete, so volume and APR are null on purpose.";

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">On-chain analytics · block-addressable</span>
          <h1>
            Reserve truth at a <span>specific block</span>.
          </h1>
          <p>
            A Uniswap V2 pair indexer that stores every Sync, Swap, Mint, Burn and LP Transfer,
            then answers reserve, volume, finality and holder questions without hiding its
            coverage window.
          </p>
        </div>
        <div className="hero-meta">
          <span>
            chain <strong>{metadata.chain}</strong> · id <strong>{metadata.chainId}</strong>
          </span>
          <span>
            pair <strong>{shortAddress(metadata.pair)}</strong>
          </span>
          <span>
            latest block <strong>{formatBlock(latest.block)}</strong>
          </span>
          <span>{formatTimestamp(latest.timestamp)}</span>
          <div>
            <Badge tone={latest.finality === "finalized" ? "good" : "neutral"}>
              {latest.finality}
            </Badge>{" "}
            <Badge tone={latest.coverage.complete ? "good" : "warn"}>
              {latest.coverage.complete ? "full coverage" : "partial coverage"}
            </Badge>
          </div>
        </div>
      </section>

      <section className="metric-grid" aria-label="Latest pool metrics">
        <MetricCard
          label="Spot TVL · token0"
          value={formatRaw(latest.spotTvlToken0)}
          hint="Pool-implied mark at the latest Sync; manipulable spot ratio, not an oracle."
          tone="accent"
        />
        <MetricCard
          label="24h input volume · token0"
          value={latest.volume24h ? formatRaw(latest.volume24h.token0) : "—"}
          hint={volumeHint}
        />
        <MetricCard
          label="Gross fee APR"
          value={latest.annualizedGrossFeeBps ? formatBps(latest.annualizedGrossFeeBps) : "—"}
          hint="30 bps per swap, annualized from marked volume / TVL. Not realized LP yield."
          tone="warn"
        />
        <MetricCard
          label="Indexed LP holders"
          value={holders ? holders.holders.length.toString() : "—"}
          hint={holders?.complete ? "Coverage starts at pair creation." : "Coverage may miss pre-start transfers."}
        />
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Reserves over indexed Sync observations</h2>
          <p>Raw reserve0 and reserve1, latest 200 points</p>
          <Badge tone="neutral">{series?.length ?? 0} points</Badge>
        </div>
        <div className="panel-body">
          <Sparkline points={series ?? []} />
        </div>
      </section>

      <div className="split">
        <section className="panel">
          <div className="panel-head">
            <h2>Latest snapshot</h2>
            <p>Anchored to the last Sync at this block</p>
          </div>
          <div className="panel-body">
            <dl className="detail-list">
              <div className="detail-row">
                <dt>Block / hash</dt>
                <dd>
                  {formatBlock(latest.block)} · {shortAddress(latest.hash)}
                </dd>
              </div>
              <div className="detail-row">
                <dt>reserve0</dt>
                <dd>{formatRaw(latest.reserve0)}</dd>
              </div>
              <div className="detail-row">
                <dt>reserve1</dt>
                <dd>{formatRaw(latest.reserve1)}</dd>
              </div>
              <div className="detail-row">
                <dt>TVL token0</dt>
                <dd>{formatRaw(latest.spotTvlToken0)}</dd>
              </div>
              <div className="detail-row">
                <dt>24h volume token0</dt>
                <dd>{latest.volume24h ? formatRaw(latest.volume24h.token0) : "incomplete window"}</dd>
              </div>
              <div className="detail-row">
                <dt>Gross fee APR</dt>
                <dd>{latest.annualizedGrossFeeBps ? formatBps(latest.annualizedGrossFeeBps) : "—"}</dd>
              </div>
              <div className="detail-row">
                <dt>Pair</dt>
                <dd>
                  {explorerLink ? (
                    <a className="link" href={explorerLink} target="_blank" rel="noreferrer">
                      {shortAddress(metadata.pair)}
                    </a>
                  ) : (
                    shortAddress(metadata.pair)
                  )}
                </dd>
              </div>
            </dl>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Indexing window</h2>
            <p>What the numbers do and do not cover</p>
          </div>
          <div className="panel-body">
            <dl className="detail-list">
              <div className="detail-row">
                <dt>Configured start</dt>
                <dd>{formatBlock(metadata.startBlock)}</dd>
              </div>
              <div className="detail-row">
                <dt>Pair creation</dt>
                <dd>{metadata.pairCreationBlock ? formatBlock(metadata.pairCreationBlock) : "not asserted"}</dd>
              </div>
              <div className="detail-row">
                <dt>Coverage reason</dt>
                <dd>{metadata.coverage.reason}</dd>
              </div>
              <div className="detail-row">
                <dt>Finality source</dt>
                <dd>{metadata.finality.rpcConfigured ? "configured RPC" : "unavailable"}</dd>
              </div>
              <div className="detail-row">
                <dt>Alert scan window</dt>
                <dd>{metadata.limits.alertsWindowBlocks} blocks</dd>
              </div>
              <div className="detail-row">
                <dt>Rate limit</dt>
                <dd>{metadata.limits.rateLimitPerMinute} req/min</dd>
              </div>
            </dl>
            <div className="callout">
              <strong>Read the coverage label.</strong> A finalized block hash does not prove that
              all historical logs were indexed. Snapshot reserves are spot values; volume is a
              trailing window with the post-Sync boundary enforced.
            </div>
          </div>
        </section>
      </div>

      <div className="split">
        <section className="panel">
          <div className="panel-head">
            <h2>LP holders</h2>
            <p>Top positive indexed deltas</p>
            <Link className="badge" href="/holders">
              View all
            </Link>
          </div>
          <div className="panel-body">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Wallet</th>
                  <th className="num">LP balance</th>
                </tr>
              </thead>
              <tbody>
                {holders?.holders.slice(0, 6).map((holder, index) => (
                  <tr key={holder.wallet}>
                    <td>{index + 1}</td>
                    <td>
                      <Link className="link" href={`/wallet?address=${holder.wallet}`}>
                        {shortAddress(holder.wallet)}
                      </Link>
                    </td>
                    <td className="num">{formatRaw(holder.balance)}</td>
                  </tr>
                ))}
                {!holders?.holders.length ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No positive LP balances indexed yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <h2>Large token0 swaps</h2>
            <p>Last 7,200 blocks</p>
            <Link className="badge" href="/alerts">
              Open feed
            </Link>
          </div>
          <div className="panel-body">
            <table>
              <thead>
                <tr>
                  <th>Block</th>
                  <th className="num">token0 in</th>
                  <th className="num">token1 in</th>
                </tr>
              </thead>
              <tbody>
                {alerts?.slice(0, 6).map((alert) => (
                  <tr key={alert.id}>
                    <td>{formatBlock(alert.block)}</td>
                    <td className="num">{formatRaw(alert.token0In)}</td>
                    <td className="num">{formatRaw(alert.token1In)}</td>
                  </tr>
                ))}
                {!alerts?.length ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No swaps above the minimum in this window.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </>
  );
}
