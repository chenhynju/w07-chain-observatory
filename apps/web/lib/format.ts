export function formatRaw(value: string | null | undefined, decimals = 18, maxFraction = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const negative = value.startsWith("-");
  const raw = negative ? value.slice(1) : value;
  if (!/^\d+$/.test(raw)) return "—";
  const padded = raw.padStart(decimals + 1, "0");
  const whole = padded.slice(0, -decimals).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const fraction = padded.slice(-decimals).slice(0, maxFraction).replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export function formatBps(value: string | null | undefined): string {
  if (value === null || value === undefined || !/^\d+$/.test(value)) return "—";
  const bps = BigInt(value);
  const whole = bps / 100n;
  const fraction = (bps % 100n).toString().padStart(2, "0");
  return `${whole.toString()}.${fraction}%`;
}

export function shortAddress(value: string | null | undefined): string {
  if (!value || value.length < 12) return value ?? "—";
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function formatTimestamp(value: string | null | undefined): string {
  if (!value || !/^\d+$/.test(value)) return "—";
  const date = new Date(Number(value) * 1_000);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export function formatBlock(value: string | null | undefined): string {
  if (!value || !/^\d+$/.test(value)) return "—";
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
