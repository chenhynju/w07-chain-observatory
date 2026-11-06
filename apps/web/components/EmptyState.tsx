import type { ReactNode } from "react";

export function EmptyState({
  title,
  children,
  command,
}: {
  title: string;
  children: ReactNode;
  command?: string;
}) {
  return (
    <section className="empty-state">
      <h2>{title}</h2>
      <p>{children}</p>
      {command ? <code>{command}</code> : null}
    </section>
  );
}
