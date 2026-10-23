"use client";

import { useEffect, useState } from "react";
import { CORS_TOKEN, CORS_TRADE_URL, CORS_POOL, formatCors, microPrice } from "@/lib/cors";

export { microPrice };

type Price = {
  price: number | null;
  change24h: number | null;
  volume24h: number | null;
  fdv: number | null;
  reserve: number | null;
  buys24h: number | null;
  sells24h: number | null;
  graduation: number | null;
  graduated: boolean | null;
};
type Trade = { t: number; kind: "buy" | "sell"; cors: number; usd: number; tx: string };
type Chart = { candles: [number, number][]; trades: Trade[] };

const POOL_URL = `https://www.geckoterminal.com/robinhood/pools/${CORS_POOL}`;


// Match the 24h badge: hourly closes from the last day (fall back to all if sparse)
const last24h = (c: [number, number][], now: number) => {
  const since = now - 86400;
  const day = c.filter(([t]) => t >= since);
  return day.length >= 2 ? day : c;
};

const usd = (n: number | null | undefined) =>
  n == null ? "—" : "$" + (n >= 1000 ? formatCors(n, 1) : n.toFixed(0));

const ago = (t: number, now: number) => {
  const s = Math.max(0, Math.floor(now - t));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
};

function Spark({ pts }: { pts: [number, number][] }) {
  if (pts.length < 2)
    return <div className="h-full w-full animate-pulse rounded-xl bg-white/[0.03]" />;
  const W = 600;
  const H = 180;
  const ys = pts.map((p) => p[1]);
  const lo = Math.min(...ys);
  const hi = Math.max(...ys);
  const span = hi - lo || hi || 1;
  const xy = pts.map(
    (p, i) =>
      [(i / (pts.length - 1)) * W, H - 12 - ((p[1] - lo) / span) * (H - 24)] as const
  );
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join("");
  const up = ys[ys.length - 1] >= ys[0];
  const c = up ? "var(--color-saffron-spark)" : "rgba(255,255,255,0.45)";
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full overflow-visible">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={c} stopOpacity="0.35" />
          <stop offset="1" stopColor={c} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${line}L${W},${H}L0,${H}Z`} fill="url(#spark-fill)" />
      <path d={line} fill="none" stroke={c} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      <circle cx={lx} cy={ly} r="4" fill={c} className="pulse-dot" />
    </svg>
  );
}

export function CopyAddress({ className = "" }: { className?: string }) {
  const [done, setDone] = useState(false);
  const a = CORS_TOKEN.address;
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard?.writeText(a).then(() => {
          setDone(true);
          setTimeout(() => setDone(false), 1400);
        });
      }}
      className={`group inline-flex max-w-full items-center gap-3 rounded-[8px] border border-white/15 bg-white/[0.04] px-4 py-2 font-mono text-[12px] text-silver-mist transition-colors hover:border-saffron-spark/60 hover:text-bone-white ${className}`}
      title="Copy contract address"
    >
      <span className="text-ash-gray">CA</span>
      <span className="truncate">
        <span className="hidden sm:inline">{a}</span>
        <span className="sm:hidden">{a.slice(0, 8)}…{a.slice(-6)}</span>
      </span>
      <span className="shrink-0 text-saffron-spark">{done ? "copied ✓" : "copy"}</span>
    </button>
  );
}

export default function TokenPanel() {
  const [p, setP] = useState<Price | null>(null);
  const [chart, setChart] = useState<Chart | null>(null);
  const [err, setErr] = useState(false);
  // Clock is read only in effects — render stays pure for prerendering
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = () => {
      fetch("/api/token-price")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((j) => alive && (setP(j), setErr(false)))
        .catch(() => alive && setErr(true));
      fetch("/api/token-chart")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((j) => alive && (setNow(Date.now() / 1000), setChart(j)))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  const ch = p?.change24h ?? null;
  const grad = Math.min(100, Math.max(0, p?.graduation ?? 0));

  return (
    <div className="card-glow grid grid-cols-1 gap-px overflow-hidden rounded-[28px] bg-white/10 lg:grid-cols-[1.6fr_1fr]">
      {/* Price + chart */}
      <div className="flex flex-col glass-fx bg-white/[0.06] border border-white/[0.12] backdrop-blur-[20px] p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-caption-label text-ash-gray">
              <span className="live-dot" /> $CORS · Robinhood Chain
            </p>
            <div className="mt-3 flex items-baseline gap-4">
              <span className="font-mono text-[clamp(34px,6vw,64px)] leading-none tracking-[-0.04em] text-bone-white">
                {p?.price != null ? `$${microPrice(p.price)}` : err ? "—" : "…"}
              </span>
              {ch != null && (
                <span
                  className={`rounded-[8px] px-3 py-1 font-mono text-[14px] ${
                    ch >= 0 ? "bg-saffron-spark/15 text-saffron-spark" : "bg-white/[0.06] text-white/50"
                  }`}
                >
                  {ch >= 0 ? "▲" : "▼"} {Math.abs(ch).toFixed(1)}%
                </span>
              )}
            </div>
          </div>
          <a href={POOL_URL} target="_blank" rel="noopener noreferrer" className="link-ghost">
            24h · Full chart ↗
          </a>
        </div>

        <div className="mt-6 h-[180px] w-full">
          <Spark pts={last24h(chart?.candles ?? [], now)} />
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            ["Market cap", usd(p?.fdv)],
            ["Volume 24h", usd(p?.volume24h)],
            ["Liquidity", usd(p?.reserve)],
            ["Buys / sells 24h", p?.buys24h != null ? `${p.buys24h} / ${p.sells24h ?? 0}` : "—"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="text-[11px] font-semibold tracking-[0.04em] text-ash-gray uppercase">{k}</div>
              <div className="mt-1 font-mono text-[18px] text-bone-white">{v}</div>
            </div>
          ))}
        </div>

        {/* Bonding curve */}
        <div className="mt-6">
          <div className="flex items-baseline justify-between text-[12px]">
            <span className="font-semibold tracking-[0.04em] text-ash-gray uppercase">
              {p?.graduated ? "Graduated to DEX" : "Bonding curve → graduation"}
            </span>
            <span className="font-mono text-saffron-spark">
              {p?.graduated ? "100%" : p?.graduation != null ? `${grad.toFixed(2)}%` : "—"}
            </span>
          </div>
          <div className="mt-2 h-3 overflow-hidden rounded-[8px] bg-white/[0.06]">
            <div
              className="bar-fill h-full rounded-[8px]"
              style={{ width: `${p?.graduated ? 100 : Math.max(grad, 1.5)}%` }}
            />
          </div>
          <p className="mt-2 text-[12px] text-ash-gray">
            Early: the curve is still filling on Pons. Every buy moves the bar.
          </p>
        </div>

        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href={CORS_TRADE_URL} target="_blank" rel="noopener noreferrer" className="btn-primary btn-lg">
            Buy $CORS on Pons →
          </a>
          <CopyAddress />
        </div>
      </div>

      {/* Live trades */}
      <div className="flex flex-col glass-fx bg-white/[0.06] border border-white/[0.12] backdrop-blur-[20px] p-6 sm:p-8">
        <p className="flex items-center gap-2 text-caption-label text-ash-gray">
          <span className="live-dot" /> Live trades
        </p>
        <div className="mt-4 flex flex-1 flex-col">
          {(chart?.trades ?? []).slice(0, 9).map((t) => (
            <a
              key={t.tx + t.t + t.kind}
              href={t.tx}
              target="_blank"
              rel="noopener noreferrer"
              className="row-in flex items-center justify-between border-b border-white/[0.07] py-3 font-mono text-[13px] transition-colors hover:bg-white/[0.03]"
            >
              <span className={t.kind === "buy" ? "text-saffron-spark" : "text-white/45"}>
                {t.kind === "buy" ? "BUY " : "SELL"}
              </span>
              <span className="text-bone-white">{formatCors(t.cors, 0)} CORS</span>
              <span className="text-silver-mist">${t.usd.toFixed(2)}</span>
              <span className="w-10 text-right text-ash-gray">{ago(t.t, now)}</span>
            </a>
          ))}
          {!chart && <p className="py-6 text-[13px] text-ash-gray">Reading the pool…</p>}
        </div>
        <p className="mt-4 text-[11px] text-ash-gray">
          Pool data via GeckoTerminal, refreshed every 30s. Each row links to the tx on Blockscout.
        </p>
      </div>
    </div>
  );
}
