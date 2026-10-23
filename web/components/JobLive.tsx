"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { isToken, modelLabel, verdictLabel, type Job, type XSource } from "@/lib/verify";
import { factLines, type TokenFacts } from "@/lib/token";
import { grade, GRADE_NOTE } from "@/lib/grade";
import AnchorStatus from "@/components/AnchorStatus";
import WatchButton from "@/components/WatchButton";

const short = (h: string | null) => (h ? `${h.slice(0, 10)}…${h.slice(-6)}` : "—");

const PHASE: Record<Job["phase"], string> = {
  commit: "Cores are computing — each one sends only a hash of its answer",
  reveal: "Commits closed — cores are revealing their answers",
  sealing: "Tallying and sealing the verdict into the ledger",
  done: "Consensus reached and sealed in the ledger",
  failed: "Not enough cores answered in time — no verdict was sealed",
};

export default function JobLive({ id, initial }: { id: number; initial: Job | null }) {
  const [job, setJob] = useState<Job | null>(initial);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      setNow(Date.now() / 1000);
      try {
        const r = await fetch(`/api/job?id=${id}`);
        if (r.ok) {
          const j = (await r.json()) as Job;
          if (alive) setJob(j);
          if (j.phase === "done" || j.phase === "failed") return;
        }
      } catch {}
      if (alive) setTimeout(tick, 1200);
    };
    void tick();
    return () => {
      alive = false;
    };
  }, [id]);

  if (!job) return <p className="text-white/60">Looking up job #{id}…</p>;

  const live = job.phase === "commit" || job.phase === "reveal" || job.phase === "sealing";
  const elapsed = Math.max(0, Math.round((job.done_at ?? now) - job.created));
  const src = job.src;
  const token = isToken(src) ? src : null;
  const post = src && !token ? (src as XSource) : null;
  // X posts read as true/false, token checks as red flags or not
  const shown = verdictLabel(src, job.verdict);
  const pct = Math.round((job.agree ?? 0) * 100);
  const proof = `https://www.coreum.xyz/v/${job.id}`;
  const share = token
    ? `https://x.com/intent/post?text=${encodeURIComponent(
        shown
          ? `$${token.symbol} on @0xcoreum: ${shown}, grade ${grade(job.verdict, job.agree, token.facts as unknown as TokenFacts).letter}. ${job.n} AI cores, ${pct}% agree, judged from on-chain facts. Sealed on Robinhood Chain:`
          : `Checking $${token.symbol} with the Coreum AI network:`
      )}&url=${encodeURIComponent(proof)}`
    : post
    ? // a reply right under the post that was checked
      `https://x.com/intent/post?in_reply_to=${post.id}&text=${encodeURIComponent(
        shown
          ? `Coreum check: ${shown}. ${job.n} independent AI cores, ${pct}% agree. Commit-reveal, sealed on Robinhood Chain. Proof:`
          : `Checking this with the Coreum AI verification network:`
      )}&url=${encodeURIComponent(proof)}`
    : `https://x.com/intent/post?text=${encodeURIComponent(
        shown
          ? `"${job.q}" → ${shown} · ${job.n} independent AI cores, ${pct}% agree. Commit-reveal, anchored on Robinhood Chain by @0xcoreum:`
          : `Asking the Coreum verification network: "${job.q}"`
      )}&url=${encodeURIComponent(proof)}`;

  return (
    <div className="flex flex-col gap-8">
      {/* the question + verdict */}
      <div className="glass-fx rounded-[28px] border border-white/[0.12] bg-white/[0.06] p-6 backdrop-blur-[20px] sm:p-10">
        <p className="flex items-center gap-2 text-[13px] text-white/60">
          {live && <span className="live-dot" />} Job #{job.id} · {PHASE[job.phase]}
        </p>
        {token ? (
          <>
            <h1 className="mt-4 text-[clamp(26px,4vw,44px)] leading-[1.1] text-white" style={{ fontFamily: "var(--font-sans)" }}>
              Token check: is ${token.symbol} free of red flags?
            </h1>
            <a
              href={token.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 block rounded-[18px] border border-white/[0.12] bg-black/30 p-5 transition-colors hover:border-white/30"
            >
              <div className="flex items-center gap-3">
                {token.image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={token.image} alt="" width={40} height={40} className="h-10 w-10 rounded-full grayscale" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-[13px]">{token.symbol.slice(0, 3)}</span>
                )}
                <div className="min-w-0">
                  <div className="truncate text-[15px] text-white">
                    {token.name} <span className="text-white/50">${token.symbol}</span>
                  </div>
                  <div className="truncate font-mono text-[12px] text-white/50">{token.address} · GeckoTerminal ↗</div>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-1 gap-x-8 gap-y-2 text-[14px] sm:grid-cols-2">
                {factLines(token.facts as unknown as TokenFacts).map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-t border-white/[0.06] pt-2">
                    <dt className="text-white/55">{k}</dt>
                    <dd className="text-right font-mono text-white/90">{v}</dd>
                  </div>
                ))}
              </dl>
            </a>
            {typeof token.facts.devAddress === "string" && !token.facts.devShared && (
              <Link
                href={`/deployer/${token.facts.devAddress}`}
                className="mt-3 inline-block text-[13px] text-white/60 underline decoration-white/25 underline-offset-4 hover:text-white"
              >
                Deployer passport: everything this wallet launched →
              </Link>
            )}
            <WatchButton address={token.address} job={job.id} />
          </>
        ) : post ? (
          <>
            <h1 className="mt-4 text-[clamp(26px,4vw,44px)] leading-[1.1] text-white" style={{ fontFamily: "var(--font-sans)" }}>
              Is this post true?
            </h1>
            <a
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 block rounded-[18px] border border-white/[0.12] bg-black/30 p-5 transition-colors hover:border-white/30"
            >
              <div className="flex items-center gap-3">
                {post.avatar && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.avatar} alt="" width={40} height={40} className="h-10 w-10 rounded-full grayscale" />
                )}
                <div className="min-w-0">
                  <div className="truncate text-[15px] text-white">{post.author}</div>
                  <div className="text-[13px] text-white/50">@{post.handle} · View on X ↗</div>
                </div>
              </div>
              <p className="mt-3 text-[17px] leading-relaxed whitespace-pre-line text-white/90">{post.text}</p>
            </a>
          </>
        ) : (
          <h1 className="mt-4 text-[clamp(26px,4vw,44px)] leading-[1.1] text-white" style={{ fontFamily: "var(--font-sans)" }}>
            {job.q}
          </h1>
        )}

        <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
          <div>
            <div className="text-[13px] text-white/60">Network verdict</div>
            <div
              key={job.verdict ?? job.phase}
              className={`tick mt-1 text-[clamp(56px,10vw,104px)] leading-none font-[450] tracking-[-0.04em] ${
                job.verdict === "YES" ? "text-white" : job.verdict === "NO" ? "text-white/80" : "text-white/50"
              }`}
            >
              {shown ?? (job.phase === "failed" ? "—" : "…")}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-6 text-right">
            {[
              ["Agreement", job.agree != null ? `${Math.round(job.agree * 100)}%` : "—"],
              ["Cores", String(job.n ?? job.work.length)],
              ["Time", `${elapsed}s`],
            ].map(([k, v]) => (
              <div key={k}>
                <div className="text-[12px] text-white/50">{k}</div>
                <div className="mt-1 font-mono text-[22px] text-white">{v}</div>
              </div>
            ))}
          </div>
        </div>

        {token && job.phase === "done" && job.verdict && (() => {
          const g = grade(job.verdict, job.agree, token.facts as unknown as TokenFacts);
          return (
            <Link
              href={`/grade/${token.address}`}
              className="glass-fx mt-6 flex items-center gap-5 rounded-[16px] border border-white/[0.14] bg-white/[0.04] px-5 py-4 backdrop-blur-[20px] transition-colors hover:border-white/35"
            >
              <span className="text-[48px] leading-none font-medium text-white">{g.letter}</span>
              <span className="flex-1">
                <span className="block text-[15px] text-white">
                  Coreum grade · {g.score}/100 — {GRADE_NOTE[g.letter]}
                </span>
                <span className="block text-[13px] text-white/55">{g.reasons[0]?.why ?? "No deductions"} · see why and share →</span>
              </span>
            </Link>
          );
        })()}

        {job.h && (
          <p className="mt-8 font-mono text-[12px] break-all text-white/50">
            sealed block {job.h} ·{" "}
            <Link href="/ledger" className="text-white underline decoration-white/30 underline-offset-4">
              verify the chain
            </Link>
          </p>
        )}
        {job.block_i != null && <AnchorStatus block={job.block_i} jobId={job.id} chainTx={job.chain_tx} />}
        <div className="mt-8 flex flex-wrap gap-3">
          <a href={share} target="_blank" rel="noopener noreferrer" className="btn-primary">
            {post ? "Reply on X with this verdict" : "Share on X"}
          </a>
          <Link href="/" className="btn-outline">
            Ask another
          </Link>
        </div>
      </div>

      {/* each core's work */}
      <div>
        <p className="text-[13px] text-white/60">
          Independent cores · commit first, reveal after — no core can see another&apos;s answer
        </p>
        <div className="mt-3 flex flex-col gap-2">
          {job.work.map((w) => {
            const revealed = !!w.ts_reveal;
            return (
              <div
                key={w.core}
                className="row-in glass-fx grid grid-cols-1 gap-3 rounded-[16px] border border-white/[0.1] bg-white/[0.04] p-4 backdrop-blur-[20px] sm:grid-cols-[1.2fr_0.6fr_2fr]"
              >
                <div>
                  <div className="text-[15px] text-white">{w.name}</div>
                  <div className="text-[12px] text-white/50">
                    {w.kind === "refcore" ? "reference core" : "community core"} · {modelLabel(w.model)}
                  </div>
                </div>
                <div className="font-mono text-[20px] text-white">
                  {revealed ? (w.ok === 1 ? w.verdict : <span className="text-white/40 line-through">{w.verdict}</span>) : "🔒"}
                </div>
                <div className="text-[13px] leading-snug text-white/70">
                  {revealed ? (
                    w.ok === 1 ? (
                      w.reason
                    ) : (
                      <span className="text-white/50">Rejected — the revealed answer does not match its commitment.</span>
                    )
                  ) : (
                    <span className="font-mono text-[12px] text-white/50">commit {short(w.commit)}</span>
                  )}
                </div>
              </div>
            );
          })}
          {job.work.length === 0 && (
            <p className="rounded-[16px] border border-white/[0.1] p-4 text-[14px] text-white/60">
              Waiting for the first core to pick the job up…
            </p>
          )}
        </div>
        <p className="mt-4 text-[12px] leading-relaxed text-white/45">
          Each commitment is sha256(job | verdict | reason | salt). After the reveal anyone can recompute it from the
          values shown. Reference cores are run by Coreum on open models; community cores run on their owners&apos;
          hardware with coreumd. Verdicts reflect the models&apos; knowledge, not financial advice.{token && " A token check reads only the facts listed above — it is a risk screen, not a recommendation to buy or sell."}
        </p>
      </div>
    </div>
  );
}
