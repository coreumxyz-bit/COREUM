"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CORS_TOKEN } from "@/lib/cors";
import { VERDICTS_CONTRACT } from "@/lib/verify";

type Anchor = { id: number; ts: number; head_i: number; head_hash: string; kind: "evm" | "ots"; tx: string | null };

const day = (ts: number) => new Date(ts * 1000).toISOString().slice(0, 16).replace("T", " ") + " UTC";

// Where a ledger block stands: covered by a Robinhood Chain anchor tx and/or a
// Bitcoin (OpenTimestamps) anchor, or waiting for the next one.
export default function AnchorStatus({ block, jobId, chainTx }: { block: number; jobId?: number; chainTx?: string | null }) {
  const [anchors, setAnchors] = useState<Anchor[] | null>(null);

  useEffect(() => {
    const load = () =>
      fetch("/api/anchors")
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => Array.isArray(j) && setAnchors(j))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!anchors) return null;
  // the earliest anchor whose head is at or after this block covers it
  const cover = (kind: Anchor["kind"]) =>
    anchors.filter((a) => a.kind === kind && a.head_i >= block).sort((a, b) => a.head_i - b.head_i)[0];
  const chain = cover("evm");
  const btc = cover("ots");
  const chainLive = anchors.some((a) => a.kind === "evm");

  return (
    <div className="mt-6 grid gap-2 text-[13px] sm:grid-cols-2">
      {jobId != null && (
        <div className="rounded-[14px] border border-white/[0.1] bg-white/[0.03] p-4 sm:col-span-2">
          <div className="text-white/50">Verdict on Robinhood Chain · CoreumVerdicts</div>
          {chainTx ? (
            <a
              href={`${CORS_TOKEN.explorer}/tx/${chainTx}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 block font-mono break-all text-white underline decoration-white/30 underline-offset-4"
            >
              written in tx {chainTx.slice(0, 12)}…{chainTx.slice(-6)} ↗
            </a>
          ) : (
            <div className="mt-1 text-white/70">Pending — the hourly run writes new verdicts into the contract.</div>
          )}
          <div className="mt-1 break-all text-white/45">
            read it on-chain:{" "}
            <a
              href={`${CORS_TOKEN.explorer}/address/${VERDICTS_CONTRACT}?tab=read_contract`}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-white/70 underline decoration-white/20 underline-offset-4"
            >
              verdictOf({jobId})
            </a>{" "}
            on {VERDICTS_CONTRACT.slice(0, 8)}…{VERDICTS_CONTRACT.slice(-4)}
          </div>
        </div>
      )}
      <div className="rounded-[14px] border border-white/[0.1] bg-white/[0.03] p-4">
        <div className="text-white/50">Robinhood Chain anchor</div>
        {chain ? (
          <a
            href={`${CORS_TOKEN.explorer}/tx/${chain.tx}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block font-mono break-all text-white underline decoration-white/30 underline-offset-4"
          >
            tx {chain.tx?.slice(0, 12)}…{chain.tx?.slice(-6)} ↗
          </a>
        ) : (
          <div className="mt-1 text-white/70">
            {chainLive ? "Pending — the next hourly anchor will include this block." : "Hourly anchoring is being switched on."}
          </div>
        )}
        {chain && <div className="mt-1 text-white/45">covers ledger up to #{chain.head_i} · {day(chain.ts)}</div>}
      </div>
      <div className="rounded-[14px] border border-white/[0.1] bg-white/[0.03] p-4">
        <div className="text-white/50">Bitcoin anchor (OpenTimestamps)</div>
        {btc ? (
          <a href="/api/anchors" className="mt-1 block text-white underline decoration-white/30 underline-offset-4">
            daily anchor of {day(btc.ts)}
          </a>
        ) : (
          <div className="mt-1 text-white/70">Pending — included in the next daily anchor (00:00 UTC).</div>
        )}
        {btc && <div className="mt-1 text-white/45">covers ledger up to #{btc.head_i}</div>}
      </div>
      <p className="text-white/45 sm:col-span-2">
        This answer is ledger block #{block}. Anchors fix the hash of the whole chain at a point in time, so nothing before
        it can be edited later — recompute it on the{" "}
        <Link href="/ledger" className="text-white/70 underline decoration-white/20 underline-offset-4">
          ledger
        </Link>
        .
      </p>
    </div>
  );
}
