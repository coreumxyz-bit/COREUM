import { NextResponse } from "next/server";

// Server-side proxy for GeckoTerminal: their API sends no CORS headers, so
// the browser can't call it directly. Route handlers are not cached by
// default — every request gets a fresh price.
const POOL = "0x174a18e97de5cd9f58dca79b68b9f358c00c7aa3"; // CORS / WETH
const TOKEN = "0x3a2ec7aeb4b3c3d6ae9ff6f390bc9da05a8cb945";

const num = (v: unknown): number | null => {
  const n = parseFloat(String(v ?? ""));
  return Number.isFinite(n) ? n : null;
};

async function gt(url: string): Promise<Record<string, unknown>> {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: { accept: "application/json" },
  });
  if (!r.ok) throw new Error("geckoterminal " + r.status);
  const j = await r.json();
  return j.data.attributes as Record<string, unknown>;
}

export async function GET() {
  let pool: Record<string, unknown> | null = null;
  let tok: Record<string, unknown> | null = null;
  try {
    pool = await gt(
      `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${POOL}`
    );
  } catch {}
  try {
    tok = await gt(
      `https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/${TOKEN}`
    );
  } catch {}

  const a = pool ?? tok;
  if (!a) {
    return NextResponse.json(
      { error: "price unavailable" },
      { status: 503, headers: { "cache-control": "public, max-age=30" } }
    );
  }

  const pc = (a.price_change_percentage ?? {}) as { h24?: unknown };
  const pcTok = (tok?.price_change_percentage ?? {}) as { h24?: unknown };
  const vol = (a.volume_usd ?? {}) as { h24?: unknown };
  const tx = ((pool?.transactions ?? {}) as Record<string, { buys?: number; sells?: number }>).h24;
  const launch = (pool?.launchpad_details ?? null) as
    | { graduation_percentage?: unknown; completed?: boolean }
    | null;
  const volTok = (tok?.volume_usd ?? {}) as { h24?: unknown };

  return NextResponse.json(
    {
      price: num(a.price_usd ?? tok?.price_usd),
      change24h: num(pc.h24 ?? pcTok.h24),
      volume24h: num(vol.h24 ?? volTok.h24),
      liquidity: num(a.liquidity_usd ?? tok?.liquidity_usd),
      fdv: num(a.fdv_usd ?? tok?.fdv_usd),
      reserve: num(pool?.reserve_in_usd),
      buys24h: tx?.buys ?? null,
      sells24h: tx?.sells ?? null,
      graduation: launch ? num(launch.graduation_percentage) : null,
      graduated: launch?.completed ?? null,
      poolUrl: `https://www.geckoterminal.com/robinhood/pools/${POOL}`,
    },
    { headers: { "cache-control": "public, max-age=60" } }
  );
}
