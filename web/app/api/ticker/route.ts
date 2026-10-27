import { CORS_HEADERS } from "@/lib/publicApi";

// GET /api/ticker?q=THKR — every Robinhood Chain token using a ticker or name, biggest
// first, so copycats can be told apart. GeckoTerminal finds the small ones, DexScreener
// backs it up; results are cached for five minutes. Used by the Ask Coreum chat.
type Tok = { address: string; symbol: string; name?: string; liquidity_usd: number; fdv_usd: number; pools: number };

async function gecko(q: string): Promise<Tok[]> {
  const r = await fetch(`https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(q)}&network=robinhood`, {
    headers: { accept: "application/json" },
    next: { revalidate: 300 },
    signal: AbortSignal.timeout(10_000),
  });
  if (!r.ok) throw new Error("geckoterminal " + r.status);
  const j = (await r.json()) as { data?: { attributes?: { name?: string; fdv_usd?: string; reserve_in_usd?: string }; relationships?: { base_token?: { data?: { id?: string } } } }[] };
  return (j.data ?? [])
    .filter((p) => p.relationships?.base_token?.data?.id?.startsWith("robinhood_"))
    .map((p) => ({
      address: p.relationships!.base_token!.data!.id!.slice("robinhood_".length).toLowerCase(),
      symbol: String(p.attributes?.name ?? "").split(" / ")[0],
      liquidity_usd: Math.round(+(p.attributes?.reserve_in_usd ?? 0)),
      fdv_usd: Math.round(+(p.attributes?.fdv_usd ?? 0)),
      pools: 1,
    }));
}

async function dex(q: string): Promise<Tok[]> {
  const r = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { next: { revalidate: 300 }, signal: AbortSignal.timeout(10_000) });
  if (!r.ok) throw new Error("dexscreener " + r.status);
  const j = (await r.json()) as { pairs?: { chainId: string; baseToken: { address: string; symbol: string; name: string }; liquidity?: { usd?: number }; fdv?: number }[] };
  return (j.pairs ?? [])
    .filter((p) => p.chainId === "robinhood")
    .map((p) => ({ address: p.baseToken.address.toLowerCase(), symbol: p.baseToken.symbol, name: p.baseToken.name, liquidity_usd: Math.round(p.liquidity?.usd ?? 0), fdv_usd: Math.round(p.fdv ?? 0), pools: 1 }));
}

export async function GET(req: Request) {
  const q = (new URL(req.url).searchParams.get("q") ?? "").replace(/^\$/, "").trim().slice(0, 30);
  if (!q) return Response.json({ error: "send ?q=TICKER" }, { status: 400, headers: CORS_HEADERS });
  const [g, d] = await Promise.allSettled([gecko(q), dex(q)]);
  if (g.status === "rejected" && d.status === "rejected") return Response.json({ error: "token search is unavailable right now" }, { status: 503, headers: CORS_HEADERS });
  const by = new Map<string, Tok>();
  for (const t of [...(g.status === "fulfilled" ? g.value : []), ...(d.status === "fulfilled" ? d.value : [])]) {
    const o = by.get(t.address);
    if (!o) by.set(t.address, { ...t });
    else {
      o.pools += 1;
      o.liquidity_usd = Math.max(o.liquidity_usd, t.liquidity_usd);
      o.fdv_usd = Math.max(o.fdv_usd, t.fdv_usd);
      o.name ??= t.name;
    }
  }
  const tokens = [...by.values()].sort((a, b) => b.liquidity_usd - a.liquidity_usd || b.pools - a.pools).slice(0, 12);
  return Response.json({ query: q, tokens }, { headers: { ...CORS_HEADERS, "cache-control": "public, s-maxage=300" } });
}
