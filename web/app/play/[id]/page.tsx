import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import { api } from "@/lib/api";
import { PLAY_MIN, beatAi, verdict, type Play } from "@/lib/play";

export const metadata = {
  title: "A call vs the AI — Coreum",
  description: "A human call against Coreum's AI swarm, sealed in a public SHA-256 ledger. Can you beat the AI?",
};

const fmt = (p: number) =>
  p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 2 }) : p.toFixed(p >= 10 ? 2 : 4);
const utc = (t: number) => new Date(t * 1000).toISOString().replace("T", " ").slice(0, 19) + " UTC";

async function CallContent({ id }: { id: string }) {
  await connection();
  let p: Play;
  try {
    p = await api<Play>(`/api/play?id=${encodeURIComponent(id)}`);
  } catch {
    notFound();
  }
  const won = p.st === "hit";
  const big = p.st === "open" ? "Pending" : verdict(p);
  const tone = p.st === "open" ? "text-bone-white" : won ? "text-saffron-spark" : "text-white/45";
  const move = p.p1 != null ? ((p.p1 - p.p0) / p.p0) * 100 : null;

  return (
    <div className="mx-auto max-w-[860px] px-[5vw] pt-32 pb-24">
      <p className="text-caption-label text-saffron-spark">Human call #{p.id} · vs the AI swarm</p>
      <h1 className={`mt-5 text-[clamp(44px,9vw,104px)] leading-[0.92] tracking-[-0.045em] ${tone}`}>
        {beatAi(p) ? <span className="text-hype">{big}.</span> : `${big}.`}
      </h1>
      <p className="mt-6 text-[20px] text-bone-white">
        <b>{p.name}</b> called <b>${p.sym}</b>{" "}
        <span className={p.dir > 0 ? "text-saffron-spark" : "text-white/45"}>{p.dir > 0 ? "▲ up" : "▼ down"}</span> for{" "}
        {PLAY_MIN} minutes. The AI swarm said{" "}
        {p.ai === 0 ? "nothing" : p.ai > 0 ? "▲ up" : "▼ down"}
        {p.ai_pct != null && ` (${Math.round((p.ai > 0 ? p.ai_pct : 1 - p.ai_pct) * 100)}%)`}.
      </p>

      <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-[24px] bg-white/10 sm:grid-cols-4">
        {[
          ["Entry", `$${fmt(p.p0)}`],
          ["Settle", p.p1 != null ? `$${fmt(p.p1)}` : "—"],
          ["Move", move != null ? `${move >= 0 ? "+" : ""}${move.toFixed(3)}%` : "—"],
          ["Sealed", utc(p.t0).slice(11, 16) + " UTC"],
        ].map(([k, v]) => (
          <div key={k} className="glass-fx bg-white/[0.06] border border-white/[0.12] backdrop-blur-[20px] p-5">
            <div className="text-[11px] font-semibold tracking-[0.04em] text-ash-gray uppercase">{k}</div>
            <div className="mt-1 font-mono text-[18px] text-bone-white">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-8 rounded-[20px] border border-white/10 p-5 font-mono text-[12px] leading-relaxed break-all text-ash-gray">
        <div>call block · {p.h ?? "—"}</div>
        <div>settle block · {p.sh ?? "pending"}</div>
        <div className="mt-2 font-sans text-[12px]">
          Sealed {utc(p.t0)} with the server&apos;s price. Recompute every hash on the{" "}
          <Link href="/ledger" className="text-bone-white underline decoration-white/30 underline-offset-4">
            ledger
          </Link>
          .
        </div>
      </div>

      <div className="mt-12 flex flex-wrap items-center gap-4">
        <Link href="/play" className="btn-primary btn-lg">
          Your turn — beat the AI →
        </Link>
        <Link href="/track-record" className="link-ghost">
          AI track record →
        </Link>
      </div>
    </div>
  );
}

async function Suspended({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CallContent id={id} />;
}

export default function CallPage(props: { params: Promise<{ id: string }> }) {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/play" />
      <Suspense fallback={<div className="px-[5vw] pt-32 text-ash-gray">Reading the ledger…</div>}>
        <Suspended params={props.params} />
      </Suspense>
    </main>
  );
}
