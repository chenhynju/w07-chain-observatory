import Link from "next/link";
import { Badge } from "@/components/Badge";
import { formatRaw, shortAddress } from "@/lib/format";
import { indexer } from "@/lib/indexer";

export const dynamic = "force-dynamic";

export default async function HoldersPage() {
  const [metadata, holders] = await Promise.all([indexer.metadata(), indexer.holders()]);

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">LP holder projection</span>
          <h1>
            Positive deltas, <span>explicitly bounded</span>.
          </h1>
          <p>
            Balances are the sum of indexed LP Transfer credits minus debits, excluding the zero
            address and limited to positive projected balances. When coverage starts after pair
            creation, the ranking can omit wallets whose history predates the window.
          </p>
        </div>
        <div className="hero-meta">
          <span>
            coverage <strong>{holders?.complete ? "complete" : "partial"}</strong>
          </span>
          <span>
            reason <strong>{holders?.coverageDetail.reason ?? "unknown"}</strong>
          </span>
          <span>
            start block <strong>{metadata?.startBlock ?? "—"}</strong>
          </span>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Top 25 positive balances</h2>
          <p>Raw LP units</p>
          <Badge tone={holders?.complete ? "good" : "warn"}>
            {holders?.complete ? "complete window" : "partial window"}
          </Badge>
        </div>
        <div className="panel-body">
          {holders === null ? (
            <div className="callout">
              <strong>Indexer unavailable.</strong> The holder projection could not be loaded.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Wallet</th>
                  <th className="num">LP balance</th>
                </tr>
              </thead>
              <tbody>
                {holders.holders.map((holder, index) => (
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
                {!holders.holders.length ? (
                  <tr>
                    <td colSpan={3} className="muted">
                      No positive projected LP balances are indexed.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {holders && !holders.complete ? (
        <div className="callout">
          <strong>Do not treat this as the full cap table.</strong> The configured start block is
          after the recorded pair creation block, so pre-window transfers are missing. Set
          <span className="mono"> PAIR_CREATION_BLOCK</span> only when verified, and re-index from
          pair creation for complete rankings.
        </div>
      ) : null}
    </>
  );
}
