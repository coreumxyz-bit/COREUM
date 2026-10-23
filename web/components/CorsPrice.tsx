"use client";

import { useEffect, useState } from "react";
import { formatCors, CORS_TOKEN } from "@/lib/cors";
import { microPrice } from "@/lib/cors";

// CORS / WETH pool on Robinhood Chain — GeckoTerminal network slug: robinhood
const POOL = "0x174a18e97de5cd9f58dca79b68b9f358c00c7aa3";
export const CORS_POOL_URL = `https://www.geckoterminal.com/robinhood/pools/${POOL}`;

interface TokenPrice {
  price: number;
  change24h?: number;
  volume24h?: number;
  liquidity?: number;
  fdv?: number;
}

// $0.00000426 needs more than the usual two/four decimals to be readable
const fmtPrice = microPrice;

const stat = (v: number | undefined, label: string, fmt: (n: number) => string) => (
  <div>
    <div className="text-xs text-white/40">{label}</div>
    <div className="text-sm font-bold">
      {v != null ? fmt(v) : "—"}
    </div>
  </div>
);

export function CorsPriceWidget({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<TokenPrice | null>(null);
  const [chain, setChain] = useState<{ holders: number; supply: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Aggregators may lag on new chains — fall back to real on-chain facts
    // from the official Blockscout explorer.
    const chainFacts = () =>
      fetch(
        `https://robinhoodchain.blockscout.com/api/v2/tokens/${CORS_TOKEN.address}`
      )
        .then((r) => r.json())
        .then((j) => {
          if (j?.holders_count != null)
            setChain({
              holders: j.holders_count,
              supply: (Number(j.total_supply) / 1e18 / 1e9).toFixed(2) + "B",
            });
        })
        .catch(() => {});

    // /api/token-price proxies GeckoTerminal server-side (their API has no
    // CORS headers): CORS/WETH pool price → token endpoint → Blockscout.
    fetch("/api/token-price")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("no price"))))
      .then((j) => {
        if (j.price == null) throw new Error("no price");
        setData({
          price: j.price,
          change24h: j.change24h ?? undefined,
          volume24h: j.volume24h ?? undefined,
          liquidity: j.liquidity ?? undefined,
          fdv: j.fdv ?? undefined,
        });
      })
      .catch(() => chainFacts())
      .finally(() => setLoading(false));
  }, []);

  if (compact) {
    return (
      <a
        href={CORS_POOL_URL}
        target="_blank"
        rel="noopener"
        className="inline-flex items-center gap-2 rounded-[8px] border border-white/10 bg-white/5 px-4 py-2 text-sm font-mono hover:bg-white/10 transition-colors"
      >
        <span className="text-lg font-bold">$CORS</span>
        {loading ? (
          <span className="text-white/40">…</span>
        ) : data ? (
          <>
            <span>${fmtPrice(data.price)}</span>
            {data.change24h != null && (
              <span
                className={
                  data.change24h >= 0 ? "text-saffron-spark" : "text-white/45"
                }
              >
                {data.change24h >= 0 ? "↑" : "↓"}
                {Math.abs(data.change24h).toFixed(1)}%
              </span>
            )}
          </>
        ) : chain ? (
          <span className="text-white">
            {chain.supply} supply · {chain.holders} holders
          </span>
        ) : (
          <span className="text-white/40">price unavailable</span>
        )}
      </a>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-white/40">Token</div>
          <div className="text-2xl font-bold">$CORS</div>
          <a
            href={CORS_POOL_URL}
            target="_blank"
            rel="noopener"
            className="text-xs text-white/40 underline hover:text-white/70"
          >
            CORS / WETH pool →
          </a>
        </div>
        <div className="text-right">
          {loading ? (
            <div className="animate-pulse text-white/40">Loading…</div>
          ) : data ? (
            <>
              <div className="text-3xl font-bold">${fmtPrice(data.price)}</div>
              {data.change24h != null && (
                <div
                  className={`text-sm ${
                    data.change24h >= 0 ? "text-saffron-spark" : "text-white/45"
                  }`}
                >
                  {data.change24h >= 0 ? "↑" : "↓"}{" "}
                  {Math.abs(data.change24h).toFixed(2)}% 24h
                </div>
              )}
            </>
          ) : chain ? (
            <>
              <div className="text-2xl font-bold">{chain.supply} CORS</div>
              <div className="text-sm text-white/40">
                total supply · {chain.holders} holders
              </div>
            </>
          ) : (
            <div className="text-white/40">Price unavailable</div>
          )}
        </div>
      </div>

      {data && (
        <div className="mt-6 grid grid-cols-3 gap-4 border-t border-white/10 pt-6">
          {stat(data.volume24h, "24h Volume", (n) => `$${formatCors(n, 0)}`)}
          {stat(data.liquidity, "Liquidity", (n) => `$${formatCors(n, 0)}`)}
          {stat(data.fdv, "FDV", (n) => `$${formatCors(n, 0)}`)}
        </div>
      )}
    </div>
  );
}
