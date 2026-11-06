import type { SeriesPoint } from "@/lib/indexer";
import { formatRaw } from "@/lib/format";

export function Sparkline({ points }: { points: SeriesPoint[] }) {
  if (points.length < 2) {
    return (
      <div className="chart-empty">
        At least two Sync observations are required to draw reserves. Keep the indexer running
        and emit another swap or liquidity event.
      </div>
    );
  }

  const width = 920;
  const height = 260;
  const pad = 26;
  const token0 = points.map((point) => Number(BigInt(point.reserve0)));
  const token1 = points.map((point) => Number(BigInt(point.reserve1)));
  const max = Math.max(...token0, ...token1, 1);
  const min = Math.min(...token0, ...token1, 0);
  const span = max - min || 1;
  const x = (index: number) => pad + (index / (points.length - 1)) * (width - pad * 2);
  const y = (value: number) => height - pad - ((value - min) / span) * (height - pad * 2);
  const line = (values: number[]) =>
    values.map((value, index) => `${index === 0 ? "M" : "L"}${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
  const area = `${line(token0)} L${x(points.length - 1).toFixed(1)},${height - pad} L${x(0).toFixed(1)},${height - pad} Z`;

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Pool reserves over indexed Sync observations">
        <defs>
          <linearGradient id="reserveFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#5ee7c2" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#5ee7c2" stopOpacity="0" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((fraction) => (
          <line
            key={fraction}
            x1={pad}
            x2={width - pad}
            y1={pad + fraction * (height - pad * 2)}
            y2={pad + fraction * (height - pad * 2)}
            stroke="rgba(120, 180, 255, 0.12)"
            strokeDasharray="4 6"
          />
        ))}
        <path d={area} fill="url(#reserveFill)" />
        <path d={line(token0)} fill="none" stroke="#5ee7c2" strokeWidth="2.5" strokeLinejoin="round" />
        <path d={line(token1)} fill="none" stroke="#7aa7ff" strokeWidth="2" strokeLinejoin="round" strokeDasharray="5 5" />
      </svg>
      <div className="chart-legend">
        <span className="legend-token0">reserve0 · {formatRaw(points.at(-1)?.reserve0)}</span>
        <span className="legend-token1">reserve1 · {formatRaw(points.at(-1)?.reserve1)}</span>
        <span className="legend-range">
          blocks {points[0].block} → {points.at(-1)?.block}
        </span>
      </div>
    </div>
  );
}
