// Automatic re-checks: a verdict is a snapshot, and a token can be dumped hours
// after it. Every hour (from the radar run) the tokens checked in the last week
// are compared with their value at the check; any that fell by half or more go
// back to the cores, so the verdict and the grade update themselves.
import type { TokenFacts } from "@/lib/token";
import { fetchToken, questionForToken } from "@/lib/token";
import { fellSince, valueNow } from "@/lib/publicApi";

const PER_RUN = 2;
const DAYS = 7;

type Row = { id: number; done_at: number; src: { address: string; symbol: string; facts: TokenFacts } };

export async function recheckDumped(base: string, headers: Record<string, string>) {
  const r = await fetch(`${base}/api/token-checks?limit=100`, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!r.ok) return [];
  const seen = new Set<string>();
  const latest = ((await r.json()) as Row[]).filter(
    (x) => x.src?.address && Date.now() / 1000 - x.done_at < DAYS * 86400 && !seen.has(x.src.address) && seen.add(x.src.address)
  );
  const now = await valueNow(latest.map((x) => x.src.address));
  const dumped = latest
    .map((x) => ({ ...x, fell: fellSince(x.src.facts.fdv, now.get(x.src.address)) ?? 0 }))
    .filter((x) => x.fell >= 0.5 && Date.now() / 1000 - x.done_at > 3600)
    .sort((a, b) => b.fell - a.fell);

  const out: { symbol: string; fell: number; job?: number; error?: string }[] = [];
  for (const x of dumped.slice(0, PER_RUN)) {
    try {
      const t = await fetchToken(x.src.address);
      const a = await fetch(`${base}/api/ask`, {
        method: "POST",
        headers,
        body: JSON.stringify({ q: questionForToken(t), src: { ...t, via: "radar" }, radar: true }),
        signal: AbortSignal.timeout(15000),
      });
      const j = (await a.json()) as { id?: number; error?: string };
      out.push({ symbol: x.src.symbol, fell: Math.round(x.fell * 100), job: j.id, error: j.error });
    } catch (e) {
      out.push({ symbol: x.src.symbol, fell: Math.round(x.fell * 100), error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
