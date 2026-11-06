import { Badge } from "@/components/Badge";
import { formatBlock, formatRaw, shortAddress } from "@/lib/format";
import { indexer } from "@/lib/indexer";

export const dynamic = "force-dynamic";

export default async function AlertsPage({
  searchParams,
}: {
  searchParams: Promise<{ height?: string; minToken0?: string }>;
}) {
  const params = await searchParams;
  const metadata = await indexer.metadata();
  const latest = metadata ? await indexer.latest() : null;
  const height = params.height ?? latest?.block ?? "";
  const minToken0 = params.minToken0 ?? "1";
  const validHeight = /^\d{1,16}$/.test(height);
  const validMinimum = /^\d{1,78}$/.test(minToken0) && minToken0 !== "0";
  const alerts =
    validHeight && validMinimum ? await indexer.alerts(minToken0, height) : null;

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">Large swap monitor</span>
          <h1>
            Surface <span>size</span> without hiding the window.
          </h1>
          <p>
            The alert feed scans at most 7,200 blocks ending at the requested height and returns up
            to 25 swaps whose token0 input meets the raw-unit threshold. It does not dispatch
            notifications and is not finality-filtered.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Query window</h2>
          <p>Raw token0 input threshold</p>
          <Badge tone="neutral">{metadata?.limits.alertsWindowBlocks ?? 7200} block cap</Badge>
        </div>
        <div className="panel-body">
          <form className="search-form" method="get" action="/alerts">
            <div className="field">
              <label htmlFor="height">End height</label>
              <input
                id="height"
                name="height"
                defaultValue={height}
                pattern="[0-9]{1,16}"
                placeholder={latest?.block ?? "1"}
              />
            </div>
            <div className="field">
              <label htmlFor="minToken0">Minimum raw token0 input</label>
              <input
                id="minToken0"
                name="minToken0"
                defaultValue={minToken0}
                pattern="[0-9]{1,78}"
                placeholder="1"
              />
            </div>
            <button className="button" type="submit">
              Run scan
            </button>
          </form>
          {!validHeight || !validMinimum ? (
            <div className="callout">
              <strong>Invalid query.</strong> The height must be decimal and the threshold must be a
              positive integer below 2^256.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel" style={{ marginTop: 16 }}>
        <div className="panel-head">
          <h2>Matching swaps</h2>
          <p>
            Heights {validHeight ? formatBlock((BigInt(height) - 7_199n > 0n ? BigInt(height) - 7_199n : 0n).toString()) : "—"} →{" "}
            {validHeight ? formatBlock(height) : "—"}
          </p>
          <Badge tone="neutral">{alerts?.length ?? 0} rows</Badge>
        </div>
        <div className="panel-body">
          {alerts === null ? (
            <div className="callout">
              <strong>No result.</strong> The indexer is unreachable or the query is invalid.
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Block</th>
                  <th className="num">token0 in</th>
                  <th className="num">token1 in</th>
                  <th>Block hash</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((alert) => (
                  <tr key={alert.id}>
                    <td>{formatBlock(alert.block)}</td>
                    <td className="num">{formatRaw(alert.token0In)}</td>
                    <td className="num">{formatRaw(alert.token1In)}</td>
                    <td>{shortAddress(alert.hash)}</td>
                  </tr>
                ))}
                {!alerts.length ? (
                  <tr>
                    <td colSpan={4} className="muted">
                      No swaps meet the threshold in this window.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </>
  );
}
