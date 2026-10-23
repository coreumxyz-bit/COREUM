"use client";

import { useEffect, useRef, useState } from "react";
import { CORS_TOKEN } from "@/lib/cors";

type Burn = { tx: string; block: number; ts: number; from: string; amount: number };
type Burns = { total: number; pct: number; count: number; supply: number; recent: Burn[] };

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
const ago = (ts: number, now: number) => {
  const s = Math.max(0, now - ts);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
};

// Live on-chain burn counter: total sent to 0x…dEaD, share of supply, every burn tx.
export default function BurnCounter() {
  const [b, setB] = useState<Burns | null>(null);
  const [shown, setShown] = useState(0);
  const [now, setNow] = useState(0);
  const from = useRef(0);

  useEffect(() => {
    const load = () =>
      fetch("/api/burns")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j && !j.error && j.total > 0) {
            setB(j);
            setNow(Date.now() / 1000);
          }
        })
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  // count up to the new total whenever it changes
  useEffect(() => {
    if (!b) return;
    const start = from.current, end = b.total, t0 = performance.now(), dur = 1600;
    let raf = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      setShown(start + (end - start) * e);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = end;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [b]);

  const explorer = CORS_TOKEN.explorer;
  return (
    <div className="glass-fx mt-6 grid grid-cols-1 gap-6 rounded-[28px] border border-white/[0.12] bg-white/[0.06] p-6 backdrop-blur-[20px] sm:p-8 lg:grid-cols-[1.1fr_1fr]">
      <div>
        <p className="flex items-center gap-2 text-[13px] text-white/60">
          <span className="live-dot" /> Burned forever · read from the chain
        </p>
        <div className="mt-3 font-mono text-[clamp(40px,6vw,68px)] leading-none tracking-[-0.03em] text-white">
          {b ? fmt(shown) : "…"}
          <span className="ml-3 text-[0.4em] text-white/50">$CORS</span>
        </div>
        <div className="mt-5">
          <div className="flex items-baseline justify-between text-[13px] text-white/60">
            <span>Share of the 1,000,000,000 supply</span>
            <span className="font-mono text-white">{b ? `${(b.pct * 100).toFixed(3)}%` : "—"}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="h-full rounded-full bg-white transition-[width] duration-[1600ms] ease-out"
              style={{ width: b ? `${Math.max(0.6, Math.min(100, b.pct * 100 * 10))}%` : "0%" }}
            />
          </div>
          <p className="mt-2 text-[11px] text-white/45">Bar scaled ×10 for visibility. Total = live balance of 0x…dEaD.</p>
        </div>
        <a
          href={`${explorer}/address/0x000000000000000000000000000000000000dEaD?tab=token_transfers`}
          target="_blank"
          rel="noopener noreferrer"
          className="link-ghost mt-5 inline-block"
        >
          Verify on Blockscout ↗
        </a>
      </div>

      <div>
        <p className="text-[13px] text-white/60">{b ? `${b.count} burn transactions` : "Burn transactions"}</p>
        <div className="mt-2 flex flex-col">
          {(b?.recent ?? []).slice(0, 6).map((r) => (
            <a
              key={r.tx}
              href={`${explorer}/tx/${r.tx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="row-in flex items-center justify-between gap-3 border-b border-white/[0.08] py-3 font-mono text-[13px] transition-colors hover:bg-white/[0.03]"
            >
              <span className="whitespace-nowrap text-white">{fmt(r.amount)} <span className="text-white/50">burned</span></span>
              <span className="hidden text-white/50 sm:inline">
                {r.tx.slice(0, 8)}…{r.tx.slice(-4)}
              </span>
              <span className="w-16 shrink-0 text-right text-white/50">{now ? ago(r.ts, now) : ""}</span>
            </a>
          ))}
          {!b && <p className="py-3 text-[13px] text-white/55">Reading the chain…</p>}
        </div>
      </div>
    </div>
  );
}
