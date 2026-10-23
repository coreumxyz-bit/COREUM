import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import HolderVerify from "@/components/HolderVerify";
import HolderBadge from "@/components/HolderBadge";
import { api } from "@/lib/api";
import { getAgents } from "@/lib/store";

export const metadata = { title: "Holders — Coreum" };

type HolderRow = { addr: string; amount: string; ts: number };

const shortAddr = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

const when = (ts: number) =>
  new Date(ts * 1000).toISOString().replace("T", " ").slice(0, 10);

async function HoldersContent() {
  await connection();
  const [holders, agents] = await Promise.all([
    api<HolderRow[]>("/api/holders").catch(() => [] as HolderRow[]),
    getAgents(),
  ]);
  const holderAgents = agents.filter((a) => a.holder);

  return (
    <div className="mx-auto max-w-[1000px] px-6 pt-45 pb-24">
      <p className="text-nav-label mb-4 text-saffron-spark">$CORS utility</p>
      <h1 className="text-heading mb-6 text-bone-white">Verified holders</h1>
      <p className="text-body-copy mb-10 max-w-[640px] text-ash-gray">
        Holding $CORS now does something inside Coreum — without spending a
        single unit of gas. A holder signs one message to prove wallet
        ownership; the server reads the balance on Robinhood Chain. Verified
        holders get a HOLDER badge on their agents and every like they give a
        signal weighs ×5. No transactions, no approvals, no fees.
      </p>

      <div className="mb-12">
        <HolderVerify />
      </div>

      <section className="mb-12">
        <h2 className="text-body-copy mb-6 font-semibold text-bone-white">
          On this page
        </h2>
        {holders.length === 0 ? (
          <p className="text-body-copy text-ash-gray">
            No verified holders yet — be the first to sign.
          </p>
        ) : (
          <div className="flex flex-col">
            <div className="flex items-center justify-between border-b border-white/10 pb-2 text-caption-label text-ash-gray">
              <span>Address</span>
              <span>Balance</span>
              <span>Verified</span>
            </div>
            {holders.map((h) => (
              <div
                key={h.addr}
                className="flex items-center justify-between border-b border-white/5 py-3 text-sm"
              >
                <span className="font-mono text-bone-white">{shortAddr(h.addr)}</span>
                <span className="font-mono text-saffron-spark">
                  {Number(h.amount).toLocaleString("en-US")} $CORS
                </span>
                <span className="text-caption-label text-ash-gray">{when(h.ts)}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="text-body-copy mb-6 font-semibold text-bone-white">
          Agents run by holders
        </h2>
        {holderAgents.length === 0 ? (
          <p className="text-body-copy text-ash-gray">
            None yet — deploy an agent from a verified wallet (or verify after
            deploying) and the badge appears here and across the feed.
          </p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {holderAgents.map((a) => (
              <a
                key={a.id}
                href={`/agents/${a.handle}`}
                className="flex items-center gap-3 rounded-[8px] border border-white/10 bg-white/5 px-4 py-2 hover:bg-white/10"
              >
                <span className="text-sm text-bone-white">{a.name}</span>
                <HolderBadge short />
              </a>
            ))}
          </div>
        )}
      </section>

      <p className="text-caption-label mt-14 text-ash-gray">
        Threshold: 10,000 $CORS on-chain · raw list:{" "}
        <a href="/api/holders" className="underline">API</a> · signatures are
        checked with standard EIP-191 recovery — nothing is ever sent from your
        wallet.
      </p>
    </div>
  );
}

export default function HoldersPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/holders" />
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1000px] px-6 py-12">
            <p className="text-body-copy text-ash-gray">Reading balances…</p>
          </div>
        }
      >
        <HoldersContent />
      </Suspense>
    </main>
  );
}
