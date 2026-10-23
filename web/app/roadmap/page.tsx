import Link from "next/link";
import Nav from "@/components/Nav";
import Animate from "@/components/Animate";
import { VERDICTS_CONTRACT } from "@/lib/verify";

export const metadata = {
  title: "Roadmap — Coreum",
  description: "What is live on Coreum today and what comes next: verify, community, oracle.",
};

type Item = { text: string; href?: string };
type Phase = { n: string; tag: "Live" | "Next" | "Later"; title: string; items: Item[] };

// Phase 01 lists only what runs in production; the rest are plans.
const PHASES: Phase[] = [
  {
    n: "01",
    tag: "Live",
    title: "Verify",
    items: [
      { text: "6 AI cores vote on every check, commit-reveal", href: "/" },
      { text: "Paste an X post, get a verdict", href: "/" },
      { text: "Public SHA-256 ledger + Bitcoin anchors", href: "/ledger" },
      {
        text: "CoreumVerdicts contract, written hourly on Robinhood Chain",
        href: `https://robinhoodchain.blockscout.com/address/${VERDICTS_CONTRACT}`,
      },
      { text: "Deploy your own core with Ollama", href: "/nodes" },
    ],
  },
  {
    n: "02",
    tag: "Next",
    title: "Community",
    items: [
      { text: "Tag Coreum under any X post for a verdict reply" },
      { text: "Core leaderboard with on-chain accuracy" },
    ],
  },
  {
    n: "03",
    tag: "Later",
    title: "Oracle",
    items: [
      { text: "Cores stake $CORS, wrong reveals get slashed" },
      { text: "Prediction markets settle from verdictOf()" },
      { text: "SDK for any dApp on Robinhood Chain" },
    ],
  },
];

function Row({ item, live }: { item: Item; live: boolean }) {
  const mark = (
    <span
      className={`mt-[3px] grid h-[20px] w-[20px] flex-none place-items-center rounded-full border text-[11px] font-bold ${
        live ? "border-white bg-white text-black" : "border-white/35"
      }`}
    >
      {live ? "✓" : ""}
    </span>
  );
  const body = <span className={live ? "text-white/85" : "text-white/70"}>{item.text}</span>;
  if (!item.href) return <li className="flex gap-3">{mark}{body}</li>;
  const external = item.href.startsWith("http");
  return (
    <li className="flex gap-3">
      {mark}
      <Link
        href={item.href}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
        className="underline decoration-white/20 underline-offset-4 transition-colors hover:decoration-white/60"
      >
        {body}
      </Link>
    </li>
  );
}

export default function RoadmapPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/roadmap" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <Animate>
          <p className="text-[13px] text-white/60">Roadmap</p>
          <h1 className="mt-3 text-[clamp(40px,6vw,72px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
            Shipped first, <span className="text-white/45">then said.</span>
          </h1>
          <p className="mt-6 max-w-[640px] text-[17px] leading-relaxed text-white/75">
            Phase 01 runs in production today — every item links to the live thing. Phases 02 and 03 are plans, in the order
            we intend to build them.
          </p>
        </Animate>

        {/* progress rail: phase 01 done */}
        <div className="mt-14 hidden h-[2px] lg:block" style={{ background: "linear-gradient(90deg,#fff 0 33.3%,rgba(255,255,255,.15) 33.3%)" }} />

        <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
          {PHASES.map((p, i) => {
            const live = p.tag === "Live";
            return (
              <Animate key={p.n} delay={120 + i * 120} className="h-full">
                <section
                  className={`glass-fx h-full rounded-[24px] border p-7 backdrop-blur-[20px] ${
                    live ? "border-white/30 bg-white/[0.09]" : "border-white/[0.12] bg-white/[0.04]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold tracking-[0.14em] text-white/55">PHASE {p.n}</span>
                    <span
                      className={`rounded-full border px-3 py-1 text-[12px] uppercase ${
                        live ? "border-white bg-white font-semibold text-black" : "border-white/20 text-white/75"
                      }`}
                    >
                      {p.tag}
                    </span>
                  </div>
                  <h2 className="mt-3 text-[32px] leading-tight text-white">{p.title}</h2>
                  <ul className="mt-5 flex flex-col gap-4 text-[16px] leading-snug">
                    {p.items.map((it) => (
                      <Row key={it.text} item={it} live={live} />
                    ))}
                  </ul>
                </section>
              </Animate>
            );
          })}
        </div>
      </div>
    </main>
  );
}
