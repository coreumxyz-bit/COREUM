import { NextResponse } from "next/server";
import { CORS_POOL, CORS_TOKEN } from "@/lib/cors";

// Hourly candles + latest trades for the CORS/WETH pool, proxied from
// GeckoTerminal (no CORS headers on their API).
const GT = `https://api.geckoterminal.com/api/v2/networks/robinhood/pools/${CORS_POOL}`;

async function get(url: string) {
  const r = await fetch(url, {
    signal: AbortSignal.timeout(6000),
    headers: { accept: "application/json" },
  });
  if (!r.ok) throw new Error("geckoterminal " + r.status);
  return r.json();
}

type GtTrade = {
  attributes: {
    block_timestamp: string;
    tx_hash: string;
    kind: "buy" | "sell";
    from_token_amount: string;
    to_token_amount: string;
    volume_in_usd: string;
  };
};

export async function GET() {
  const [ohlcv, trades] = await Promise.allSettled([
    get(`${GT}/ohlcv/hour?aggregate=1&limit=96&currency=usd`),
    get(`${GT}/trades`),
  ]);

  // [t, o, h, l, c, v] newest first → oldest first
  const candles: number[][] =
    ohlcv.status === "fulfilled"
      ? [...(ohlcv.value?.data?.attributes?.ohlcv_list ?? [])].reverse()
      : [];

  const list: GtTrade[] =
    trades.status === "fulfilled" ? trades.value?.data ?? [] : [];
  const tape = list.slice(0, 12).map(({ attributes: t }) => ({
    t: Math.floor(Date.parse(t.block_timestamp) / 1000),
    kind: t.kind,
    cors: parseFloat(t.kind === "buy" ? t.to_token_amount : t.from_token_amount),
    usd: parseFloat(t.volume_in_usd),
    tx: `${CORS_TOKEN.explorer}/tx/${t.tx_hash}`,
  }));

  if (!candles.length && !tape.length)
    return NextResponse.json({ error: "chart unavailable" }, { status: 503 });

  return NextResponse.json(
    { candles: candles.map((c) => [c[0], c[4]]), trades: tape },
    { headers: { "cache-control": "public, max-age=60" } }
  );
}
