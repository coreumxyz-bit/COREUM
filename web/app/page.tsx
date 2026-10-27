import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import LogoMark from "@/components/LogoMark";
import RevealInit from "@/components/RevealInit";
import TokenPanel from "@/components/TokenPanel";
import BurnCounter from "@/components/BurnCounter";
import NetworkCard from "@/components/NetworkCard";
import OnchainProof from "@/components/OnchainProof";
import AskBox from "@/components/AskBox";
import HeroNetwork from "@/components/HeroNetwork";
import Animate from "@/components/Animate";
import Words from "@/components/Words";
import { api } from "@/lib/api";
import { CORS_TOKEN, CORS_TRADE_URL, SOCIAL } from "@/lib/cors";

export const metadata = {
  title: "Coreum — Deploy a core. Get a verifiable answer.",
  description:
    "Coreum is a DePIN network of AI cores on Robinhood Chain. Cores run their own models and check crypto — any token before you buy it — with commit–reveal; every verdict is sealed on-chain. Run a core from your own machine.",
};

// sea under a beam of light, shown in black & white

type Net = { done: number; agree: number; ref: number; community_online: number };

// Scrolling strip of the network's real numbers — nothing hard-coded
async function NetStrip() {
  await connection();
  let items = ["$CORS", "LIVE ON ROBINHOOD CHAIN", "EVERY VERDICT SEALED ON-CHAIN", "OPEN SOURCE · MIT"];
  try {
    const n = await api<Net>("/api/network");
    items = [
      `${n.ref} REFERENCE CORES`,
      `${n.community_online} COMMUNITY CORES ONLINE`,
      `${n.done} VERDICTS SEALED`,
      `${Math.round(n.agree * 100)}% AVERAGE AGREEMENT`,
      "EVERY VERDICT ON ROBINHOOD CHAIN",
      "OPEN SOURCE · MIT",
      "$CORS",
    ];
  } catch {}
  const row = (hidden?: boolean) => (
    <div className="flex shrink-0 items-center" aria-hidden={hidden || undefined}>
      {items.map((t, i) => (
        <span key={i} className="flex items-center gap-6 px-6 font-mono text-[13px] tracking-[0.04em] whitespace-nowrap text-white/85">
          {t}
          <span className="text-white/40">✦</span>
        </span>
      ))}
    </div>
  );
  return (
    <div className="relative z-2 overflow-hidden border-y border-white/10 bg-white/[0.03] py-3.5 backdrop-blur-[6px]">
      <div className="animate-marquee flex w-max">
        {row()}
        {row(true)}
      </div>
    </div>
  );
}

// what the network does today — each card is a page you can use right now
const WORK = [
  {
    href: "/token",
    title: "Token Check",
    text: "Paste any Robinhood Chain token. The cores judge holders, the deployer's past launches, first-minute buyers, dumps and honeypots.",
  },
  {
    href: "/grades",
    title: "Grades",
    text: "Every check becomes one letter from A to F, with each point explained. Tokens dumped after a check are flagged and re-checked.",
  },
  {
    href: "/watch",
    title: "Watchlist",
    text: "Put a token on watch: the network re-checks it every hour and raises an alert when liquidity is pulled or the deployer sells.",
  },
  {
    href: "/radar",
    title: "Radar",
    text: "Every hour the most active new Pons launches are checked without anyone asking — the network's own patrol.",
  },
];

const STEPS = [
  { n: "01", title: "Ask", text: "A person, an app or an agent sends a token or a claim — on the site, over the API, or through MCP." },
  { n: "02", title: "Commit", text: "Each core answers with its own model and sends only a hash of its answer first. Nobody can copy anyone." },
  {
    n: "03",
    title: "Reveal & seal",
    text: "Cores reveal; every answer is checked against its hash. The majority verdict is sealed in the ledger and written on Robinhood Chain.",
  },
];

const RUN = `ollama pull llama3.2:3b
curl -O https://www.coreum.xyz/coreumd.mjs
node coreumd.mjs deploy --name my-core
node coreumd.mjs serve`;

// One grid for the whole page: every section, the hero and the footer share
// this container, so left and right edges line up everywhere.
const SECTION = "py-24 sm:py-32";

function Wrap({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mx-auto w-full max-w-[1180px] px-5 sm:px-8 ${className}`}>{children}</div>;
}

// Centered section heading: kicker, title, optional subline.
function Head({ kicker, title, sub }: { kicker: string; title: React.ReactNode; sub?: React.ReactNode }) {
  return (
    <div className="mx-auto mb-14 max-w-[900px] text-center">
      <p className="text-[13px] text-white/60">{kicker}</p>
      <h2 className="mt-4 text-[clamp(34px,5vw,60px)] leading-[1.02] font-normal tracking-[-0.035em] text-balance text-white">
        {title}
      </h2>
      {sub && <p className="mx-auto mt-6 max-w-[640px] text-[17px] leading-relaxed text-balance text-white/70">{sub}</p>}
    </div>
  );
}

const card = "glass-fx lift rounded-[24px] border border-white/[0.12] bg-white/[0.05] p-7 backdrop-blur-[20px]";

export default function Home() {
  return (
    <>
      <main className="relative z-[1] overflow-x-hidden">
        <Nav active="/" />

        {/* Hero — what the network is, and the two things to do */}
        <section className="relative min-h-svh w-full overflow-hidden bg-black lg:h-screen lg:min-h-[680px]">
          <HeroNetwork />
          <div className="relative z-10 flex h-full flex-col">
            {/* room for the fixed nav */}
            <div className="h-[64px] shrink-0 sm:h-[82px]" />
            <div className="flex flex-1 items-center pt-8 pb-16 lg:py-8">
              <Wrap className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-16">
                <div className="w-full">
                  <Animate delay={150} direction="up">
                    <Link href="/chat" className="chat-pill mb-6 inline-flex items-center gap-3 rounded-full py-1.5 pr-4 pl-1.5 text-[14px] text-white">
                      <span className="rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-black">New</span>
                      <span>
                        Ask Coreum, <span className="text-white/60">the AI chat for Robinhood Chain</span>
                      </span>
                      <span className="chat-pill-arrow">→</span>
                    </Link>
                  </Animate>
                  <h1
                    style={{ fontFamily: "var(--font-sans)" }}
                    className="mb-5 text-[36px] leading-[0.95] font-normal tracking-normal text-white sm:mb-7 sm:text-[52px] md:text-[64px] lg:text-[72px]"
                  >
                    <Words text="Deploy a core. Get a verifiable answer." delay={300} />
                  </h1>
                  <Animate delay={500} direction="up">
                    <p className="mb-7 max-w-[560px] text-[16px] leading-[1.4] font-[450] text-white/80 sm:mb-8 sm:text-[18px]">
                      Coreum is a network of AI cores — machines running their own models. Together they check crypto: paste any
                      token and they tell you if it is safe to buy. Every answer is sealed on Robinhood Chain.
                    </p>
                  </Animate>
                  <Animate delay={700} direction="up">
                    <AskBox
                      placeholder="Paste a token address to check it — 0x…"
                      cta="Check"
                      examples={[{ label: `$${CORS_TOKEN.symbol} · Coreum`, value: CORS_TOKEN.address }]}
                    />
                  </Animate>
                  <Animate delay={850} direction="up">
                    <div className="mt-6 flex flex-wrap items-center gap-5 text-[14px]">
                      <Link href="/nodes" className="link-ghost">
                        Run a core →
                      </Link>
                      <Link href="/grades" className="link-ghost">
                        Today&apos;s grades →
                      </Link>
                      <a href={CORS_TRADE_URL} target="_blank" rel="noopener noreferrer" className="link-ghost">
                        Buy $CORS ↗
                      </a>
                    </div>
                  </Animate>
                </div>
                <NetworkCard />
              </Wrap>
            </div>
          </div>
        </section>

        {/* The network's numbers */}
        <Suspense fallback={<div className="h-[50px] border-y border-white/10" />}>
          <NetStrip />
        </Suspense>

        {/* What the network does */}
        <section id="work" data-s className={SECTION}>
          <Wrap className="rv">
            <Head
              kicker="What the network does"
              title={
                <>
                  It checks tokens. <span className="text-white/45">Before you buy them.</span>
                </>
              }
              sub="Most new tokens on Robinhood Chain die within days — 98% of Pons launches never reach a DEX. The cores read the chain so you don't buy blind."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {WORK.map((w) => (
                <Link key={w.href} href={w.href} className={`${card} group block transition-colors hover:border-white/30`}>
                  <h3 className="flex items-center justify-between text-[24px] leading-tight font-[450] tracking-[-0.01em] text-white">
                    {w.title}
                    <span className="text-[18px] text-white/40 transition-transform group-hover:translate-x-1">→</span>
                  </h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/70">{w.text}</p>
                </Link>
              ))}
            </div>
            <p className="mt-8 text-center text-[14px] text-white/55">
              The numbers behind it:{" "}
              <Link href="/pons" className="underline decoration-white/30 underline-offset-4 hover:text-white">
                every Pons launch, counted from the chain
              </Link>
              .
            </p>
          </Wrap>
        </section>

        {/* How a verdict is made */}
        <section id="how" data-s className={SECTION}>
          <Wrap className="rv">
            <Head
              kicker="How it works"
              title={
                <>
                  Many cores. <span className="text-white/45">One sealed answer.</span>
                </>
              }
              sub="No single AI decides. Independent cores on different models answer the same question, and nobody can copy anybody."
            />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {STEPS.map((c) => (
                <div key={c.n} className={card}>
                  <span className="font-mono text-[13px] text-white/45">{c.n}</span>
                  <h3 className="mt-4 text-[24px] leading-tight font-[450] tracking-[-0.01em] text-white">{c.title}</h3>
                  <p className="mt-3 text-[15px] leading-relaxed text-white/70">{c.text}</p>
                </div>
              ))}
            </div>
          </Wrap>
        </section>

        {/* Run a core */}
        <section id="run" data-s className={SECTION}>
          <Wrap className="rv">
            <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
              <div>
                <p className="text-[13px] text-white/60">DePIN · your machine, your model</p>
                <h2 className="mt-4 text-[clamp(34px,5vw,60px)] leading-[1.02] font-normal tracking-[-0.035em] text-white">
                  Run a core. <span className="text-white/45">Join the vote.</span>
                </h2>
                <p className="mt-6 max-w-[520px] text-[17px] leading-relaxed text-white/70">
                  A core is any computer running an AI model through Ollama. It gets the same jobs as the reference cores, commits
                  its answer first, and its vote counts the same. A laptop is enough.
                </p>
                <p className="mt-4 max-w-[520px] text-[14px] leading-relaxed text-white/50">
                  Today the six reference cores are run by Coreum; community cores join the same vote, and the network holds commits
                  open long enough for ordinary hardware.
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="/nodes" className="btn-primary">
                    Run a core
                  </Link>
                  <Link href="/cores" className="btn-outline">
                    See the cores
                  </Link>
                </div>
              </div>
              <pre className="glass-fx overflow-x-auto rounded-[20px] border border-white/[0.12] bg-black/60 p-6 font-mono text-[14px] leading-[1.9] text-white/85">
                {RUN}
              </pre>
            </div>
          </Wrap>
        </section>

        {/* Proof — the claims above, read from the chain */}
        <section id="proof" data-s className={SECTION}>
          <Wrap className="rv">
            <Head
              kicker="On-chain proof · live"
              title={
                <>
                  Receipts, <span className="text-white/45">not vibes.</span>
                </>
              }
              sub="Every verdict is written into a verified contract on Robinhood Chain — the numbers below are read from the chain, not from our API."
            />
            <Suspense fallback={<p className="text-center text-white/55">Reading Robinhood Chain…</p>}>
              <OnchainProof />
            </Suspense>
          </Wrap>
        </section>

        {/* For builders */}
        <section id="builders" data-s className={SECTION}>
          <Wrap className="rv">
            <Link
              href="/developers"
              className="glass-fx group grid grid-cols-1 items-center gap-8 rounded-[28px] border border-white/[0.12] bg-white/[0.06] p-8 backdrop-blur-[20px] transition-colors hover:border-white/30 sm:p-12 md:grid-cols-[minmax(0,1fr)_auto]"
            >
              <div>
                <p className="text-[13px] text-white/60">For launchpads, wallets and bots</p>
                <h2 className="mt-3 text-[clamp(30px,4vw,48px)] leading-[1.05] tracking-[-0.03em] text-white">
                  The network&apos;s verdict, <span className="text-white/45">at your buy button.</span>
                </h2>
                <p className="mt-4 max-w-[560px] text-[16px] leading-relaxed text-white/70">
                  One API call or one badge. Free while in beta, open source, every verdict provable on-chain.
                </p>
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/v1/badge/${CORS_TOKEN.address}`} alt="Coreum check badge" height={22} className="h-[30px] w-auto" />
            </Link>
          </Wrap>
        </section>

        {/* Token */}
        <section id="token" data-s className={SECTION}>
          <Wrap className="rv">
            <Head
              kicker="The token · $CORS"
              title={
                <>
                  The network&apos;s token. <span className="text-white/45">Burned, not printed.</span>
                </>
              }
              sub={
                <>
                  Live from the CORS/WETH pool. 1,000,000,000 fixed supply — contract verifiable on{" "}
                  <a
                    href={`${CORS_TOKEN.explorer}/token/${CORS_TOKEN.address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-white underline decoration-white/30 underline-offset-4"
                  >
                    Blockscout
                  </a>
                  .
                </>
              }
            />
            <TokenPanel />
            <BurnCounter />
          </Wrap>
        </section>

        {/* CTA */}
        <section id="join" data-s className={SECTION}>
          <Wrap className="rv">
            <div className="glass-fx mx-auto flex max-w-[860px] flex-col items-center rounded-[28px] border border-white/[0.12] bg-white/[0.06] px-6 py-16 text-center backdrop-blur-[20px] sm:py-20">
              <h2 className="max-w-[640px] text-[clamp(34px,5vw,60px)] leading-[1.05] font-normal tracking-[-0.035em] text-white">
                Deploy a core. Get a verifiable answer.
              </h2>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
                <Link href="/nodes" className="btn-primary">
                  Run a core
                </Link>
                <Link href="/token" className="btn-outline">
                  Check a token
                </Link>
              </div>
            </div>
          </Wrap>
        </section>

        {/* Footer */}
        <footer data-s className="border-t border-white/[0.08] py-10">
          <Wrap className="grid grid-cols-1 items-center gap-6 text-center text-[12px] text-white/50 md:grid-cols-[1fr_auto_1fr] md:text-left">
            <span className="flex items-center justify-center gap-2 md:justify-start">
              <LogoMark className="h-4 w-auto text-white/60" />
              <span className="text-[14px] text-white/70">Coreum</span>
            </span>
            <span className="flex flex-wrap justify-center gap-x-7 gap-y-2">
              {SOCIAL.map((l) => (
                <a key={l.label} href={l.href} target="_blank" rel="noopener noreferrer" className="link-ghost">
                  {l.label}
                </a>
              ))}
              <Link href="/nodes" className="link-ghost">
                Run a core
              </Link>
              <Link href="/developers" className="link-ghost">
                API
              </Link>
              <Link href="/ledger" className="link-ghost">
                Ledger
              </Link>
            </span>
            <span className="md:text-right">Built on Robinhood Chain · $CORS · Not financial advice · DYOR</span>
          </Wrap>
        </footer>
      </main>

      <RevealInit />
    </>
  );
}
