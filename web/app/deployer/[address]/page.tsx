import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import { passport } from "@/lib/passport";
import { isAddress, SITE } from "@/lib/publicApi";

export const metadata = {
  title: "Deployer passport — Coreum",
  description: "Everything one wallet launched on Pons and what became of it, read from Robinhood Chain.",
};

const date = (t: number | null) => (t ? new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");
const usd = (v: number | null) => (v == null ? "—" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(0)}`);
const TONE = { good: "border-white bg-white text-black", warn: "border-white/50 text-white", bad: "border-white/70 bg-white/10 text-white", info: "border-white/25 text-white/80" };
const STATUS = { graduated: "reached a DEX", dead: "dead · under $1K", live: "alive", new: "under a day old" };

async function Body({ params }: { params: Promise<{ address: string }> }) {
  await connection();
  const address = (await params).address.toLowerCase();
  if (!isAddress(address)) return <p className="mt-10 text-white/70">That is not a wallet address.</p>;
  const p = await passport(address).catch(() => null);
  if (!p) return <p className="mt-10 text-white/70">Could not read this wallet right now — try again in a minute.</p>;

  const url = `${SITE}/deployer/${address}`;
  const tweet = `Deployer passport on @0xcoreum: ${p.launches} Pons launch${p.launches === 1 ? "" : "es"}, ${p.graduated} reached a DEX.${p.badges[0] ? ` ${p.badges[0].label}.` : ""}`;
  const share = `https://x.com/intent/post?text=${encodeURIComponent(tweet)}&url=${encodeURIComponent(url)}`;
  return (
    <>
      <h1 className="mt-3 font-mono text-[clamp(22px,3.4vw,40px)] break-all text-white">{address}</h1>
      <div className="mt-5 flex flex-wrap gap-2">
        {p.badges.map((b) => (
          <span key={b.label} title={b.why} className={`rounded-full border px-3.5 py-1.5 text-[13px] ${TONE[b.tone]}`}>
            {b.label}
          </span>
        ))}
      </div>
      <ul className="mt-3 space-y-1 text-[14px] text-white/60">
        {p.badges.map((b) => (
          <li key={b.label}>
            <b className="font-medium text-white/85">{b.label}:</b> {b.why}
          </li>
        ))}
      </ul>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          [p.launches.toLocaleString("en-US"), "Pons launches"],
          [String(p.graduated), "reached a DEX"],
          [p.sample.checked ? `${p.sample.dead} / ${p.sample.checked}` : "—", "of the latest are dead"],
          [date(p.first_launch), "first launch"],
        ].map(([v, k]) => (
          <div key={k} className="glass-fx rounded-[18px] border border-white/[0.12] bg-white/[0.04] p-5 backdrop-blur-[20px]">
            <div className="text-[28px] leading-none text-white">{v}</div>
            <div className="mt-2 text-[13px] text-white/55">{k}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <a href={share} target="_blank" rel="noopener noreferrer" className="btn-primary">
          Share on X
        </a>
        <a href={`https://robinhoodchain.blockscout.com/address/${address}`} target="_blank" rel="noopener noreferrer" className="btn-outline">
          Blockscout ↗
        </a>
      </div>

      {p.tokens.length > 0 && (
        <section className="mt-14">
          <h2 className="text-[26px] text-white">Launches</h2>
          <p className="mt-1 text-[13px] text-white/50">
            Newest first{p.launches > p.tokens.length ? `, latest ${p.tokens.length} of ${p.launches.toLocaleString("en-US")}` : ""}. Value
            checked for the latest 30.
          </p>
          <div className="mt-5 flex flex-col gap-2">
            {p.tokens.map((t) => (
              <Link
                key={t.token}
                href={`/t/${t.token}`}
                className="glass-fx grid grid-cols-[36px_1fr_auto] items-center gap-4 rounded-[14px] border border-white/[0.1] bg-white/[0.04] px-4 py-3 backdrop-blur-[20px] transition-colors hover:border-white/30 sm:grid-cols-[36px_1fr_140px_150px]"
              >
                {t.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={t.image} alt="" width={36} height={36} className="h-9 w-9 rounded-full" />
                ) : (
                  <span className="grid h-9 w-9 place-items-center rounded-full border border-white/20 text-[10px] text-white/60">{(t.symbol || "?").slice(0, 3)}</span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-[14px] text-white">
                    {t.name || t.token.slice(0, 10)} {t.symbol && <span className="text-white/50">${t.symbol}</span>}
                  </div>
                  <div className="font-mono text-[12px] text-white/45">{date(t.ts)}</div>
                </div>
                <div className="hidden text-right font-mono text-[13px] text-white/70 sm:block">{usd(t.fdv)}</div>
                <div className={`text-right text-[13px] ${t.status === "graduated" ? "text-white" : t.status === "dead" ? "text-white/45" : "text-white/70"}`}>
                  {STATUS[t.status]}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
      <p className="mt-10 text-[12px] text-white/40">
        Read from the Pons factory&apos;s events on Robinhood Chain, synced hourly. A record of launches, not a judgement of a person.
      </p>
    </>
  );
}

export default function DeployerPage({ params }: { params: Promise<{ address: string }> }) {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/deployer" />
      <div className="mx-auto max-w-[1100px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">Deployer passport · every Pons launch from one wallet</p>
        <Suspense fallback={<p className="mt-10 text-white/55">Reading the chain…</p>}>
          <Body params={params} />
        </Suspense>
      </div>
    </main>
  );
}
