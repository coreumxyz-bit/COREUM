// Client-safe helpers (no server imports).
export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

export function timeUntil(dl: number): string {
  const m = Math.max(1, Math.ceil((dl - Date.now() / 1000) / 60));
  return m >= 60 ? `${(m / 60).toFixed(1)}h` : `${m}m`;
}
