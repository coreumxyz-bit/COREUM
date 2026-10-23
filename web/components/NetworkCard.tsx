"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Animate from "@/components/Animate";
import { verdictLabel, type Job, type NetworkStats } from "@/lib/verify";

type Recent = {
  id: number;
  q: string;
  phase: string;
  verdict: Job["verdict"];
  agree: number | null;
  n: number | null;
  src?: string | Job["src"];
};

// a token check reads "$SYM · token check"; an X post shows its author; anything else its question
function title(r: Recent) {
  const src = (
    typeof r.src === "string" ? JSON.parse(r.src) : r.src
  ) as Job["src"] & { kind?: string; symbol?: string; handle?: string };
  if (src?.kind === "token")
    return { text: `$${src.symbol} · token check`, src };
  if (src?.handle) return { text: `@${src.handle} · X post check`, src };
  return { text: r.q, src: null };
}

// Glass card: the network's last sealed answers, refreshed live.
export default function NetworkCard() {
  const [stats, setStats] = useState<NetworkStats | null>(null);
  const [recent, setRecent] = useState<Recent[]>([]);

  useEffect(() => {
    const load = () => {
      fetch("/api/network")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => j && !j.error && setStats(j))
        .catch(() => {});
      fetch("/api/jobs?limit=5")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => Array.isArray(j) && setRecent(j))
        .catch(() => {});
    };
    load();
    const id = setInterval(load, 15_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Animate
      delay={900}
      direction="scale"
      className="mx-auto w-full max-w-[440px] lg:mx-0"
    >
      <div className="float glass-fx w-full rounded-[24px] border border-white/[0.12] bg-white/[0.06] p-5 pb-5 backdrop-blur-[20px] sm:rounded-[33px] sm:p-8 sm:pb-6">
        <p className="flex items-center gap-2 text-[16px] leading-[20px] font-[450] text-white sm:text-[20px]">
          <span className="live-dot" /> Network
        </p>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            ["sealed", stats?.done ?? "—"],
            ["agree", stats ? `${Math.round(stats.agree * 100)}%` : "—"],
            ["cores", stats ? stats.ref + stats.community_online : "—"],
          ].map(([k, v]) => (
            <div key={String(k)}>
              <div className="font-mono text-[26px] leading-none text-white sm:text-[34px]">
                {v}
              </div>
              <div className="mt-1 text-[12px] text-white/55">{k}</div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex flex-col">
          {recent.map((r) => {
            const t = title(r);
            return (
              <Link
                key={r.id}
                href={`/v/${r.id}`}
                className="row-in flex items-center justify-between gap-3 border-t border-white/[0.08] py-3 transition-colors hover:bg-white/[0.03]"
              >
                <span className="line-clamp-1 text-[13px] text-white/80">
                  {t.text}
                </span>
                <span className="shrink-0 font-mono text-[13px] text-white">
                  {verdictLabel(t.src, r.verdict) ?? "—"}
                  {r.agree != null && (
                    <span className="ml-1 text-white/45">
                      {Math.round(r.agree * 100)}%
                    </span>
                  )}
                </span>
              </Link>
            );
          })}
          {recent.length === 0 && (
            <p className="border-t border-white/[0.08] py-3 text-[13px] text-white/55">
              No answers sealed yet — ask the first one.
            </p>
          )}
        </div>
      </div>
    </Animate>
  );
}
