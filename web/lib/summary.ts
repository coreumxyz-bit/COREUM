// Ready-to-publish UTC-day summary of settled calls, built from the same
// public API everything else uses. Shared by the daily_summary MCP tool and
// GET /api/daily — a future X/Telegram bot can post the text verbatim.
import { api } from "./api";

type FeedRow = {
  id: number; aname: string; sym: string; dir: number; conf: number;
  st: string; p0: number; p1: number | null; dl: number;
};

type LedgerRow = { i: number; hash: string };

export type DaySummary = {
  date: string; // UTC YYYY-MM-DD
  settled: number;
  hits: number;
  bySym: { sym: string; n: number; h: number }[];
  examples: FeedRow[];
  head: { i: number; hash: string } | null;
  text: string;
};

const pct = (h: number, n: number) => (n ? ((h / n) * 100).toFixed(1) + "%" : "—");

const px = (x: number | null) =>
  x == null ? "—" : x.toLocaleString("en-US", { maximumFractionDigits: 4 });

export async function dailySummary(dayMsAgo = 86_400): Promise<DaySummary> {
  // Canonical source first: the digest the Worker actually posted for the
  // completed UTC day (daily_posts). Falls back to a rolling computation
  // from the public feed when no digest exists yet.
  try {
    const rows = await api<{ d: string; text: string }[]>("/api/daily_posts?limit=1");
    if (rows[0]?.text)
      return {
        date: rows[0].d, settled: 0, hits: 0, bySym: [], examples: [],
        head: null, text: rows[0].text,
      };
  } catch {}

  const since = Math.floor(Date.now() / 1000) - dayMsAgo;
  const until = since + 86_400;
  const date = new Date(since * 1000).toISOString().slice(0, 10);

  const [feed, head] = await Promise.all([
    api<FeedRow[]>("/api/feed?limit=100"),
    api<LedgerRow[]>("/api/ledger?limit=1"),
  ]);

  const settled = feed.filter(
    (r) => r.st !== "open" && r.dl > since && r.dl <= until
  );
  const hits = settled.filter((r) => r.st === "hit").length;

  const symMap = new Map<string, { n: number; h: number }>();
  for (const r of settled) {
    const e = symMap.get(r.sym) ?? { n: 0, h: 0 };
    e.n++;
    if (r.st === "hit") e.h++;
    symMap.set(r.sym, e);
  }
  const bySym = [...symMap.entries()]
    .map(([sym, v]) => ({ sym, ...v }))
    .sort((a, b) => b.n - a.n);

  const examples = settled.slice(0, 5);
  const h = head[0] ?? null;

  const lines = [
    `Coreum daily — ${date} UTC`,
    settled.length
      ? `${settled.length} calls settled · ${hits} hit (${pct(hits, settled.length)})`
      : "No calls settled in this window.",
    bySym.length
      ? bySym.map((s) => `${s.sym} ${s.h}/${s.n}`).join(" · ")
      : null,
    examples.length
      ? "Latest calls:\n" +
        examples
          .map(
            (r) =>
              `  ${r.aname}: ${r.sym} ${r.dir === 1 ? "↑" : "↓"}${r.conf}% — ` +
              `${px(r.p0)} → ${px(r.p1)} ${r.st === "hit" ? "HIT" : "MISS"}`
          )
          .join("\n")
      : null,
    h ? `chain head #${h.i} ${h.hash.slice(0, 16)}…` : null,
    "verify: https://www.coreum.xyz/ledger",
  ].filter(Boolean);

  return { date, settled: settled.length, hits, bySym, examples, head: h, text: lines.join("\n") };
}
