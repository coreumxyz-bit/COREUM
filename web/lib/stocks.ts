// Tokenized stocks on Robinhood Chain: each official "• Robinhood Token" against
// the real share on its exchange. Token prices from GeckoTerminal (one call),
// market prices from Yahoo Finance (two calls). The list of official tokens is
// lib/stockTokens.json — tokens named "<Company> • Robinhood Token".
import STOCKS from "@/lib/stockTokens.json";

export type StockToken = { sym: string; address: string; name: string; yahoo: string };
export const STOCK_TOKENS = STOCKS as StockToken[];
const BY_SYM = new Map(STOCK_TOKENS.map((s) => [s.sym, s]));
const BY_ADDR = new Map(STOCK_TOKENS.map((s) => [s.address, s]));

/** Is this an official stock token, or does it borrow the ticker of one? */
export function stockIdentity(address: string, symbol: string): { official?: StockToken; borrows?: StockToken } {
  const official = BY_ADDR.get(address.toLowerCase());
  if (official) return { official };
  const borrows = BY_SYM.get(symbol.trim().toUpperCase());
  return borrows ? { borrows } : {};
}

export type StockRow = StockToken & {
  token: number | null; // token price on Robinhood Chain, USD
  market: number | null; // the share's last regular-session price
  gap: number | null; // token / market − 1
  liquidity: number | null;
  volume24: number | null;
  open: boolean; // the exchange's regular session is on right now
  status: "in line" | "drifting" | "off" | "market closed" | "no data";
};

async function yahoo(symbols: string[]) {
  const out = new Map<string, { price: number; open: boolean }>();
  for (let i = 0; i < symbols.length; i += 20) {
    try {
      const r = await fetch(`https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbols.slice(i, i + 20).join(",")}&range=1d&interval=1d`, {
        headers: { "user-agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 60 },
      });
      if (!r.ok) continue;
      const j = (await r.json()) as {
        spark?: { result?: { symbol: string; response: { meta: { regularMarketPrice?: number; currentTradingPeriod?: { regular?: { start: number; end: number } } } }[] }[] };
      };
      const now = Date.now() / 1000;
      for (const x of j.spark?.result ?? []) {
        const m = x.response?.[0]?.meta;
        if (!m?.regularMarketPrice) continue;
        const reg = m.currentTradingPeriod?.regular;
        out.set(x.symbol, { price: m.regularMarketPrice, open: !!reg && now >= reg.start && now <= reg.end });
      }
    } catch {}
  }
  return out;
}

async function onchain(addresses: string[]) {
  const out = new Map<string, { price: number | null; liquidity: number | null; volume24: number | null }>();
  try {
    const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/multi/${addresses.join(",")}`, {
      headers: { accept: "application/json;version=20230302" },
      signal: AbortSignal.timeout(8000),
      next: { revalidate: 60 },
    });
    if (!r.ok) return out;
    const j = (await r.json()) as { data?: { attributes: Record<string, unknown> }[] };
    const num = (v: unknown) => {
      const n = parseFloat(String(v ?? ""));
      return Number.isFinite(n) ? n : null;
    };
    for (const d of j.data ?? []) {
      const a = d.attributes;
      out.set(String(a.address).toLowerCase(), {
        price: num(a.price_usd),
        liquidity: num(a.total_reserve_in_usd),
        volume24: num((a.volume_usd as { h24?: string } | undefined)?.h24),
      });
    }
  } catch {}
  return out;
}

export async function stockBoard(): Promise<StockRow[]> {
  const [chain, market] = await Promise.all([onchain(STOCK_TOKENS.map((s) => s.address)), yahoo(STOCK_TOKENS.map((s) => s.yahoo))]);
  return STOCK_TOKENS.map((s) => {
    const c = chain.get(s.address);
    const m = market.get(s.yahoo);
    const token = c?.price ?? null;
    const gap = token != null && m?.price ? token / m.price - 1 : null;
    const open = !!m?.open;
    const status: StockRow["status"] =
      gap == null ? "no data" : !open ? "market closed" : Math.abs(gap) < 0.01 ? "in line" : Math.abs(gap) < 0.03 ? "drifting" : "off";
    return { ...s, token, market: m?.price ?? null, gap, liquidity: c?.liquidity ?? null, volume24: c?.volume24 ?? null, open, status };
  });
}
