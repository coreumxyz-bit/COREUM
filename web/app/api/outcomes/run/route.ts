import { connection } from "next/server";

// Hourly (the Worker cron calls it): what became of every checked token 24 hours
// and 7 days after its first check. One GeckoTerminal "multi" call per 30 tokens
// reads value, liquidity and graduation; each token gets a label, and the Worker
// keeps it. These labels are the training data for a rug-risk model.
export const maxDuration = 60;

const GT = "https://api.geckoterminal.com/api/v2/networks/robinhood";
const H = { "24h": 86400, "7d": 7 * 86400 } as const;
type Due = { address: string; job: number; horizon: keyof typeof H; checked_at: number; verdict: string; agree: number; fdv0: number | null; liq0: number | null; grad0: boolean | null; facts: unknown };
type Now = { fdv: number | null; liquidity: number | null; graduated: boolean | null };

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function multi(addresses: string[]) {
  const out = new Map<string, Now>();
  for (let i = 0; i < addresses.length; i += 30) {
    const r = await fetch(`${GT}/tokens/multi/${addresses.slice(i, i + 30).join(",")}`, {
      headers: { accept: "application/json;version=20230302" },
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
    if (!r.ok) break; // rate-limited: the rest wait for the next hour
    const j = (await r.json()) as { data?: { attributes: Record<string, unknown> }[] };
    for (const d of j.data ?? []) {
      const a = d.attributes;
      const lp = a.launchpad_details as { completed?: boolean } | null;
      out.set(String(a.address).toLowerCase(), { fdv: num(a.fdv_usd), liquidity: num(a.total_reserve_in_usd), graduated: lp ? !!lp.completed : null });
    }
    if (i + 30 < addresses.length) await sleep(2500);
  }
  return out;
}

// dead and dumped first: a token that graduated and then crashed is a crash
function label(o: Due, n: Now) {
  const change = o.fdv0 && n.fdv != null ? (n.fdv / o.fdv0 - 1) * 100 : null;
  if ((n.liquidity != null && n.liquidity < 100) || (change != null && change <= -90)) return { label: "dead", change };
  if (change != null && change <= -50) return { label: "dumped", change };
  if (n.graduated && !o.grad0) return { label: "graduated", change };
  if (change != null && change >= 100) return { label: "up", change };
  return { label: "flat", change };
}

export async function POST(req: Request) {
  await connection();
  const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
  const headers = { "content-type": "application/json", "x-coreum-secret": process.env.COREUM_SITE_SECRET ?? "", "x-coreum-admin": req.headers.get("x-coreum-admin") ?? "" };
  const d = await fetch(`${base}/api/outcomes/due?limit=60`, { headers, cache: "no-store", signal: AbortSignal.timeout(15000) });
  if (!d.ok) return Response.json({ error: "forbidden" }, { status: 403 });
  const due = (await d.json()) as Due[];
  if (!due.length) return Response.json({ due: 0 });

  const now = await multi([...new Set(due.map((o) => o.address))]);
  const t = Math.floor(Date.now() / 1000);
  const out = [];
  for (const o of due) {
    const n = now.get(o.address);
    if (!n) {
      // GeckoTerminal has nothing on it: give it two more days, then record that
      if (t - o.checked_at > H[o.horizon] + 2 * 86400) out.push({ ...o, label: "no_data" });
      continue;
    }
    const l = label(o, n);
    out.push({ ...o, fdv1: n.fdv, liq1: n.liquidity, grad1: n.graduated, change_pct: l.change == null ? null : Math.round(l.change * 10) / 10, label: l.label });
  }
  if (out.length) await fetch(`${base}/api/outcomes/record`, { method: "POST", headers, body: JSON.stringify(out), signal: AbortSignal.timeout(20000) });
  const tally: Record<string, number> = {};
  for (const o of out) tally[o.label] = (tally[o.label] ?? 0) + 1;
  return Response.json({ due: due.length, recorded: out.length, tally });
}
