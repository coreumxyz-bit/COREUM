import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import { api } from "@/lib/api";
import data from "@/lib/ponsCensus.json";

export const metadata = {
  title: "Pons census — Coreum",
  description: "Every token ever launched on Pons, read from Robinhood Chain and updated every hour: how many reach a DEX, how many are abandoned, who launches the most.",
};

// What the Worker keeps current (api/src/pons.js), refreshed hourly by api/scripts/pons-sync.mjs
type Live = {
  updated: number;
  scanned_to: number;
  launches: number;
  graduated: number;
  creators: number;
  creators_one_launch: number;
  first_launch: number;
  graduation_median_s: number | null;
  serial_wallets: number;
  serial_wallet_launches: number;
  top_wallet_launches: number;
  shared_launchers: number;
  shared_launcher_launches: number;
  sample: { at: number; size: number; graduated: number; under_0_01: number; under_0_1: number } | null;
  days: { day: string; n: number; g: number; c: number }[];
};

const ex = data.examples;
const BS = "https://robinhoodchain.blockscout.com";
const GT = "https://www.geckoterminal.com/robinhood/tokens";
const n = (v: number) => v.toLocaleString("en-US");
const pct = (a: number, b: number, d = 1) => (b ? ((100 * a) / b).toFixed(d) : "0") + "%";
const short = (a: string) => `${a.slice(0, 8)}…${a.slice(-4)}`;
const date = (t: number) => new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
const ago = (t: number) => {
  const s = Math.max(0, Date.now() / 1000 - t);
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
};

const ext = { target: "_blank", rel: "noopener noreferrer" } as const;
const link = "underline decoration-white/30 underline-offset-4 hover:text-white";

function Stat({ big, label }: { big: string; label: string }) {
  return (
    <div className="glass-fx rounded-[18px] border border-white/[0.12] bg-white/[0.04] p-5 backdrop-blur-[20px]">
      <div className="text-[34px] leading-none tracking-tight text-white">{big}</div>
      <div className="mt-2 text-[14px] leading-snug text-white/60">{label}</div>
    </div>
  );
}

function Step({ n: i, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="border-t border-white/10 pt-6">
      <p className="font-mono text-[12px] text-white/45">{i}</p>
      <h3 className="mt-1 text-[20px] text-white">{title}</h3>
      <div className="mt-2 text-[15px] leading-relaxed text-white/70">{children}</div>
    </div>
  );
}

async function Census() {
  await connection();
  let s: Live | null = null;
  try {
    s = await api<Live>("/api/pons");
  } catch {}
  if (!s?.launches) return <p className="mt-10 text-white/55">The census is being read from the chain — check back in a few minutes.</p>;

  const notGrad = (100 - (100 * s.graduated) / s.launches).toFixed(1);
  const days = Math.max(1, (s.updated - s.first_launch) / 86400);
  const sample = s.sample?.size ? s.sample : null;
  return (
    <>
      <h1 className="mt-3 text-[clamp(44px,7vw,92px)] leading-[0.92] text-white" style={{ fontFamily: "var(--font-sans)" }}>
        {notGrad}% of Pons tokens <span className="text-white/45">never reach a DEX.</span>
      </h1>
      <p className="mt-6 max-w-[700px] text-[17px] leading-relaxed text-white/75">
        We read every token ever launched through the Pons launchpad — {n(s.launches)} of them since {date(s.first_launch)} —
        straight from the factory contract&apos;s events, and keep reading every hour. Here is what happens to them.
      </p>
      <p className="mt-4 flex items-center gap-2 text-[13px] text-white/55">
        <span className="live-dot" /> Updated {ago(s.updated)} · block {n(s.scanned_to)}
      </p>

      <div className="mt-10 grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat big={n(s.launches)} label={`tokens launched · ~${n(Math.round(s.launches / days))} a day`} />
        <Stat big={n(s.graduated)} label={`graduated to a DEX · ${pct(s.graduated, s.launches)}`} />
        {sample ? (
          <Stat big={pct(sample.under_0_01, sample.size)} label={`hold under 0.01 ETH in their curve (sample of ${n(sample.size)})`} />
        ) : (
          <Stat big="—" label="curve sample runs once a day" />
        )}
        <Stat
          big={s.graduation_median_s == null ? "—" : `~${Math.max(1, Math.round(s.graduation_median_s / 60))} min`}
          label="median time from launch to DEX for those that graduate"
        />
        <Stat big={n(s.serial_wallets)} label={`wallets launched 20+ tokens · ${n(s.serial_wallet_launches)} launches between them`} />
        <Stat big={n(s.top_wallet_launches)} label="tokens launched by a single wallet" />
        <Stat big={n(s.creators)} label={`creator wallets · ${pct(s.creators_one_launch, s.creators)} launched once`} />
        <Stat big={n(s.shared_launcher_launches)} label={`launches through ${n(s.shared_launchers)} shared launcher contracts`} />
      </div>

      <div className="mt-10 flex flex-wrap items-center gap-4">
        <Link href="/token" className="btn-primary">
          Check a token before you buy
        </Link>
        <span className="text-[14px] text-white/55">Six AI cores, the deployer&apos;s past launches, a verdict sealed on-chain.</span>
      </div>

      <section className="mt-20">
        <h2 className="text-[30px] leading-tight text-white">Day by day</h2>
        <p className="mt-2 text-[14px] text-white/55">UTC days, newest first. Today&apos;s row grows every hour.</p>
        <div className="glass-fx mt-6 overflow-x-auto rounded-[18px] border border-white/[0.12] bg-white/[0.03] backdrop-blur-[20px]">
          <table className="w-full min-w-[560px] text-left text-[14px]">
            <thead>
              <tr className="border-b border-white/10 text-[12px] tracking-[0.08em] text-white/45 uppercase">
                <th className="px-5 py-3 font-normal">Day</th>
                <th className="px-5 py-3 text-right font-normal">Launches</th>
                <th className="px-5 py-3 text-right font-normal">Reached a DEX</th>
                <th className="px-5 py-3 text-right font-normal">Rate</th>
                <th className="px-5 py-3 text-right font-normal">Creators</th>
              </tr>
            </thead>
            <tbody className="font-mono">
              {s.days.slice(0, 45).map((d, i) => (
                <tr key={d.day} className="border-b border-white/[0.06] last:border-0">
                  <td className="px-5 py-2.5 text-white/85">
                    {d.day}
                    {i === 0 && <span className="ml-2 font-sans text-[11px] text-white/45">today</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-white">{n(d.n)}</td>
                  <td className="px-5 py-2.5 text-right text-white/85">{n(d.g)}</td>
                  <td className="px-5 py-2.5 text-right text-white/85">{pct(d.g, d.n, 2)}</td>
                  <td className="px-5 py-2.5 text-right text-white/60">{n(d.c)}</td>
                </tr>
              ))}
              <tr className="border-t border-white/15 bg-white/[0.03]">
                <td className="px-5 py-3 font-sans text-white">All time</td>
                <td className="px-5 py-3 text-right text-white">{n(s.launches)}</td>
                <td className="px-5 py-3 text-right text-white">{n(s.graduated)}</td>
                <td className="px-5 py-3 text-right text-white">{pct(s.graduated, s.launches, 2)}</td>
                <td className="px-5 py-3 text-right text-white/60">{n(s.creators)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        {s.days.length > 45 && <p className="mt-3 text-[12px] text-white/40">Showing the latest 45 days of {s.days.length}.</p>}
      </section>

      <section className="mt-20 max-w-[820px]">
        <h2 className="text-[30px] leading-tight text-white">Method</h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-white/70">
          <li>
            <b className="font-medium text-white">Launches</b> — every <code>TokenCreated(token, curve, creator)</code> event of the
            Pons factory from block 27,027,321 (its first launch) to block {n(s.scanned_to)}. Counted in full, re-read every hour.
          </li>
          <li>
            <b className="font-medium text-white">Graduations</b> — every graduation event of the factory (the curve hit its 4.2 ETH
            target and moved to a DEX). Counted in full; a random 10 were cross-checked with GeckoTerminal and all matched.
          </li>
          <li>
            <b className="font-medium text-white">Curve balances</b> — once a day, the ETH held by the bonding curves of{" "}
            {sample ? n(sample.size) : "2,000"} random launches older than two days
            {sample ? ` (last sample ${ago(sample.at)})` : ""}. For a share near 97% that is good to about ±1 point.
          </li>
          <li>
            <b className="font-medium text-white">Creators</b> — the creator is the wallet in the launch event. Creators with 20+
            launches are checked: wallets and contracts (shared launchers many people use) are counted separately.
          </li>
          <li>
            <b className="font-medium text-white">Days</b> — launch times come from block timestamps, interpolated between sampled
            blocks, so a launch right at midnight may land on the neighbouring day.
          </li>
        </ul>
        <p className="mt-6 text-[13px] text-white/45">Statistics only — nothing here says any particular token or wallet is a scam.</p>
      </section>
    </>
  );
}

export default function PonsPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/pons" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">Pons census · read from Robinhood Chain · updated every hour</p>
        <Suspense fallback={<p className="mt-10 text-white/55">Reading the census…</p>}>
          <Census />
        </Suspense>

        <section className="mt-20">
          <h2 className="text-[30px] leading-tight text-white">How to check these numbers</h2>
          <p className="mt-3 max-w-[760px] text-[16px] leading-relaxed text-white/70">
            Don&apos;t take our word for it. Every number above comes from public on-chain data — here is how to see it yourself, from a
            quick look to a full recount.
          </p>
          <div className="mt-8 grid grid-cols-1 gap-8 md:grid-cols-3">
            <Step n="01" title="Look at the factory">
              Every Pons launch is an event of the factory contract{" "}
              <a href={`${BS}/address/${ex.factory}?tab=logs`} {...ext} className={link}>
                {short(ex.factory)}
              </a>
              . Open its logs on Blockscout and you will see launches arrive all the time.
            </Step>
            <Step n="02" title="Open tokens we counted">
              Graduated — reached a DEX:{" "}
              {ex.graduated.map((t, i) => (
                <span key={t.token}>
                  {i ? ", " : ""}
                  <a href={`${GT}/${t.token}`} {...ext} className={link}>
                    {short(t.token)}
                  </a>
                </span>
              ))}
              . Near-empty curve:{" "}
              {ex.empty.map((t, i) => (
                <span key={t.token}>
                  {i ? ", " : ""}
                  <a href={`${GT}/${t.token}`} {...ext} className={link}>
                    {short(t.token)}
                  </a>
                </span>
              ))}
              .
            </Step>
            <Step n="03" title="Recount everything">
              The script is open source and needs only Node.js — no keys. It reads the same events and prints the same summary.
              <pre className="mt-3 overflow-x-auto rounded-[12px] border border-white/[0.1] bg-black/60 p-3 font-mono text-[12px] text-white/85">
                {`git clone https://github.com/coreumxyz-bit/COREUM
node COREUM/api/scripts/pons-census.mjs census`}
              </pre>
            </Step>
          </div>
        </section>
      </div>
    </main>
  );
}
