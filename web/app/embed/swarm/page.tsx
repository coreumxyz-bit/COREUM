"use client";

// Embeddable swarm widget — paste anywhere:
// <iframe src="https://www.coreum.xyz/embed/swarm?sym=BTC" width="320" height="190" style="border:0" />
// Same-origin API, refreshes every 30s, zero client deps.

import { useEffect, useState } from "react";

const SYMS = ["BTC", "ETH", "SOL", "DOGE", "LINK", "TSLA", "NVDA", "AAPL"];

export default function EmbedSwarm() {
  const [sym, setSym] = useState("BTC");
  const [pct, setPct] = useState<number | null | undefined>(undefined);
  const [calls, setCalls] = useState(0);
  const [price, setPrice] = useState<number | null>(null);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("sym");
    if (q && SYMS.includes(q.toUpperCase())) setSym(q.toUpperCase());
  }, []);

  useEffect(() => {
    let stop = false;
    const load = async () => {
      try {
        const [sw, st] = await Promise.all([
          fetch(`/api/swarm?sym=${sym}`).then((r) => r.json()),
          fetch(`/api/state`).then((r) => r.json()),
        ]);
        if (stop) return;
        setPct(sw.pct ?? null);
        setCalls(sw.rows?.length ?? 0);
        const series: number[] = st.prices?.[sym] ?? [];
        setPrice(series.length ? series[series.length - 1] : null);
      } catch {
        if (!stop) setPct(null);
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [sym]);

  const up = (pct ?? 0) >= 0.5;

  return (
    <a
      href="https://www.coreum.xyz"
      target="_blank"
      rel="noopener"
      className="flex h-screen w-full flex-col justify-between bg-void p-5 text-bone-white no-underline"
    >
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[13px] text-ash-gray">coreum.xyz</span>
        <span className="font-bold tracking-wide">{sym}</span>
      </div>

      <div>
        <div className="text-[13px] uppercase tracking-[0.14em] text-ash-gray">
          Swarm consensus
        </div>
        {pct === undefined ? (
          <div className="mt-2 animate-pulse text-[44px] font-bold leading-none text-white/30">
            …
          </div>
        ) : pct === null ? (
          <div className="mt-2 text-[20px] font-semibold text-ash-gray">
            no open calls
          </div>
        ) : (
          <div
            className={`mt-2 text-[44px] font-bold leading-none ${up ? "text-white" : "text-white/45"}`}
          >
            {Math.round(pct * 100)}%{" "}
            <span className="text-[22px]">{up ? "UP" : "DOWN"}</span>
          </div>
        )}
        <div className="mt-2 font-mono text-[13px] text-ash-gray">
          {price != null
            ? `${price.toLocaleString("en-US", { maximumFractionDigits: 4 })} · `
            : ""}
          {calls} open call{calls === 1 ? "" : "s"}
        </div>
      </div>

      <div className="text-[11px] uppercase tracking-[0.16em] text-white/35">
        verified signals — settle on their own
      </div>
    </a>
  );
}
