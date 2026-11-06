import Link from "next/link";
import { Badge } from "@/components/Badge";
import { formatBlock, formatRaw, formatTimestamp, shortAddress } from "@/lib/format";
import { indexer } from "@/lib/indexer";

export const dynamic = "force-dynamic";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;

export default async function WalletPage({
  searchParams,
}: {
  searchParams: Promise<{ address?: string }>;
}) {
  const { address } = await searchParams;
  const valid = Boolean(address && ADDRESS_RE.test(address));
  const [metadata, events] = await Promise.all([
    indexer.metadata(),
    valid && address ? indexer.wallet(address) : Promise.resolve(null),
  ]);

  return (
    <>
      <section className="hero">
        <div>
          <span className="eyebrow">LP transfer history</span>
          <h1>
            Follow a wallet’s <span>liquidity footprint</span>.
          </h1>
          <p>
            The endpoint returns the latest 50 indexed LP Transfer events for one address. It is a
            history view, not a complete balance statement; use the holders page for projected
            positive balances.
          </p>
        </div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2>Lookup</h2>
          <p>20-byte EVM address</p>
          {address ? <Badge tone={valid ? "good" : "bad"}>{valid ? "valid address" : "invalid address"}</Badge> : null}
        </div>
        <div className="panel-body">
          <form className="search-form" method="get" action="/wallet">
            <div className="field">
              <label htmlFor="address">Wallet address</label>
              <input
                id="address"
                name="address"
                defaultValue={address ?? ""}
                placeholder="0x0000000000000000000000000000000000000011"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <button className="button" type="submit">
              Load history
            </button>
          </form>
          {address && !valid ? (
            <div className="callout">
              <strong>Invalid address.</strong> Enter exactly 20 bytes in hexadecimal form.
            </div>
          ) : null}
        </div>
      </section>

      {valid && address ? (
        <section className="panel" style={{ marginTop: 16 }}>
          <div className="panel-head">
            <h2>Transfer events</h2>
            <p>{shortAddress(address)}</p>
            <Badge tone="neutral">{events?.length ?? 0} rows</Badge>
          </div>
          <div className="panel-body">
            {events === null ? (
              <div className="callout">
                <strong>Indexer unavailable.</strong> The request failed or timed out.
              </div>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Block</th>
                    <th>Time</th>
                    <th className="num">Amount</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Tx</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event) => (
                    <tr key={event.id}>
                      <td>{formatBlock(event.block)}</td>
                      <td>{formatTimestamp(event.timestamp)}</td>
                      <td className="num">{formatRaw(event.amount)}</td>
                      <td>
                        {event.sender ? (
                          <Link className="link" href={`/wallet?address=${event.sender}`}>
                            {shortAddress(event.sender)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {event.recipient ? (
                          <Link className="link" href={`/wallet?address=${event.recipient}`}>
                            {shortAddress(event.recipient)}
                          </Link>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>
                        {metadata?.explorer ? (
                          <a
                            className="link"
                            href={`${metadata.explorer}/tx/${event.hash}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            {shortAddress(event.hash)}
                          </a>
                        ) : (
                          shortAddress(event.hash)
                        )}
                      </td>
                    </tr>
                  ))}
                  {!events.length ? (
                    <tr>
                      <td colSpan={6} className="muted">
                        No indexed LP transfers involve this address.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            )}
          </div>
        </section>
      ) : null}
    </>
  );
}
