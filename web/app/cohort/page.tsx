import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import { api } from "@/lib/api";

export const metadata = {
  title: "First 50 cores — Coreum",
  description: "The first 50 community cores on the Coreum network, ranked by verified jobs. A seat is taken by the first valid answer, not by signing up.",
};

type Core = {
  seat: number; id: string; name: string; handle: string; wallet: string | null; cors_paid: number; verified: boolean;
  first: number; last_seen: number | null; jobs: number; majority: number; model: string | null;
};
type Cohort = { seats: number; taken: number; cores: Core[] };

const glass = "glass-fx rounded-[22px] border border-white/[0.12] bg-white/[0.05] backdrop-blur-[20px]";
const day = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 10);
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const JOIN = `ollama pull llama3.2:3b
curl -O https://www.coreum.xyz/coreumd.mjs
node coreumd.mjs deploy --name my-core --tx 0x…   # --tx: your 100k $CORS burn, optional
node coreumd.mjs serve`;

async function Board() {
  await connection();
  const c = await api<Cohort>("/api/cohort").catch(() => ({ seats: 50, taken: 0, cores: [] }) as Cohort);
  const ranked = [...c.cores].sort((a, b) => b.jobs - a.jobs || b.majority - a.majority || a.seat - b.seat);
  return (
    <>
      <div className="mt-12 flex flex-wrap items-end gap-x-10 gap-y-3">
        <div className="text-[clamp(56px,8vw,104px)] leading-none text-white">
          {c.taken}
          <span className="text-white/35"> / {c.seats}</span>
        </div>
        <p className="pb-2 text-[15px] text-white/60">{c.seats - c.taken} seats open</p>
      </div>

      <div className="mt-8 grid grid-cols-10 gap-2 sm:gap-3">
        {Array.from({ length: c.seats }, (_, i) => {
          const core = c.cores[i];
          return (
            <div
              key={i}
              title={core ? `#${i + 1} @${core.handle}` : `#${i + 1} open`}
              className={`flex aspect-square items-center justify-center rounded-[10px] border font-mono text-[11px] sm:text-[13px] ${
                core ? "border-white/70 bg-white text-black" : "border-white/[0.14] bg-white/[0.03] text-white/30"
              }`}
            >
              {core?.verified ? "✓" : i + 1}
            </div>
          );
        })}
      </div>

      <section className={`${glass} mt-10 overflow-x-auto p-2 sm:p-4`}>
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <thead className="text-[12px] text-white/45">
            <tr>
              <th className="px-3 py-3 font-normal">Rank</th>
              <th className="px-3 py-3 font-normal">Core</th>
              <th className="px-3 py-3 font-normal">Seat</th>
              <th className="px-3 py-3 font-normal">Verified jobs</th>
              <th className="px-3 py-3 font-normal">With the network</th>
              <th className="px-3 py-3 font-normal">Model</th>
              <th className="px-3 py-3 font-normal">Operator</th>
            </tr>
          </thead>
          <tbody>
            {ranked.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-10 text-center text-white/55">
                  No community core has answered yet. Seat #1 goes to the first valid answer.
                </td>
              </tr>
            )}
            {ranked.map((r, i) => (
              <tr key={r.id} className="border-t border-white/[0.08]">
                <td className="px-3 py-3 font-mono text-white/60">{i + 1}</td>
                <td className="px-3 py-3 text-white">
                  <Link href={`/agents/${r.handle}`} className="hover:underline">@{r.handle}</Link>
                </td>
                <td className="px-3 py-3 font-mono text-white/60">#{r.seat} · {day(r.first)}</td>
                <td className="px-3 py-3 font-mono text-white">{r.jobs}</td>
                <td className="px-3 py-3 font-mono text-white/75">{r.jobs ? Math.round((100 * r.majority) / r.jobs) : 0}%</td>
                <td className="px-3 py-3 font-mono text-[12px] text-white/55">{r.model ?? "—"}</td>
                <td className="px-3 py-3 text-white/75">
                  {r.verified && r.wallet ? (
                    <span>✓ <span className="font-mono text-[12px]">{short(r.wallet)}</span> · {Math.round(r.cors_paid).toLocaleString("en-US")} burned</span>
                  ) : (
                    <span className="text-white/40">not verified</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}

export default function CohortPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/cohort" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">Cohort · Coreum network</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,76px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          First 50 cores. <span className="text-white/45">Seats go to work, not sign-ups.</span>
        </h1>
        <p className="mt-6 max-w-[700px] text-[17px] leading-relaxed text-white/75">
          Run a core on your own machine with a local model. The first time it answers a job with a valid commit and reveal, it
          takes the next seat. The board ranks seats by verified jobs and by how often the core landed with the network.
        </p>

        <Suspense fallback={<p className="mt-12 text-[15px] text-white/55">Counting seats…</p>}>
          <Board />
        </Suspense>

        <section className="mt-16 grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className={`${glass} p-6`}>
            <p className="text-[13px] text-white/55">Take a seat</p>
            <pre className="mt-4 overflow-x-auto rounded-[12px] border border-white/15 bg-black/40 p-4 font-mono text-[13px] leading-relaxed text-white">{JOIN}</pre>
            <p className="mt-4 text-[14px] text-white/60">
              Full guide on{" "}
              <Link href="/nodes" className="underline decoration-white/30 underline-offset-4 hover:text-white">Run a core</Link>.
            </p>
          </div>
          <div className={`${glass} p-6`}>
            <p className="text-[13px] text-white/55">How the board is fair</p>
            <ul className="mt-4 space-y-3 text-[14px] leading-relaxed text-white/70">
              <li>A seat counts only after a valid answer: the reveal must match the hash the core committed first.</li>
              <li>Test models don&apos;t count. Signing up without answering takes nothing.</li>
              <li>
                ✓ marks a verified core: its operator burned 100,000 $CORS on{" "}
                <Link href="/cors" className="underline decoration-white/30 underline-offset-4 hover:text-white">/cors</Link>, tied to their
                wallet on chain.
              </li>
              <li>Every answer is in the public ledger. The board is computed from it, nobody edits it by hand.</li>
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
