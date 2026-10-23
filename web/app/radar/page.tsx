import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import { api } from "@/lib/api";
import { verdictLabel, type TokenSrc, type Verdict } from "@/lib/verify";

export const metadata = {
  title: "Pons Radar — Coreum",
  description: "Every hour Coreum checks the most active new Pons launches for rug-pull red flags. Six AI cores, verdicts sealed on Robinhood Chain.",
};

type Check = { id: number; verdict: Verdict; agree: number; n: number; done_at: number; src: TokenSrc };
type Radar = { tally: { total: number; radar: number; YES: number; NO: number; UNSURE: number }; checks: Check[] };

const ago = (t: number) => {
  const s = Math.max(0, Date.now() / 1000 - t);
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};
const usd = (n: unknown) => {
  const v = typeof n === "number" ? n : null;
  return v == null ? "—" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`;
};
const pct = (n: unknown) => (typeof n === "number" ? `${n.toFixed(0)}%` : "—");

async function Feed() {
  await connection();
  let data: Radar = { tally: { total: 0, radar: 0, YES: 0, NO: 0, UNSURE: 0 }, checks: [] };
  try {
    data = await api<Radar>("/api/radar");
  } catch {}
  const t = data.tally;
  const summary = `Pons Radar, last 24h: ${t.total} new launches checked by 5 AIs — ${t.YES} no red flags, ${t.NO} red flags, ${t.UNSURE} mixed. Every verdict sealed on Robinhood Chain:`;
  const share = `https://x.com/intent/post?text=${encodeURIComponent(summary)}&url=${encodeURIComponent("https://www.coreum.xyz/radar")}`;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            [String(t.total), "checked in 24h"],
            [String(t.YES), "no red flags"],
            [String(t.NO), "red flags"],
            [String(t.UNSURE), "mixed"],
          ] as const
        ).map(([v, k]) => (
          <div key={k} className="glass-fx rounded-[18px] border border-white/[0.12] bg-white/[0.04] p-5 backdrop-blur-[20px]">
            <div className="font-mono text-[34px] leading-none text-white">{v}</div>
            <div className="mt-2 text-[13px] text-white/55">{k}</div>
          </div>
        ))}
      </div>
      <div className="mt-4">
        <a href={share} target="_blank" rel="noopener noreferrer" className="btn-outline">
          Share today&apos;s radar on X
        </a>
      </div>

      <div className="mt-10 flex flex-col gap-2">
        {data.checks.length === 0 && <p className="text-[14px] text-white/55">The first radar sweep runs at the top of the hour.</p>}
        {data.checks.map((r) => {
          const f = r.src.facts;
          return (
            <Link
              key={r.id}
              href={`/v/${r.id}`}
              className="glass-fx grid grid-cols-[40px_1fr_auto] items-center gap-4 rounded-[16px] border border-white/[0.1] bg-white/[0.04] p-4 backdrop-blur-[20px] transition-colors hover:border-white/30 md:grid-cols-[40px_1.2fr_1.6fr_auto]"
            >
              {r.src.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.src.image} alt="" width={40} height={40} className="h-10 w-10 rounded-full grayscale" />
              ) : (
                <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-[12px]">{r.src.symbol.slice(0, 3)}</span>
              )}
              <div className="min-w-0">
                <div className="truncate text-[15px] text-white">
                  {r.src.name} <span className="text-white/50">${r.src.symbol}</span>
                </div>
                <div className="truncate font-mono text-[12px] text-white/45">
                  {r.src.via === "radar" ? "radar" : "asked"} · {ago(r.done_at)}
                </div>
              </div>
              <div className="hidden gap-5 font-mono text-[12px] text-white/60 md:flex">
                <span>top10 {pct(f.top10)}</span>
                <span>liq {usd(f.liquidity)}</span>
                <span>vol {usd(f.volume24)}</span>
                <span>curve {f.graduated ? "done" : pct(f.curve)}</span>
              </div>
              <div className="text-right">
                <div className="font-mono text-[14px] text-white">{verdictLabel(r.src, r.verdict)}</div>
                <div className="text-[12px] text-white/45">
                  {Math.round(r.agree * 100)}% · {r.n} cores
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </>
  );
}

export default function RadarPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/radar" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="flex items-center gap-2 text-[13px] text-white/60">
          <span className="live-dot" /> Pons Radar · every hour
        </p>
        <h1 className="mt-3 text-[clamp(40px,6vw,72px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          New on Pons. <span className="text-white/45">Checked by 5 AIs.</span>
        </h1>
        <p className="mt-6 max-w-[680px] text-[17px] leading-relaxed text-white/75">
          Every hour the network picks the most active fresh Pons launches — 20 minutes to 48 hours old, at least $2K traded — and
          runs a Token Check on each: holders, deployer share and past launches, honeypot, owner, liquidity, curve. Six independent AI cores judge
          the facts; every verdict is sealed on Robinhood Chain.
        </p>
        <p className="mt-3 text-[12px] text-white/45">
          A risk screen from public on-chain facts — not an audit and not financial advice. Want a token checked now?{" "}
          <Link href="/token" className="text-white/70 underline decoration-white/25 underline-offset-4">
            Token Check
          </Link>
          .
        </p>
        <div className="mt-10">
          <Suspense fallback={<p className="text-white/55">Reading the radar…</p>}>
            <Feed />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
