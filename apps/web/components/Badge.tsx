import type { ReactNode } from "react";

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}
