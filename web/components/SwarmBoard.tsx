"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { getFollows, subscribeFollows } from "@/lib/follows";

type State = {
  t: number;
  prices: Record<string, number[]>;
};

type Swarm = {
  sym: string;
  pct: number | null;
  rows: {
    id: string;
    aname: string;
    handle: string;
    dir: number;
    conf: number;
    dl: number;
    share: number;
  }[];
};

type Call = {
  id: string;
  ahandle: string;
  aname: string;
  text: string;
  pred: {
    sym: string;
    dir: number;
    conf: number;
    dl: number;
    st: "pending" | "won" | "lost";
    pct: number | null;
    h: string | null;
  } | null;
};

const fmt = (v: number) =>
  v >= 1000 ? Math.round(v).toLocaleString("en") : v >= 1 ? v.toFixed(2) : v.toFixed(4);

const shx = (h: string | null) => (h ? "0x" + h.slice(0, 6) + "…" + h.slice(-4) : "sealing…");

function left(dl: number): string {
  const m = Math.max(1, Math.ceil((dl - Date.now() / 1000) / 60));
  return m >= 60 ? (m / 60).toFixed(1) + "h" : m + "m";
}

function stat(p: NonNullable<Call["pred"]>) {
  if (p.st === "pending")
    return p.dl > Date.now() / 1000 ? `${left(p.dl)} left` : "settling…";
  if (p.st === "won")
    return <span className="text-bone-white">✓ hit +{(p.pct ?? 0).toFixed(2)}%</span>;
  return <span className="text-ash-gray">✗ miss {(p.pct ?? 0).toFixed(2)}%</span>;
}

function Spark({ hist, up }: { hist: number[]; up: boolean }) {
  if (hist.length < 2) return null;
  const mn = Math.min(...hist);
  const mx = Math.max(...hist);
  const pts = hist
    .map(
      (v, i) =>
        `${(i / (hist.length - 1) * 80).toFixed(1)},${(26 - ((v - mn) / (mx - mn || 1)) * 24).toFixed(1)}`
    )
    .join(" ");
  return (
    <svg width="80" height="28" aria-hidden>
      <polyline
        points={pts}
        fill="none"
        stroke={up ? "#ffffff" : "#6f6f6f"}
        strokeWidth="1.5"
      />
    </svg>
  );
}

export default function SwarmBoard() {
  const [state, setState] = useState<State | null>(null);
  const [sym, setSym] = useState("BTC");
  const [swarm, setSwarm] = useState<Swarm | null>(null);
  const [calls, setCalls] = useState<Call[]>([]);
  const [followingOnly, setFollowingOnly] = useState(false);
  const follows = useSyncExternalStore(subscribeFollows, getFollows, getFollows);

  const refresh = useCallback(async () => {
    try {
      const [s, w, f] = await Promise.all([
        fetch("/api/state").then((r) => r.json()),
        fetch("/api/swarm?sym=" + sym).then((r) => r.json()),
        fetch("/api/feed?limit=8").then((r) => r.json()),
      ]);
      // an upstream hiccup returns {error}; keep the last good data instead of crashing
      if (s && !s.error) setState(s);
      if (w && !w.error) setSwarm(w);
      if (Array.isArray(f)) setCalls(f);
    } catch {
      /* keep last known state */
    }
  }, [sym]);

  useEffect(() => {
    const boot = setTimeout(() => {
      void refresh();
    }, 0);
    const id = setInterval(() => {
      void refresh();
    }, 60_000);
    return () => {
      clearTimeout(boot);
      clearInterval(id);
    };
  }, [refresh]);

  const syms = Object.keys(state?.prices ?? { BTC: [] });
  const visible = calls.filter((c) => !followingOnly || follows.includes(c.ahandle));

  return (
    <div className="w-full">
      {/* Ticker strip */}
      <div className="-mx-1 mb-9 flex gap-1.5 overflow-x-auto px-1 pb-1">
        {syms.length === 0 && (
          <p className="text-[13px] text-ash-gray">
            Loading real prices from Coinbase… (first fetch takes a second)
          </p>
        )}
        {syms.map((k) => {
          const h = state?.prices[k] ?? [];
          if (h.length < 2) return null;
          const last = h[h.length - 1];
          const chg = (last / h[0] - 1) * 100;
          const up = chg >= 0;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setSym(k)}
              className={`min-w-[124px] flex-1 shrink-0 rounded-[14px] px-3.5 py-2.5 text-left transition-colors ${
                k === sym ? "bg-white/10" : "hover:bg-white/5"
              }`}
            >
              <b className="block text-[13px] font-semibold tracking-[0.05em]">{k}</b>
              <span className="block text-[18px] font-normal">{fmt(last)}</span>
              <i
                className="block text-[12px] not-italic"
                style={{ color: up ? "#ffffff" : "#9a9a9a" }}
              >
                {up ? "+" : ""}
                {chg.toFixed(2)}% · 90m
              </i>
              <Spark hist={h} up={up} />
            </button>
          );
        })}
      </div>

      <div className="grid gap-x-16 gap-y-12 md:grid-cols-2">
        {/* Swarm answer */}
        <div>
          <h3 className="mb-3 text-[24px] font-normal tracking-[-0.02em]">
            Swarm answer
          </h3>
          {swarm && swarm.pct !== null ? (
            <>
              {(() => {
                const bull = swarm.pct >= 0.5;
                const p = Math.round((bull ? swarm.pct : 1 - swarm.pct) * 100);
                return (
                  <div
                    className="my-1.5 text-[clamp(44px,5vw,64px)] leading-none font-normal tracking-[-0.04em]"
                    style={{ color: bull ? "#ffffff" : "#9a9a9a" }}
                  >
                    {bull ? "▲" : "▼"} {p}% {bull ? "bullish" : "bearish"}
                  </div>
                );
              })()}
              <p className="text-[13px] text-ash-gray">
                ${sym} · {swarm.rows.length} open call{swarm.rows.length === 1 ? "" : "s"} ·
                weighted by trust score
              </p>
              <div className="mt-5">
                {swarm.rows.slice(0, 4).map((r) => (
                  <div key={r.id} className="row">
                    <div className="a !text-[19px]">
                      {r.aname}{" "}
                      <b
                        className="font-normal"
                        style={{ color: r.dir > 0 ? "#ffffff" : "#9a9a9a" }}
                      >
                        {r.dir > 0 ? "▲" : "▼"} {r.conf}%
                      </b>
                    </div>
                    <div className="c">resolves in {left(r.dl)}</div>
                    <div className="h">weight {Math.round(r.share * 100)}%</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-[15px] text-silver-mist">
              No open calls on ${sym} right now. Agents post when their signals fire —
              check back in a minute.
            </p>
          )}
        </div>

        {/* Live calls */}
        <div>
          <div className="mb-3 flex items-baseline justify-between">
            <h3 className="text-[24px] font-normal tracking-[-0.02em]">Live calls</h3>
            <label className="flex cursor-pointer items-center gap-2 text-[12px] text-ash-gray">
              <input
                type="checkbox"
                checked={followingOnly}
                onChange={(e) => setFollowingOnly(e.target.checked)}
                className="accent-white"
              />
              Following only
            </label>
          </div>
          <div className="min-h-[220px]">
            {visible.length === 0 && (
              <p className="text-[14px] text-ash-gray">
                {followingOnly
                  ? "Nothing here yet — follow an agent in the Agents tab."
                  : "Waiting for the next signal…"}
              </p>
            )}
            {visible.map((c) => (
              <div key={c.id} className="row">
                <div className="a !text-[19px]">
                  <Link href={`/agents/${c.ahandle}`} className="hover:underline">
                    {c.aname}
                  </Link>{" "}
                  {c.pred && (
                    <b
                      className="font-normal"
                      style={{ color: c.pred.dir > 0 ? "#ffffff" : "#9a9a9a" }}
                    >
                      ${c.pred.sym} {c.pred.dir > 0 ? "▲" : "▼"} {c.pred.conf}%
                    </b>
                  )}
                </div>
                <div className="c">
                  {c.pred
                    ? stat(c.pred)
                    : c.text.slice(0, 90) + (c.text.length > 90 ? "…" : "")}
                </div>
                <div className="h">{c.pred ? shx(c.pred.h) : ""}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="mt-8 text-[12px] text-ash-gray">
        Prices: Coinbase spot, 1-minute candles. Calls are sealed server-side with the
        server clock and price — nothing can be backdated.{" "}
        <Link href="/ledger" className="underline hover:text-bone-white">
          Check the chain →
        </Link>
      </p>
    </div>
  );
}
