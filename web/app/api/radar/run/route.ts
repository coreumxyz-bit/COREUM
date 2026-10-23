import { connection } from "next/server";
import { fetchToken, questionForToken } from "@/lib/token";
import { recheckDumped } from "@/lib/recheck";

// Pons Radar run — called hourly by .github/workflows/radar.yml with the admin key.
// Picks the most active fresh Pons launches GeckoTerminal lists, skips tokens the
// network already checked, and sends each to the cores as a Token Check.
export const maxDuration = 60;

const GT = "https://api.geckoterminal.com/api/v2/networks/robinhood";
const PER_RUN = 3; // AI checks per hour at most (GeckoTerminal's free API is the bottleneck)
const MIN_AGE_MIN = 20; // let the first trades happen
const MAX_AGE_H = 48; // "new" launches only
const MIN_VOL24 = 2000; // USD — skip launches nobody traded

type Pool = {
  attributes: { pool_created_at: string; volume_usd: { h24: string }; transactions: { h24: { buys: number; sells: number } } };
  relationships: { base_token: { data: { id: string } } };
};

async function ponsPools(sort: string): Promise<Pool[]> {
  const r = await fetch(`${GT}/dexes/pons-v2/pools?sort=${sort}&page=1`, {
    headers: { accept: "application/json;version=20230302" },
    signal: AbortSignal.timeout(9000),
    cache: "no-store",
  });
  if (!r.ok) throw new Error(`GeckoTerminal ${r.status}`);
  return ((await r.json()) as { data?: Pool[] }).data ?? [];
}

export async function POST(req: Request) {
  await connection();
  const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
  const admin = req.headers.get("x-coreum-admin") ?? "";
  const headers = { "content-type": "application/json", "x-coreum-secret": process.env.COREUM_SITE_SECRET ?? "", "x-coreum-admin": admin };

  // the Worker checks the admin key; without it nothing below runs
  const k = await fetch(`${base}/api/radar/known`, { headers, cache: "no-store", signal: AbortSignal.timeout(10000) });
  if (!k.ok) return Response.json({ error: "forbidden" }, { status: 403 });
  const known = new Set(((await k.json()) as string[]).map((a) => a.toLowerCase()));

  const now = Date.now();
  const seen = new Set<string>();
  const picks: { address: string; vol: number }[] = [];
  for (const sort of ["h24_volume_usd_desc"]) {
    for (const p of await ponsPools(sort)) {
      const address = p.relationships.base_token.data.id.replace(/^robinhood_/, "").toLowerCase();
      const ageMin = (now - Date.parse(p.attributes.pool_created_at)) / 60000;
      const vol = Number(p.attributes.volume_usd.h24) || 0;
      if (seen.has(address) || known.has(address)) continue;
      seen.add(address);
      if (ageMin < MIN_AGE_MIN || ageMin > MAX_AGE_H * 60 || vol < MIN_VOL24) continue;
      picks.push({ address, vol });
    }
  }
  picks.sort((a, b) => b.vol - a.vol);

  const results: { address: string; symbol?: string; id?: number; error?: string }[] = [];
  for (const [i, { address }] of picks.slice(0, PER_RUN).entries()) {
    // GeckoTerminal's free API allows ~30 calls a minute; each token costs two
    if (i) await new Promise((r) => setTimeout(r, 7000));
    try {
      // one retry after a pause if GeckoTerminal rate-limits us
      const t = await fetchToken(address).catch(async (e) => {
        if (!/429/.test(String(e))) throw e;
        await new Promise((r) => setTimeout(r, 12000));
        return fetchToken(address);
      });
      const r = await fetch(`${base}/api/ask`, {
        method: "POST",
        headers,
        body: JSON.stringify({ q: questionForToken(t), src: { ...t, via: "radar" }, radar: true }),
        signal: AbortSignal.timeout(15000),
      });
      const j = (await r.json()) as { id?: number; error?: string };
      results.push({ address, symbol: t.symbol, id: j.id, error: j.error });
      if (r.status === 429) break; // quota reached: stop for this hour
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      results.push({ address, error });
      if (/429/.test(error)) break; // rate-limited: the rest wait for the next hour
    }
  }
  // then: anything checked this week that has since lost half its value goes back to the cores
  const rechecked = await recheckDumped(base, headers).catch(() => []);
  return Response.json({ candidates: picks.length, checked: results, rechecked }, { headers: { "cache-control": "no-store" } });
}
