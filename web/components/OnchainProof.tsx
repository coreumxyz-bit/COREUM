import { connection } from "next/server";
import { api } from "@/lib/api";
import { CORS_TOKEN } from "@/lib/cors";
import { VERDICTS_CONTRACT } from "@/lib/verify";
import { lastJobId, verdictCount } from "@/lib/chain";

const BS = CORS_TOKEN.explorer;

type Anchor = { kind: "evm" | "ots" };
type Latest = { tx: string | null; jobId: number | null; txs: number };

const short = (h: string) => `${h.slice(0, 10)}…${h.slice(-8)}`;

export default async function OnchainProof() {
  await connection();
  const [count, lastJob, latest, anchors] = await Promise.all([
    verdictCount(),
    lastJobId(),
    api<Latest>("/api/verdicts/latest").catch(() => null),
    api<Anchor[]>("/api/anchors").catch(() => [] as Anchor[]),
  ]);
  const evm = anchors.filter((a) => a.kind === "evm").length;
  const ots = anchors.filter((a) => a.kind === "ots").length;
  const read = `${BS}/address/${VERDICTS_CONTRACT}?tab=read_write_contract`;

  const stats: [string, string][] = [
    [count == null ? "—" : String(count), "verdicts written to the contract"],
    [latest ? String(latest.txs) : "—", "seal transactions so far"],
    [`${evm}×`, "ledger anchored on Robinhood Chain"],
    [`${ots}×`, "ledger anchored on Bitcoin (OpenTimestamps)"],
  ];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.15fr_1fr]">
      <div className="glass-fx rounded-[24px] border border-white/[0.14] bg-white/[0.05] p-7 backdrop-blur-[20px] sm:p-8">
        <p className="font-mono text-[12px] tracking-[0.16em] text-white/50">COREUMVERDICTS · ROBINHOOD CHAIN · 4663</p>
        <a
          href={`${BS}/address/${VERDICTS_CONTRACT}`}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 flex flex-wrap items-center gap-3 font-mono text-[14px] break-all text-white hover:underline sm:text-[16px]"
        >
          {VERDICTS_CONTRACT}
          <span className="rounded-[6px] bg-white px-2 py-0.5 font-sans text-[12px] font-semibold text-black">✓ verified source</span>
        </a>
        <div className="mt-6 rounded-[16px] border border-white/[0.1] bg-black/40 p-5 font-mono text-[14px] leading-[1.8] text-white/80">
          <span className="text-white/45">{"// any contract or person can read it — no wallet"}</span>
          <br />
          verdictOf(<span className="text-white">jobId</span>) → verdict · agreePct · cores · ledgerBlock
          <br />
          answer(<span className="text-white">jobId</span>) → verdict · agreePct
          {lastJob != null && (
            <>
              <br />
              <span className="text-white/45">{`// newest job in the contract: #${lastJob}`}</span>
            </>
          )}
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <a href={read} target="_blank" rel="noopener noreferrer" className="btn-primary">
            Read it on Blockscout ↗
          </a>
          {latest?.tx && (
            <a href={`${BS}/tx/${latest.tx}`} target="_blank" rel="noopener noreferrer" className="btn-outline">
              Latest seal tx ↗
            </a>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          {stats.map(([v, k]) => (
            <div key={k} className="glass-fx rounded-[18px] border border-white/[0.1] bg-white/[0.04] p-5 backdrop-blur-[20px]">
              <div className="font-mono text-[32px] leading-none text-white">{v}</div>
              <div className="mt-2 text-[13px] leading-snug text-white/55">{k}</div>
            </div>
          ))}
        </div>
        <div className="rounded-[18px] border border-white/[0.1] bg-white/[0.03] p-5 text-[13px] leading-relaxed text-white/60">
          {latest?.tx && (
            <p className="font-mono text-[12px] break-all text-white/70">
              latest seal{" "}
              <a href={`${BS}/tx/${latest.tx}`} target="_blank" rel="noopener noreferrer" className="text-white underline decoration-white/30 underline-offset-4">
                {short(latest.tx)}
              </a>{" "}
              · covers jobs up to #{latest.jobId}
            </p>
          )}
          <p className="mt-2">
            Straight up: today the six cores are run by Coreum — Llama, Mistral, Qwen, Gemma and GPT-OSS on Cloudflare, DeepSeek V3 through DeepSeek's API. The
            contract, the hashes and the anchors are public so nobody has to take our word for it. Anyone can run a core of
            their own.{" "}
            <a href="/evidence" className="text-white underline decoration-white/30 underline-offset-4">
              What is proven, and what is not →
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
