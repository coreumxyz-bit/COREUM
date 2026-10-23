import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import AskBox from "@/components/AskBox";
import { api } from "@/lib/api";
import type { Verdict } from "@/lib/verify";

export const metadata = {
  title: "CT Truth Leaderboard — Coreum",
  description: "X accounts ranked by how their posts hold up when independent AI cores check them. Every check is sealed on Robinhood Chain.",
};

type Account = {
  handle: string;
  author: string;
  avatar: string;
  n: number;
  t: number;
  f: number;
  u: number;
  score: number;
  ranked: boolean;
  checks: { id: number; verdict: Verdict; agree: number; text: string; url: string }[];
};

const MARK: Record<Verdict, string> = { YES: "TRUE", NO: "FALSE", UNSURE: "UNCLEAR" };

function Row({ a, rank }: { a: Account; rank: number | null }) {
  return (
    <div className="glass-fx grid grid-cols-[44px_1fr_auto] items-center gap-3 rounded-[16px] border border-white/[0.1] bg-white/[0.04] p-4 backdrop-blur-[20px] sm:grid-cols-[32px_44px_1fr_auto] sm:gap-4">
      <span className="hidden text-center font-mono text-[15px] text-white/50 sm:block">{rank ?? "–"}</span>
      {a.avatar ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.avatar} alt="" width={44} height={44} className="h-11 w-11 rounded-full grayscale" />
      ) : (
        <span className="h-11 w-11 rounded-full border border-white/20" />
      )}
      <div className="min-w-0">
        <a
          href={`https://x.com/${a.handle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-[15px] text-white hover:underline"
        >
          {a.author} <span className="text-white/45">@{a.handle}</span>
        </a>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {a.checks.map((c) => (
            <Link
              key={c.id}
              href={`/v/${c.id}`}
              title={c.text}
              className="rounded-[6px] border border-white/[0.14] px-2 py-0.5 font-mono text-[11px] text-white/70 hover:border-white/40 hover:text-white"
            >
              {MARK[c.verdict]}
            </Link>
          ))}
          {a.n > a.checks.length && <span className="px-1 text-[11px] text-white/40">+{a.n - a.checks.length} more</span>}
        </div>
      </div>
      <div className="text-right">
        <div className="font-mono text-[26px] leading-none text-white">
          {rank != null && <span className="mr-2 text-[14px] text-white/40 sm:hidden">#{rank}</span>}
          {a.ranked ? `${a.score}%` : "—"}
        </div>
        <div className="mt-1.5 hidden text-[12px] text-white/45 sm:block">
          {a.t} true · {a.f} false · {a.u} unclear
        </div>
      </div>
    </div>
  );
}

async function Board() {
  await connection();
  let data: { min: number; accounts: Account[] } = { min: 2, accounts: [] };
  try {
    data = await api("/api/truth-board");
  } catch {}
  const ranked = data.accounts.filter((a) => a.ranked);
  const fresh = data.accounts.filter((a) => !a.ranked);
  return (
    <>
      {ranked.length ? (
        <div className="flex flex-col gap-2">
          {ranked.map((a, i) => (
            <Row key={a.handle} a={a} rank={i + 1} />
          ))}
        </div>
      ) : (
        <p className="text-[14px] text-white/55">
          No account has {data.min} checked posts yet. Check posts from your timeline and they show up here.
        </p>
      )}
      {fresh.length > 0 && (
        <>
          <h3 className="mt-12 text-[13px] text-white/60">New — needs {data.min} checked posts to rank</h3>
          <div className="mt-3 flex flex-col gap-2">
            {fresh.map((a) => (
              <Row key={a.handle} a={a} rank={null} />
            ))}
          </div>
        </>
      )}
    </>
  );
}

export default function TruthPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/truth" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">CT Truth Leaderboard</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,72px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          Who on CT <span className="text-white/45">tells the truth?</span>
        </h1>
        <p className="mt-6 max-w-[660px] text-[17px] leading-relaxed text-white/75">
          Every X post anyone checks on Coreum counts toward its author. Six independent AI cores judge each post with
          commit–reveal; the verdict is sealed on Robinhood Chain. Add a post and move the board.
        </p>

        <div className="mt-10 max-w-[760px]">
          <AskBox placeholder="Paste an X post link — x.com/…/status/…" cta="Check post" examples={[]} />
        </div>

        <section className="mt-16 border-t border-white/10 pt-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-[28px] leading-tight text-white">Leaderboard</h2>
            <p className="max-w-[460px] text-[12px] leading-relaxed text-white/45">
              Truth score = posts judged TRUE out of those judged TRUE or FALSE, smoothed toward 50% while an account has few
              checks. UNCLEAR does not count either way. Based only on posts people chose to check — AI verdicts, not facts
              about the person.
            </p>
          </div>
          <div className="mt-6 max-w-[860px]">
            <Suspense fallback={<p className="text-white/55">Reading the network…</p>}>
              <Board />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
