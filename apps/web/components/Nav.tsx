import Link from "next/link";

export function Nav({ chain }: { chain?: string }) {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        <span className="brand-mark" aria-hidden="true">
          <span />
          <span />
          <span />
        </span>
        <span>
          <strong>Chain Observatory</strong>
          <small>W07 · on-chain analytics</small>
        </span>
      </Link>
      <nav className="nav-links" aria-label="Primary">
        <Link href="/">Overview</Link>
        <Link href="/holders">LP holders</Link>
        <Link href="/alerts">Large swaps</Link>
        <Link href="/wallet">Wallet</Link>
      </nav>
      {chain ? <span className="chain-pill">{chain}</span> : null}
    </header>
  );
}
