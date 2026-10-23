import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import AskBox from "@/components/AskBox";
import { api } from "@/lib/api";

export const metadata = {
  title: "Watchlist — Coreum",
  description: "Tokens the Coreum network re-checks every hour, and the alerts it raised: liquidity pulled, deployer sold, owner appeared, honeypot.",
};

type Snap = { liquidity?: number | null; fdv?: number | null; curve?: number | null; graduated?: boolean | null; owner?: string; top10?: number | null };
type Token = { address: string; name: string; symbol: string; image: string; watchers: number; snap: Snap | null; snap_at: number | null; last_job: number | null };
type Alert = { id: number; address: string; ts: number; kind: string; severity: "danger" | "warn" | "good"; detail: string; job: number | null; symbol: string | null; image: string | null };

const ago = (t: number | null) => {
  if (!t) return "—";
  const s = Math.max(0, Date.now() / 1000 - t);
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};
const usd = (v?: number | null) => (v == null ? "—" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`);
const MARK = { danger: "🚩", warn: "⚠️", good: "✅" } as const;

function Avatar({ image, symbol }: { image?: string | null; symbol?: string | null }) {
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt="" width={36} height={36} className="h-9 w-9 rounded-full grayscale" />
  ) : (
    <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-[11px]">{(symbol || "?").slice(0, 3)}</span>
  );
}

async function Board() {
  await connection();
  let data: { tokens: Token[]; alerts: Alert[] } = { tokens: [], alerts: [] };
  try {
    data = await api("/api/watch");
  } catch {}
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.2fr]">
      <section>
        <h2 className="text-[24px] text-white">Alerts</h2>
        <p className="mt-1 text-[13px] text-white/50">Raised when the hourly check sees a dangerous change. A 🚩 sends the token back to the cores.</p>
        <div className="mt-4 flex flex-col gap-2">
          {data.alerts.length === 0 && (
            <p className="rounded-[14px] border border-white/[0.1] p-4 text-[14px] text-white/55">No alerts yet — quiet is good.</p>
          )}
          {data.alerts.map((a) => (
            <div key={a.id} className="glass-fx flex items-start gap-3 rounded-[14px] border border-white/[0.1] bg-white/[0.04] p-4 backdrop-blur-[20px]">
              <span className="text-[18px] leading-none">{MARK[a.severity]}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] text-white">
                  <span className="font-medium">${a.symbol ?? a.address.slice(0, 8)}</span> · {a.detail}
                </div>
                <div className="mt-1 text-[12px] text-white/45">
                  {ago(a.ts)}
                  {a.job && (
                    <>
                      {" · "}
                      <Link href={`/v/${a.job}`} className="underline decoration-white/25 underline-offset-4 hover:text-white">
                        fresh verdict
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-[24px] text-white">Watching · {data.tokens.length}</h2>
        <p className="mt-1 text-[13px] text-white/50">Liquidity, value and owner every hour; holders and deployer share for the stalest few each hour.</p>
        <div className="mt-4 flex flex-col gap-2">
          {data.tokens.length === 0 && (
            <p className="rounded-[14px] border border-white/[0.1] p-4 text-[14px] text-white/55">
              Nothing on the watchlist yet. Run a <Link href="/token" className="underline">Token Check</Link> and press “Watch this token”.
            </p>
          )}
          {data.tokens.map((t) => (
            <Link
              key={t.address}
              href={t.last_job ? `/v/${t.last_job}` : `https://www.geckoterminal.com/robinhood/tokens/${t.address}`}
              className="glass-fx grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-[14px] border border-white/[0.1] bg-white/[0.04] p-4 backdrop-blur-[20px] transition-colors hover:border-white/30 md:grid-cols-[36px_1fr_1.4fr_auto]"
            >
              <Avatar image={t.image} symbol={t.symbol} />
              <div className="min-w-0">
                <div className="truncate text-[14px] text-white">
                  {t.name} <span className="text-white/50">${t.symbol}</span>
                </div>
                <div className="text-[12px] text-white/45">
                  {t.watchers} watching · checked {ago(t.snap_at)}
                </div>
              </div>
              <div className="hidden gap-4 font-mono text-[12px] text-white/60 md:flex">
                <span>liq {usd(t.snap?.liquidity)}</span>
                <span>val {usd(t.snap?.fdv)}</span>
                <span>{t.snap?.graduated ? "on DEX" : t.snap?.curve != null ? `curve ${t.snap.curve.toFixed(0)}%` : ""}</span>
              </div>
              <span className="text-[12px] text-white/50">{t.snap?.owner && t.snap.owner !== "none" && t.snap.owner !== "renounced" ? "owner active" : "no owner"}</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

export default function WatchPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/watch" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="flex items-center gap-2 text-[13px] text-white/60">
          <span className="live-dot" /> Watchlist · re-checked every hour
        </p>
        <h1 className="mt-3 text-[clamp(40px,6vw,72px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          One check is a snapshot. <span className="text-white/45">This is the film.</span>
        </h1>
        <p className="mt-6 max-w-[680px] text-[17px] leading-relaxed text-white/75">
          Put any Robinhood Chain token on the watchlist. Every hour the network compares it with the last check and raises an alert
          when liquidity is pulled, the deployer sells, an owner appears or it turns into a honeypot — and dangerous changes go
          straight back to the six cores for a fresh verdict, sealed on chain.
        </p>
        <div className="mt-8 max-w-[760px]">
          <AskBox placeholder="Paste a token to check it, then press Watch — 0x…" cta="Check token" examples={[]} />
        </div>
        <div className="mt-14">
          <Suspense fallback={<p className="text-white/55">Reading the watchlist…</p>}>
            <Board />
          </Suspense>
        </div>
        <p className="mt-10 text-[12px] text-white/40">A risk screen from public on-chain facts — not an audit and not financial advice.</p>
      </div>
    </main>
  );
}
