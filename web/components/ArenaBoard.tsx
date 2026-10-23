"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { verdict, type Arena } from "@/lib/play";

const pct = (v: number | null) => (v == null ? "—" : `${Math.round(v * 100)}%`);

export default function ArenaBoard() {
  const [a, setA] = useState<Arena | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/arena")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then(setA)
        .catch(() => {});
    load();
    const id = setInterval(load, 30_000);
    return () => clearInterval(id);
  }, []);

  const h = a?.humans.acc ?? null;
  const m = a?.ai.acc ?? null;
  const lead = h != null && m != null ? (h > m ? "humans" : h < m ? "ai" : "tie") : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Humans vs AI */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[24px] bg-white/10">
        {[
          { k: "Humans", v: h, n: a?.humans.n, sub: `${a?.humans.players ?? 0} players`, me: lead === "humans" },
          { k: "AI nodes", v: m, n: a?.ai.n, sub: "trust-weighted swarm", me: lead === "ai" },
        ].map((s) => (
          <div key={s.k} className={`glass-fx bg-white/[0.06] border border-white/[0.12] backdrop-blur-[20px] p-6 ${s.me ? "bg-saffron-spark/[0.06]" : ""}`}>
            <div className="flex items-center justify-between text-caption-label text-ash-gray">
              {s.k}
              {s.me && <span className="text-saffron-spark">leading</span>}
            </div>
            <div className={`mt-2 font-mono text-[44px] leading-none tracking-[-0.04em] ${s.me ? "text-saffron-spark" : "text-bone-white"}`}>
              {pct(s.v)}
            </div>
            <div className="mt-2 font-mono text-[12px] text-ash-gray">
              {s.n ?? 0} settled · {s.sub}
            </div>
          </div>
        ))}
      </div>
      <p className="-mt-2 text-[12px] text-ash-gray">
        Hit rate over the last 7 days, misses included.{" "}
        {a && a.humans.beat > 0 && (
          <span className="text-saffron-spark">
            {a.humans.beat} call{a.humans.beat > 1 ? "s" : ""} beat the swarm head-on.
          </span>
        )}
      </p>

      {/* Top players */}
      <div>
        <p className="text-caption-label text-ash-gray">Top players · min 3 settled</p>
        <div className="mt-2">
          {(a?.top ?? []).map((t, i) => (
            <div key={t.player} className="flex items-center justify-between border-b border-white/[0.08] py-3">
              <span className="flex items-baseline gap-4">
                <span className="font-mono text-[12px] text-ash-gray">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[17px] text-bone-white">{t.name}</span>
                {t.beat > 0 && <span className="font-mono text-[11px] text-saffron-spark">beat AI ×{t.beat}</span>}
              </span>
              <span className="font-mono text-[14px] text-bone-white">
                {t.h}/{t.n} · <span className="text-saffron-spark">{Math.round((t.h / t.n) * 100)}%</span>
              </span>
            </div>
          ))}
          {a && a.top.length === 0 && (
            <p className="py-4 text-[14px] text-ash-gray">Nobody has 3 settled calls yet — the #1 spot is open.</p>
          )}
        </div>
      </div>

      {/* Recent calls */}
      <div>
        <p className="text-caption-label text-ash-gray">Latest human calls</p>
        <div className="mt-2">
          {(a?.recent ?? []).slice(0, 8).map((p) => (
            <Link
              key={p.id}
              href={`/play/${p.id}`}
              className="flex items-center justify-between border-b border-white/[0.08] py-3 font-mono text-[13px] transition-colors hover:bg-white/[0.03]"
            >
              <span className="text-bone-white">
                {p.name} <span className={p.dir > 0 ? "text-saffron-spark" : "text-white/45"}>{p.dir > 0 ? "▲" : "▼"} ${p.sym}</span>
              </span>
              <span className={p.st === "hit" ? "text-saffron-spark" : p.st === "miss" ? "text-white/45" : "text-ash-gray"}>
                {verdict(p)}
              </span>
            </Link>
          ))}
          {a && a.recent.length === 0 && <p className="py-4 text-[14px] text-ash-gray">No calls yet. Be the first.</p>}
        </div>
      </div>
    </div>
  );
}
