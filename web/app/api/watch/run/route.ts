import { connection } from "next/server";
import { fetchToken, ownerOf, questionForToken, type TokenFacts } from "@/lib/token";

// Hourly watchlist run — called by .github/workflows/radar.yml with the admin key.
// 1) one GeckoTerminal "multi" call per 30 tokens refreshes liquidity, value and curve;
// 2) owner() is read over RPC for every token;
// 3) the full facts (holders, deployer, honeypot) are refreshed for a few of the
//    stalest tokens — GeckoTerminal's free API is the limit;
// then each new snapshot is compared with the last one, alerts are stored, and a
// dangerous change sends the token back to the cores for a fresh verdict.
export const maxDuration = 60;

const GT = "https://api.geckoterminal.com/api/v2/networks/robinhood";
const FULL_PER_RUN = 3;
const RECHECKS_PER_RUN = 2;

type Snap = Partial<TokenFacts> & { fdv?: number | null };
type Watched = { address: string; symbol: string; snap: Snap | null; snap_at: number | null; last_job: number | null };
type Alert = { kind: string; severity: "danger" | "warn" | "good"; detail: string; job?: number };

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};
const usd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function multi(addresses: string[]) {
  const out = new Map<string, { liquidity: number | null; fdv: number | null; volume24: number | null; curve: number | null; graduated: boolean | null }>();
  for (let i = 0; i < addresses.length; i += 30) {
    const r = await fetch(`${GT}/tokens/multi/${addresses.slice(i, i + 30).join(",")}`, {
      headers: { accept: "application/json;version=20230302" },
      signal: AbortSignal.timeout(9000),
      cache: "no-store",
    });
    if (!r.ok) break; // rate-limited: the rest keep their old snapshot this hour
    const j = (await r.json()) as { data?: { attributes: Record<string, unknown> }[] };
    for (const d of j.data ?? []) {
      const a = d.attributes;
      const lp = a.launchpad_details as { graduation_percentage?: number; completed?: boolean } | null;
      out.set(String(a.address).toLowerCase(), {
        liquidity: num(a.total_reserve_in_usd),
        fdv: num(a.fdv_usd),
        volume24: num((a.volume_usd as { h24?: string } | undefined)?.h24),
        curve: lp ? num(lp.graduation_percentage) : null,
        graduated: lp ? !!lp.completed : null,
      });
    }
    if (i + 30 < addresses.length) await sleep(2500);
  }
  return out;
}

// what changed between two snapshots that a holder would want to know
function diff(prev: Snap, next: Snap): Alert[] {
  const a: Alert[] = [];
  if (prev.liquidity != null && next.liquidity != null && prev.liquidity >= 500 && next.liquidity < prev.liquidity * 0.7)
    a.push({ kind: "liquidity_drop", severity: "danger", detail: `Liquidity fell ${Math.round((1 - next.liquidity / prev.liquidity) * 100)}% (${usd(prev.liquidity)} → ${usd(next.liquidity)})` });
  if (prev.fdv != null && next.fdv != null && prev.fdv >= 1000 && next.fdv < prev.fdv * 0.5)
    a.push({ kind: "price_crash", severity: "danger", detail: `Value fell ${Math.round((1 - next.fdv / prev.fdv) * 100)}% since the last check (${usd(prev.fdv)} → ${usd(next.fdv)})` });
  if (prev.dev != null && next.dev != null && prev.dev >= 1 && next.dev <= prev.dev - 1)
    a.push({ kind: "dev_sold", severity: "danger", detail: `Deployer sold: ${prev.dev.toFixed(1)}% → ${next.dev.toFixed(1)}% of supply` });
  const ownerless = (o: unknown) => o === "none" || o === "renounced";
  if (prev.owner && next.owner && ownerless(prev.owner) && !ownerless(next.owner))
    a.push({ kind: "owner_active", severity: "danger", detail: `The contract now has an active owner (${String(next.owner).slice(0, 10)}…)` });
  if (next.honeypot === true && prev.honeypot !== true) a.push({ kind: "honeypot", severity: "danger", detail: "Flagged as a honeypot — selling may be blocked" });
  if (next.graduated && prev.top10 != null && next.top10 != null && next.top10 >= prev.top10 + 10)
    a.push({ kind: "top10_jump", severity: "warn", detail: `Top 10 holders now own ${next.top10.toFixed(0)}% (was ${prev.top10.toFixed(0)}%)` });
  if (next.graduated && prev.graduated === false) a.push({ kind: "graduated", severity: "good", detail: "Graduated from the launchpad curve to a DEX pool" });
  return a;
}

export async function POST(req: Request) {
  await connection();
  const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
  const headers = {
    "content-type": "application/json",
    "x-coreum-secret": process.env.COREUM_SITE_SECRET ?? "",
    "x-coreum-admin": req.headers.get("x-coreum-admin") ?? "",
  };
  const w = await fetch(`${base}/api/watch/all`, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!w.ok) return Response.json({ error: "forbidden" }, { status: 403 });
  const list = (await w.json()) as Watched[];
  if (!list.length) return Response.json({ tokens: 0 });

  const quick = await multi(list.map((t) => t.address));
  const owners = new Map<string, TokenFacts["owner"]>();
  await Promise.all(list.map(async (t) => owners.set(t.address, await ownerOf(t.address))));

  // the stalest few get their full facts refreshed (holders, deployer, honeypot)
  const full = new Map<string, Awaited<ReturnType<typeof fetchToken>>>();
  for (const [i, t] of list.slice(0, FULL_PER_RUN).entries()) {
    if (i) await sleep(6000);
    try {
      full.set(t.address, await fetchToken(t.address));
    } catch {
      break; // rate-limited: try again next hour
    }
  }

  let rechecks = 0, alerted = 0;
  const report: { symbol: string; alerts: string[]; recheck?: number }[] = [];
  for (const t of list) {
    const prev: Snap = t.snap ?? {};
    const f = full.get(t.address);
    const q = quick.get(t.address);
    const next: Snap = { ...prev, ...(f ? f.facts : {}), ...(q ?? {}), owner: owners.get(t.address) ?? prev.owner };
    if (!f && !q) continue; // nothing fresh about this token this hour
    const alerts = t.snap ? diff(prev, next) : [];
    let last_job: number | undefined;
    if (alerts.some((a) => a.severity === "danger") && rechecks < RECHECKS_PER_RUN) {
      try {
        const tok = f ?? (await fetchToken(t.address));
        const r = await fetch(`${base}/api/ask`, {
          method: "POST",
          headers,
          body: JSON.stringify({ q: questionForToken(tok), src: { ...tok, via: "watch" }, radar: true }),
          signal: AbortSignal.timeout(15000),
        });
        const j = (await r.json()) as { id?: number };
        if (j.id) {
          last_job = j.id;
          rechecks++;
          for (const a of alerts) if (a.severity === "danger") a.job = j.id;
        }
      } catch {}
    }
    await fetch(`${base}/api/watch/update`, {
      method: "POST",
      headers,
      body: JSON.stringify({ address: t.address, snap: next, alerts, last_job }),
      signal: AbortSignal.timeout(10000),
    });
    if (alerts.length) {
      alerted++;
      report.push({ symbol: t.symbol, alerts: alerts.map((a) => a.kind), recheck: last_job });
    }
  }
  return Response.json(
    { tokens: list.length, refreshed: quick.size, full: full.size, alerted, rechecks, report },
    { headers: { "cache-control": "no-store" } }
  );
}
