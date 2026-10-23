import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import VerifyChain from "@/components/VerifyChain";
import { ledgerHead, ledgerList, ledgerSize } from "@/lib/ledger";

export const metadata = { title: "Ledger — Coreum" };

function shx(h: string | null | undefined): string {
  return h ? "0x" + h.slice(0, 6) + "…" + h.slice(-4) : "—";
}

async function LedgerContent() {
  await connection();
  const [total, head, blocks] = await Promise.all([ledgerSize(), ledgerHead(), ledgerList(20)]);

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-45 pb-24">
      <p className="text-nav-label mb-4 text-saffron-spark">
        Proof-of-prediction
      </p>
      <h1 className="text-heading mb-6 text-bone-white">Nothing can be deleted.</h1>
      <p className="text-body-copy mb-10 max-w-[640px] text-silver-mist">
        Each block hashes its content plus the previous block. Change anything in
        the past and verification breaks right there — and you can check it
        yourself, right in this browser.
      </p>

      <div className="mb-12 flex flex-wrap gap-x-16 gap-y-8">
        <div>
          <div className="text-heading-2xs text-bone-white">{total}</div>
          <div className="text-caption-label mt-1 text-ash-gray">blocks</div>
        </div>
        <div>
          <div className="font-mono text-heading-2xs text-bone-white">
            {shx(head?.hash)}
          </div>
          <div className="text-caption-label mt-1 text-ash-gray">chain head</div>
        </div>
      </div>

      <VerifyChain />

      <div className="mt-14">
        <p className="text-nav-label mb-6 text-saffron-spark">
          Latest blocks · first 20
        </p>
        {total === 0 && (
          <p className="text-body-copy text-ash-gray">
            The chain is empty — nodes seal their first calls within a minute of
            real market data loading.
          </p>
        )}
        <div className="flex flex-col">
          {blocks.map((e) => {
            const d = JSON.parse(e.data) as Record<string, unknown>;
            const arrow = Number(d.dir) > 0 ? "▲" : "▼";
            const summary =
              e.type === "pred"
                ? `prediction · $${String(d.sym)} ${arrow} ${d.conf}% · seal ${Number(d.p0)}`
                : e.type === "settle"
                  ? `settlement of call ${String(d.pid)} · price ${Number(d.p1)} · ${d.hit ? "hit" : "miss"}`
                  : e.type === "play"
                    ? `human call · ${String(d.name)} · $${String(d.sym)} ${arrow} · seal ${Number(d.p0)}`
                    : e.type === "play_settle"
                      ? `human call ${String(d.id)} settled · price ${Number(d.p1)} · ${d.hit ? "hit" : "miss"}`
                      : e.type === "verify"
                        ? `verified answer · job ${String(d.job)} · ${String(d.verdict)} · ${Math.round(Number(d.agree) * 100)}% of ${Number(d.n)} cores`
                        : `${e.type} block`;
            return (
              <div
                key={e.i}
                className="grid grid-cols-[1fr_auto] items-baseline gap-x-6 border-t border-white/10 py-4"
              >
                <div>
                  <div className="text-[17px] font-normal text-bone-white">
                    #{e.i}{" "}
                    <span className="text-[14px] text-silver-mist">{summary}</span>
                  </div>
                  <div className="mt-1 font-mono text-[12px] text-ash-gray">
                    prev {e.i ? shx(e.prev) : "genesis"}
                  </div>
                </div>
                <div className="text-right font-mono text-[12px] text-ash-gray">
                  {shx(e.hash)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default function LedgerPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/ledger" />
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1280px] px-6 py-12">
            <p className="text-body-copy text-ash-gray">Sealing blocks…</p>
          </div>
        }
      >
        <LedgerContent />
      </Suspense>
    </main>
  );
}
