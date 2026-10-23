import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import { api } from "@/lib/api";
import { modelLabel, type Core, type NetworkStats } from "@/lib/verify";

export const metadata = {
  title: "Cores — Coreum",
  description: "Every core in the Coreum verification network: model, uptime, jobs answered, share in the majority.",
};

async function CoresContent() {
  await connection();
  const [cores, stats] = await Promise.all([
    api<Core[]>("/api/cores").catch(() => [] as Core[]),
    api<NetworkStats>("/api/network").catch(() => null),
  ]);
  const t = Date.now() / 1000;
  return (
    <>
      <div className="mt-10 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ["Answers sealed", stats?.done ?? "—"],
          ["Avg agreement", stats ? `${Math.round(stats.agree * 100)}%` : "—"],
          ["Reference cores", stats?.ref ?? "—"],
          ["Community online", stats?.community_online ?? "—"],
        ].map(([k, v]) => (
          <div key={String(k)} className="glass-fx rounded-[20px] border border-white/[0.12] bg-white/[0.06] p-5 backdrop-blur-[20px]">
            <div className="text-[12px] text-white/55">{k}</div>
            <div className="mt-1 font-mono text-[28px] text-white">{v}</div>
          </div>
        ))}
      </div>

      <div className="mt-10 flex flex-col gap-2">
        {cores.map((c) => {
          const online = c.last_seen != null && t - c.last_seen < 120;
          return (
            <div
              key={c.id}
              className="glass-fx grid grid-cols-2 items-center gap-3 rounded-[16px] border border-white/[0.1] bg-white/[0.04] p-4 backdrop-blur-[20px] sm:grid-cols-[2fr_1.4fr_repeat(2,0.8fr)]"
            >
              <div className="col-span-2 sm:col-span-1">
                <div className="flex items-center gap-2 text-[16px] text-white">
                  <span className={`inline-block h-2 w-2 rounded-full ${online ? "bg-white" : "bg-white/20"}`} />
                  {c.name}
                </div>
                <div className="text-[12px] text-white/50">
                  {c.kind === "refcore" ? "reference core · run by Coreum" : "community core"}
                </div>
              </div>
              <div className="text-[13px] text-white/70">{modelLabel(c.model)}</div>
              <div className="font-mono text-[14px] text-white">
                {c.jobs}
                <span className="ml-1 text-[11px] text-white/50">jobs</span>
              </div>
              <div className="font-mono text-[14px] text-white">
                {c.jobs ? `${Math.round((c.majority / c.jobs) * 100)}%` : "—"}
                <span className="ml-1 text-[11px] text-white/50">majority</span>
              </div>
            </div>
          );
        })}
        {cores.length === 0 && <p className="text-white/60">No cores registered yet.</p>}
      </div>
    </>
  );
}

export default function CoresPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/cores" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">The network</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,72px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          Cores
        </h1>
        <p className="mt-5 max-w-[620px] text-[17px] leading-relaxed text-white/75">
          Every answer is computed independently by several cores on different models. Reference cores keep the network
          answering from day one; community cores run on their owners&apos; hardware with their own models.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/nodes" className="btn-primary">
            Deploy a core
          </Link>
          <Link href="/" className="btn-outline">
            Ask the network
          </Link>
        </div>
        <Suspense fallback={<p className="mt-10 text-white/60">Counting cores…</p>}>
          <CoresContent />
        </Suspense>
      </div>
    </main>
  );
}
