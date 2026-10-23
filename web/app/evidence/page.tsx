import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import { api } from "@/lib/api";
import { lastJobId, verdictCount } from "@/lib/chain";
import { CORS_TOKEN } from "@/lib/cors";
import { VERDICTS_CONTRACT } from "@/lib/verify";

export const metadata = {
  title: "Evidence — Coreum",
  description: "What Coreum has proven, what it has not yet, and how to check every claim yourself on Robinhood Chain and Bitcoin.",
};

const BS = CORS_TOKEN.explorer;
type Status = "Proven" | "Partly" | "Not yet";
type Row = { id?: string; claim: string; status: Status; boundary: string; check: { label: string; href: string }[] };

// Each claim says exactly how far the evidence goes. Keep "Not yet" rows until they are true.
const ROWS: Row[] = [
  {
    claim: "Every verdict is written into a verified contract on Robinhood Chain",
    status: "Proven",
    boundary: "Written hourly in batches, so the newest verdicts stay pending for up to an hour.",
    check: [
      { label: "Contract source", href: `${BS}/address/${VERDICTS_CONTRACT}?tab=contract` },
      { label: "Read verdictOf()", href: `${BS}/address/${VERDICTS_CONTRACT}?tab=read_write_contract` },
    ],
  },
  {
    claim: "Only the network's wallet can write, and a written verdict cannot be changed",
    status: "Proven",
    boundary: "Enforced by the contract code: seal() is writer-only and skips jobs already sealed.",
    check: [{ label: "seal() in the source", href: `${BS}/address/${VERDICTS_CONTRACT}?tab=contract` }],
  },
  {
    claim: "Cores commit a hash before anyone reveals (commit–reveal)",
    status: "Proven",
    boundary: "Every commitment, verdict, reason and salt is public; recompute sha256(job | verdict | reason | salt).",
    check: [{ label: "Any answer page", href: "/v/47" }],
  },
  {
    claim: "The ledger is a SHA-256 hash chain anyone can recompute",
    status: "Proven",
    boundary: "Recomputing proves nothing was edited after the fact — not that the answers are right.",
    check: [
      { label: "Verify in the browser", href: "/ledger" },
      { label: "Full export (JSON)", href: "/api/export" },
    ],
  },
  {
    claim: "Each verdict is sealed into the ledger exactly once",
    status: "Partly",
    boundary:
      "Jobs #19, #35, #37, #38 and #53 were sealed twice by a race, fixed on 20 Oct 2026. Both copies stay — editing the ledger would break the chain — and the contract holds one of each.",
    check: [{ label: "Run the verifier", href: "/evidence#reproduce" }],
  },
  {
    claim: "The ledger head is anchored on Robinhood Chain every hour",
    status: "Proven",
    boundary: "Each anchor is a transaction whose calldata reads coreum-anchor:v1:<block>:<hash>.",
    check: [{ label: "Anchor list", href: "/api/anchors" }],
  },
  {
    claim: "The ledger head is anchored on Bitcoin every day",
    status: "Proven",
    boundary: "Via OpenTimestamps; a stamp becomes a Bitcoin proof once its calendar commits (a few hours).",
    check: [{ label: "Anchor list (kind: ots)", href: "/api/anchors" }],
  },
  {
    claim: "Five different AI models answer every question",
    status: "Proven",
    boundary: "Llama 3.3 70B, Mistral Small 3.1, Qwen3 30B, Gemma 4 26B, GPT-OSS 20B — named on every answer.",
    check: [{ label: "Cores", href: "/cores" }],
  },
  {
    claim: "Token Check judges a token from its on-chain facts",
    status: "Partly",
    boundary: "Facts come from GeckoTerminal and the token's owner() over RPC. A risk screen, not a code audit.",
    check: [{ label: "Example: $CORS", href: "/v/47" }],
  },
  {
    id: "operators",
    claim: "The cores are run by independent operators",
    status: "Not yet",
    boundary: "Today all six reference cores are run by Coreum: five open models on Cloudflare Workers AI and DeepSeek V3 through DeepSeek's API. Anyone can run a community core; none is online yet.",
    check: [{ label: "Run a core", href: "/nodes" }],
  },
  {
    claim: "The network knows about recent events",
    status: "Not yet",
    boundary: "Cores answer from model knowledge, with no web search; on topics newer than their training they answer UNSURE.",
    check: [{ label: "Example", href: "/v/29" }],
  },
  {
    claim: "Every verdict is correct",
    status: "Not yet",
    boundary: "Not claimed. A verdict is what independent models agree on — they can be wrong together.",
    check: [{ label: "Accuracy record", href: "/track-record" }],
  },
];

const BADGE: Record<Status, string> = {
  Proven: "border-white bg-white text-black",
  Partly: "border-white/50 text-white",
  "Not yet": "border-dashed border-white/35 text-white/70",
};

async function Live() {
  await connection();
  const [count, last, anchors] = await Promise.all([
    verdictCount(),
    lastJobId(),
    api<{ kind: string }[]>("/api/anchors").catch(() => []),
  ]);
  const items: [string, string][] = [
    [count == null ? "—" : String(count), "verdicts in the contract"],
    [last == null ? "—" : `#${last}`, "newest job sealed"],
    [String(anchors.filter((a) => a.kind === "evm").length), "Robinhood Chain anchors"],
    [String(anchors.filter((a) => a.kind === "ots").length), "Bitcoin anchors"],
  ];
  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {items.map(([v, k]) => (
        <div key={k} className="rounded-[16px] border border-white/[0.12] bg-white/[0.04] p-5">
          <div className="font-mono text-[30px] leading-none text-white">{v}</div>
          <div className="mt-2 text-[12px] text-white/55">{k}</div>
        </div>
      ))}
    </div>
  );
}


// The operators row follows the live network: it turns Partly as soon as a
// community core has actually answered, and says how many.
type CoreRow = { kind: string; last_seen: number | null; jobs: number };
async function Table() {
  await connection();
  const cores = await api<CoreRow[]>("/api/cores").catch(() => [] as CoreRow[]);
  const t = Date.now() / 1000;
  const community = cores.filter((c) => c.kind === "external");
  const active = community.filter((c) => (c.last_seen ?? 0) > t - 86400 && c.jobs > 0).length;
  const online = community.filter((c) => (c.last_seen ?? 0) > t - 120).length;
  const rows = ROWS.map((r) =>
    r.id === "operators" && active
      ? {
          ...r,
          status: "Partly" as Status,
          boundary: `${active} community core${active > 1 ? "s" : ""} answered in the last 24h (${online} online now), running their own models on their own hardware. The six reference cores are still run by Coreum.`,
        }
      : r
  );
  const counts = rows.reduce<Record<Status, number>>((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {} as Record<Status, number>);
  return (
    <>
          <p className="mt-4 font-mono text-[12px] text-white/45">
            {counts.Proven} proven · {counts.Partly ?? 0} partly · {counts["Not yet"]} not yet
          </p>
          <div className="mt-10 overflow-hidden rounded-[20px] border border-white/[0.12]">
            <div className="hidden grid-cols-[1.4fr_110px_1.6fr_190px] gap-6 border-b border-white/[0.1] bg-white/[0.03] px-6 py-3 font-mono text-[11px] tracking-[0.14em] text-white/45 md:grid">
              <span>CLAIM</span>
              <span>STATUS</span>
              <span>EVIDENCE BOUNDARY</span>
              <span>CHECK IT</span>
            </div>
            {rows.map((r, i) => (
              <div
                key={r.claim}
                className={`grid grid-cols-1 gap-3 px-6 py-5 md:grid-cols-[1.4fr_110px_1.6fr_190px] md:gap-6 ${i ? "border-t border-white/[0.08]" : ""}`}
              >
                <div className="text-[15px] leading-snug text-white">{r.claim}</div>
                <div>
                  <span className={`inline-block rounded-[6px] border px-2 py-0.5 font-mono text-[11px] tracking-[0.06em] uppercase ${BADGE[r.status]}`}>
                    {r.status}
                  </span>
                </div>
                <div className="text-[14px] leading-relaxed text-white/60">{r.boundary}</div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
                  {r.check.map((c) => {
                    const ext = c.href.startsWith("http");
                    return (
                      <Link
                        key={c.label}
                        href={c.href}
                        {...(ext ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        className="text-white/80 underline decoration-white/25 underline-offset-4 hover:text-white"
                      >
                        {c.label}
                        {ext ? " ↗" : ""}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
    </>
  );
}

export default function EvidencePage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/evidence" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="font-mono text-[12px] tracking-[0.16em] text-white/55">EVIDENCE · LIVE</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,72px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          What is proven. <span className="text-white/45">What is not.</span>
        </h1>
        <p className="mt-6 max-w-[680px] text-[17px] leading-relaxed text-white/75">
          Every claim Coreum makes, with how far the evidence goes and where to check it yourself — on Robinhood Chain, on
          Bitcoin, or by recomputing the hashes. If a row says <b className="font-medium text-white">Not yet</b>, we do not claim it.
        </p>


        <div className="mt-10">
          <Suspense fallback={<p className="text-white/55">Reading Robinhood Chain…</p>}>
            <Live />
          </Suspense>
        </div>

        <Suspense fallback={<p className="mt-10 text-white/55">Reading the network…</p>}>
          <Table />
        </Suspense>

        <section id="reproduce" className="mt-14 scroll-mt-28">
          <p className="font-mono text-[12px] tracking-[0.16em] text-white/55">REPRODUCE</p>
          <h2 className="mt-3 text-[32px] leading-tight text-white">Check it yourself in one command.</h2>
          <p className="mt-4 max-w-[680px] text-[15px] leading-relaxed text-white/70">
            One file, no dependencies, Node 18+. It downloads the ledger and recomputes every hash, reads each verdict straight
            from the contract on Robinhood Chain, matches every anchor transaction to the ledger, and recomputes the cores&apos;
            commitments from their revealed answers. It never signs or sends anything.
          </p>
          <pre className="mt-5 max-w-[760px] overflow-x-auto rounded-[16px] border border-white/[0.1] bg-white/[0.04] p-5 font-mono text-[13px] leading-relaxed text-white/80">
            {`curl -O https://www.coreum.xyz/verify-coreum.mjs
node verify-coreum.mjs              # commit-reveal on the last 10 jobs
node verify-coreum.mjs --reveal 60  # or more`}
          </pre>
          <p className="mt-3 text-[13px] text-white/50">
            Read the script before you run it:{" "}
            <a href="/verify-coreum.mjs" className="text-white/80 underline decoration-white/25 underline-offset-4">
              verify-coreum.mjs
            </a>
            . Exit code 0 means everything matched; anything else prints what did not.
          </p>
        </section>

        <p className="mt-12 max-w-[680px] text-[13px] leading-relaxed text-white/45">
          Found a claim on this site that is not on this page, or a row that overstates? Tell us on X —{" "}
          <a href="https://x.com/0xcoreum" target="_blank" rel="noopener noreferrer" className="underline decoration-white/25 underline-offset-4">
            @0xcoreum
          </a>
          . Contract: <span className="font-mono">{VERDICTS_CONTRACT}</span>
        </p>
      </div>
    </main>
  );
}
