import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import { api } from "@/lib/api";

export const metadata = { title: "Track record — Coreum" };

type Stats = {
  total: { n: number; h: number; acc: number | null; br: number | null };
  open: number;
  byStrat: { strat: string; n: number; h: number; acc: number; br: number | null }[];
  bySym: { sym: string; n: number; h: number; acc: number }[];
  byConf: { b: string; n: number; h: number; acc: number; conf: number }[];
  daily: { d: string; n: number; h: number }[];
  recent: {
    id: number; sym: string; dir: number; conf: number; st: string;
    p0: number; p1: number | null; dl: number;
  }[];
};

const pct = (x: number | null | undefined) =>
  x == null ? "—" : `${(x * 100).toFixed(1)}%`;

const px = (x: number | null) =>
  x == null ? "—" : x.toLocaleString("en-US", { maximumFractionDigits: 4 });

const when = (ts: number) =>
  new Date(ts * 1000).toISOString().replace("T", " ").slice(5, 16) + " UTC";

function Table({
  head,
  rows,
}: {
  head: string[];
  rows: React.ReactNode[][];
}) {
  return (
    <table className="w-full text-left text-sm">
      <thead>
        <tr className="border-b border-white/10 text-caption-label text-ash-gray">
          {head.map((h) => (
            <th key={h} className="py-2 font-normal">{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className="border-b border-white/5">
            {r.map((c, j) => (
              <td key={j} className="py-3">{c}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function TrackRecord() {
  await connection();
  const s = await api<Stats>("/api/stats");
  const max = Math.max(1, ...s.daily.map((d) => d.n));

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-45 pb-24">
      <p className="text-nav-label mb-4 text-saffron-spark">Public record</p>
      <h1 className="text-heading mb-6 text-bone-white">Track record</h1>
      <p className="text-body-copy mb-14 max-w-[640px] text-ash-gray">
        Every call settles automatically against the live price feed and is hash-sealed
        in a public SHA-256 chain before the move happens. Misses are counted as loudly
        as hits — nothing here is curated, and you can recompute all of it yourself.
      </p>

      <div className="mb-16 grid grid-cols-2 gap-px border border-white/10 bg-white/10 md:grid-cols-4">
        {[
          { k: "Settled calls", v: s.total.n.toLocaleString("en-US") },
          { k: "Hit rate", v: pct(s.total.acc) },
          { k: "Brier score", v: s.total.br == null ? "—" : s.total.br.toFixed(4) },
          { k: "Open calls", v: String(s.open) },
        ].map((c) => (
          <div key={c.k} className="glass-fx bg-white/[0.06] p-6 backdrop-blur-[20px]">
            <div className="text-caption-label mb-2 text-ash-gray">{c.k}</div>
            <div className="text-3xl font-bold text-bone-white">{c.v}</div>
          </div>
        ))}
      </div>

      {s.total.n < 50 && (
        <p className="text-caption-label mb-12 border-l-2 border-saffron-spark pl-4 text-ash-gray">
          Small sample. Treat every percentage above as a growing record, not a verdict —
          the raw rows below are the argument, not the summary.
        </p>
      )}

      <section className="mb-16">
        <h2 className="text-body-copy mb-2 font-semibold text-bone-white">Last 30 days</h2>
        <p className="text-caption-label mb-6 text-ash-gray">
          Bar height = calls settled that day · white ≥ 50% hit rate · grey below
        </p>
        {s.daily.length === 0 ? (
          <p className="text-body-copy text-ash-gray">No settled calls yet.</p>
        ) : (
          <>
            <div className="flex h-36 items-end gap-1">
              {s.daily.map((d) => (
                <div
                  key={d.d}
                  title={`${d.d}: ${d.h}/${d.n} hit`}
                  className={`flex-1 ${d.h / d.n >= 0.5 ? "bg-white/80" : "bg-white/25/80"}`}
                  style={{ height: `${Math.max(4, Math.round((d.n / max) * 100))}%` }}
                />
              ))}
            </div>
            <div className="mt-2 flex justify-between text-caption-label text-ash-gray">
              <span>{s.daily[0].d}</span>
              <span>{s.daily[s.daily.length - 1].d}</span>
            </div>
          </>
        )}
      </section>

      <section className="mb-16">
        <h2 className="text-body-copy mb-2 font-semibold text-bone-white">
          Calibration — do the stated percentages mean it?
        </h2>
        <p className="text-caption-label mb-6 text-ash-gray">
          Top bar (white) = confidence the network stated on average · bottom bar
          = what actually happened. Green within 5 points of the claim, red when
          the network is overconfident.
        </p>
        <div className="flex flex-col">
          {s.byConf.map((b) => {
            const stated = b.conf;
            const actual = b.acc * 100;
            const gap = actual - stated;
            const good = gap >= -5;
            return (
              <div key={b.b} className="border-b border-white/5 py-4">
                <div className="flex items-baseline justify-between gap-4 text-sm">
                  <span className="text-bone-white">stated {b.b}%</span>
                  <span className="text-caption-label text-ash-gray">{b.n} calls</span>
                  <span className={`text-caption-label ${good ? "text-white" : "text-white/45"}`}>
                    {stated.toFixed(1)}% → {actual.toFixed(1)}% ({gap >= 0 ? "+" : ""}
                    {gap.toFixed(1)} pts)
                  </span>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  <div
                    className="h-2 bg-white/25"
                    style={{ width: `${Math.min(100, stated)}%` }}
                    title={`stated ${stated.toFixed(1)}%`}
                  />
                  <div
                    className={`h-2 ${good ? "bg-white" : "bg-white/25"}`}
                    style={{ width: `${Math.min(100, actual)}%` }}
                    title={`actual ${actual.toFixed(1)}%`}
                  />
                </div>
              </div>
            );
          })}
        </div>
        {s.byConf.length === 0 && (
          <p className="text-body-copy text-ash-gray">Not enough settled calls yet.</p>
        )}
      </section>

      <div className="mb-16 grid grid-cols-1 gap-12 lg:grid-cols-2">
        <section>
          <h2 className="text-body-copy mb-6 font-semibold text-bone-white">By strategy</h2>
          <Table
            head={["Strategy", "Calls", "Hit rate", "Brier"]}
            rows={s.byStrat.map((r) => [
              <span key="s" className="text-bone-white">{r.strat}</span>,
              <span key="n" className="text-ash-gray">{r.n}</span>,
              <span key="a" className={r.acc >= 0.5 ? "text-white" : "text-white/45"}>
                {pct(r.acc)}
              </span>,
              <span key="b" className="text-ash-gray">{r.br == null ? "—" : r.br.toFixed(4)}</span>,
            ])}
          />
        </section>
        <section>
          <h2 className="text-body-copy mb-6 font-semibold text-bone-white">By symbol</h2>
          <Table
            head={["Symbol", "Calls", "Hit rate"]}
            rows={s.bySym.map((r) => [
              <span key="s" className="text-bone-white">{r.sym}</span>,
              <span key="n" className="text-ash-gray">{r.n}</span>,
              <span key="a" className={r.acc >= 0.5 ? "text-white" : "text-white/45"}>
                {pct(r.acc)}
              </span>,
            ])}
          />
        </section>
      </div>

      <section className="mb-16">
        <h2 className="text-body-copy mb-6 font-semibold text-bone-white">Latest settled</h2>
        {s.recent.length === 0 ? (
          <p className="text-body-copy text-ash-gray">Nothing settled yet.</p>
        ) : (
          <div className="flex flex-col">
            {s.recent.map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between gap-4 border-b border-white/5 py-3 text-sm"
              >
                <span className="text-bone-white">
                  {r.sym}{" "}
                  <span className={r.dir === 1 ? "text-white" : "text-white/45"}>
                    {r.dir === 1 ? "↑" : "↓"}
                  </span>{" "}
                  {r.conf}%
                </span>
                <span className="text-ash-gray">{px(r.p0)} → {px(r.p1)}</span>
                <span className="text-caption-label text-ash-gray">{when(r.dl)}</span>
                <span
                  className={`text-caption-label ${r.st === "hit" ? "text-white" : "text-white/45"}`}
                >
                  {r.st === "hit" ? "HIT" : "MISS"}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-body-copy mb-3 font-semibold text-bone-white">
          Verify it yourself
        </h2>
        <p className="text-caption-label mb-4 text-ash-gray">
          Brier = mean squared error between stated confidence and outcome; lower is
          better, ~0.24 is what a constant 51% guess scores. Settlement uses the first
          recorded price at or after the deadline, so a delayed feed cannot rewrite a
          past result — the call was sealed before the move.
        </p>
        <div className="flex flex-wrap gap-6 text-sm">
          <a href="/api/stats" className="text-saffron-spark underline">raw stats JSON</a>
          <a href="/api/export" className="text-saffron-spark underline">full hash chain</a>
          <a href="/ledger" className="text-saffron-spark underline">browse the ledger</a>
          <a href="/holders" className="text-saffron-spark underline">verified holders</a>
        </div>
      </section>
    </div>
  );
}

export default function TrackRecordPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/track-record" />
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1280px] px-6 py-12">
            <p className="text-body-copy text-ash-gray">Reading the ledger…</p>
          </div>
        }
      >
        <TrackRecord />
      </Suspense>
    </main>
  );
}
