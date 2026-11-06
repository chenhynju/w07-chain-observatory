import type { Metadata } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: "W07 Chain Observatory",
  description: "Block-addressable Uniswap V2 reserve and swap analytics indexed with Ponder.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <div className="page-shell">
          <Nav />
          <main>{children}</main>
          <footer className="site-footer">
            <span>
              W07 Chain Observatory · Ponder + PostgreSQL + Next.js. Raw token units and
              pool-implied marks; gross fee estimates are not realized LP yield.
            </span>
            <span className="mono">AI-assisted portfolio project</span>
          </footer>
        </div>
      </body>
    </html>
  );
}
