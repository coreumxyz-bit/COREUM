import { api } from "./api";

// Crypto 24/7 (Coinbase) + US stocks during market hours (Yahoo) — fetched by the Worker.
export const SYMBOLS = ["BTC", "ETH", "SOL", "DOGE", "LINK", "TSLA", "NVDA", "AAPL"];
export const isSymbol = (s: string) => SYMBOLS.includes(s);

export async function getAllPrices(): Promise<Record<string, number[]>> {
  const s = await api<{ prices: Record<string, number[]> }>("/api/state");
  return Object.fromEntries(Object.entries(s.prices).filter(([, v]) => v.length));
}
