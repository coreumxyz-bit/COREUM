import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import AskBox from "@/components/AskBox";
import { api } from "@/lib/api";
import { fellSince, valueNow } from "@/lib/publicApi";
import { grade, GRADE_NOTE, type Letter } from "@/lib/grade";
import type { TokenFacts } from "@/lib/token";

export const metadata = {
  title: "Coreum grades — Robinhood Chain tokens from A to F",
  description: "Every token the network checked, graded A to F from six AI cores and the on-chain facts. Best launches first.",
};

type Row = {
  id: number;
  verdict: "YES" | "NO" | "UNSURE";
  agree: number;
  done_at: number;
  src: { address: string; name: string; symbol: string; image: string; facts: TokenFacts };
};

const DAYS = 7;
const LETTERS: Letter[] = ["A", "B", "C", "D", "F"];
const ago = (t: number) => {
  const s = Math.max(0, Date.now() / 1000 - t);
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};

async function Board() {
  await connection();
  let rows: Row[] = [];
  try {
    rows = await api<Row[]>("/api/token-checks?limit=100");
  } catch {}
  // the newest check of each token, from the last week
  const seen = new Set<string>();
  const graded = rows
    .filter((r) => r.src?.address && Date.now() / 1000 - r.done_at < DAYS * 86400 && !seen.has(r.src.address) && seen.add(r.src.address))
    .map((r) => ({ ...r, g: grade(r.verdict, r.agree, r.src.facts) }));
  // a token dumped since its check keeps its old grade only as history: flagged and sent to the bottom
  const now = await valueNow(graded.map((r) => r.src.address));
  const rowsOut = graded
    .map((r) => ({ ...r, fell: fellSince(r.src.facts.fdv, now.get(r.src.address)) }))
    .map((r) => ({ ...r, dumped: (r.fell ?? 0) >= 0.5 }))
    .sort((a, b) => Number(a.dumped) - Number(b.dumped) || b.g.score - a.g.score || b.done_at - a.done_at);
  const count = (l: Letter) => rowsOut.filter((r) => !r.dumped && r.g.letter === l).length;
  const dumped = rowsOut.filter((r) => r.dumped).length;

  if (!graded.length) return <p className="mt-10 text-white/55">No tokens checked this week yet — be the first.</p>;
  return (
    <>
      <div className="mt-10 grid grid-cols-5 gap-2 sm:gap-3">
        {LETTERS.map((l) => (
          <div key={l} className="glass-fx rounded-[16px] border border-white/[0.12] bg-white/[0.04] p-4 text-center backdrop-blur-[20px]">
            <div className="text-[34px] leading-none text-white">{l}</div>
            <div className="mt-2 font-mono text-[13px] text-white/55">{count(l)}</div>
          </div>
        ))}
      </div>
      {dumped > 0 && (
        <p className="mt-6 text-[13px] text-white/55">
          {dumped} token{dumped > 1 ? "s" : ""} fell 50%+ since {dumped > 1 ? "their" : "its"} check — a grade is a snapshot, so those are struck out and listed last.
        </p>
      )}
      <div className="mt-8 flex flex-col gap-2">
        {rowsOut.map((r) => (
          <Link
            key={r.src.address}
            href={`/grade/${r.src.address}`}
            className="glass-fx grid grid-cols-[56px_40px_1fr_auto] items-center gap-4 rounded-[16px] border border-white/[0.1] bg-white/[0.04] px-4 py-3 backdrop-blur-[20px] transition-colors hover:border-white/30 sm:grid-cols-[64px_40px_1fr_1.4fr_auto]"
          >
            <span
              className={`text-center text-[34px] leading-none font-medium ${r.dumped ? "text-white/30 line-through" : r.g.letter === "F" ? "text-white/45" : "text-white"}`}
            >
              {r.g.letter}
            </span>
            {r.src.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.src.image} alt="" width={40} height={40} className="h-10 w-10 rounded-full" />
            ) : (
              <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-[11px]">{r.src.symbol.slice(0, 3)}</span>
            )}
            <div className="min-w-0">
              <div className="truncate text-[15px] text-white">
                {r.src.name} <span className="text-white/50">${r.src.symbol}</span>
              </div>
              <div className="font-mono text-[12px] text-white/45">
                {r.g.score}/100 · {ago(r.done_at)}
              </div>
            </div>
            <div className={`hidden truncate text-[13px] sm:block ${r.dumped ? "text-white" : "text-white/55"}`}>
              {r.dumped ? `⚠ Value fell ${Math.round(r.fell! * 100)}% since this check — grade outdated` : r.g.reasons[0]?.why ?? "No deductions"}
            </div>
            <span className="text-[13px] text-white/45">→</span>
          </Link>
        ))}
      </div>
    </>
  );
}

const RULES: [string, string][] = [
  ["Cores found red flags", "F, always"],
  ["Cores split or unsure", "−20"],
  ["Clean verdict, but under 75% of cores agree", "−15"],
  ["Honeypot (selling may be blocked)", "F (−100)"],
  ["Price fell 50%+ in the last 24h", "−30"],
  ["Uses a real stock's ticker but is not the official Robinhood stock token", "−25"],
  ["Active contract owner", "−25"],
  ["Deployer holds 10%+ / 5–10% of supply", "−15 / −8"],
  ["Deployer's earlier launches mostly died (5+ launches, 70%+ dead)", "−25"],
  ["Deployer launched 20+ other tokens", "−12"],
  ["Deployer history unknown (checks from before it existed)", "−5"],
  ["Bundled launch: 20+ wallets bought in the first 5 min and still hold 15%+", "−35"],
  ["Sniped launch: 25%+ of supply bought in the first 5 min", "−10"],
  ["Top wallets (not counting the bonding curve) own 40%+", "−15"],
  ["Under $1K liquidity", "−15"],
  ["Fewer than 50 holders", "−10"],
  ["Less than a day old", "−10"],
];

export default function GradesPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/grades" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="flex items-center gap-2 text-[13px] text-white/60">
          <span className="live-dot" /> Coreum grades · last {DAYS} days
        </p>
        <h1 className="mt-3 text-[clamp(40px,6vw,76px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          Every token, <span className="text-white/45">one letter.</span>
        </h1>
        <p className="mt-6 max-w-[680px] text-[17px] leading-relaxed text-white/75">
          Six AI cores judge each token from its on-chain facts; the grade turns that verdict and the facts into one letter from A
          to F — with every point explained. Best launches first.
        </p>
        <div className="mt-8 max-w-[760px]">
          <AskBox placeholder="Grade a token — paste its address 0x…" cta="Check token" examples={[]} />
        </div>

        <Suspense fallback={<p className="mt-10 text-white/55">Grading…</p>}>
          <Board />
        </Suspense>

        <section id="how" className="mt-20 max-w-[860px] scroll-mt-28">
          <h2 className="text-[30px] leading-tight text-white">How grades work</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-white/70">
            Every token starts at 100 and loses points for each warning sign. A = 85+, B = 70+, C = 55+, D = 40+, F below. Fixed
            rules, no hand-picking: the same facts always give the same grade, and anyone can check them on the full verdict page.
          </p>
          <div className="mt-6 overflow-hidden rounded-[16px] border border-white/[0.12]">
            {RULES.map(([why, pts]) => (
              <div key={why} className="flex justify-between gap-4 border-b border-white/[0.06] px-5 py-2.5 text-[14px] last:border-0">
                <span className="text-white/75">{why}</span>
                <span className="font-mono whitespace-nowrap text-white">{pts}</span>
              </div>
            ))}
          </div>
          <ul className="mt-6 space-y-1 text-[14px] text-white/60">
            {LETTERS.map((l) => (
              <li key={l}>
                <b className="font-medium text-white">{l}</b> — {GRADE_NOTE[l]}
              </li>
            ))}
          </ul>
          <p className="mt-6 text-[13px] text-white/45">A risk screen from public on-chain facts — not an audit and not financial advice.</p>
        </section>
      </div>
    </main>
  );
}
