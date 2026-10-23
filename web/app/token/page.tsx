import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import AskBox from "@/components/AskBox";
import { api } from "@/lib/api";
import { CORS_TOKEN } from "@/lib/cors";
import { verdictLabel, type TokenSrc, type Verdict } from "@/lib/verify";

export const metadata = {
  title: "Token Check — Coreum",
  description: "Paste a Robinhood Chain token. Independent AI cores judge its on-chain facts for rug-pull red flags; the verdict is sealed on Robinhood Chain.",
};

type Check = { id: number; verdict: Verdict; agree: number; n: number; done_at: number; src: TokenSrc };

const ago = (t: number) => {
  const s = Math.max(0, Date.now() / 1000 - t);
  return s < 3600 ? `${Math.max(1, Math.round(s / 60))}m ago` : s < 86400 ? `${Math.round(s / 3600)}h ago` : `${Math.round(s / 86400)}d ago`;
};

async function Recent() {
  await connection();
  let rows: Check[] = [];
  try {
    rows = await api<Check[]>("/api/token-checks?limit=30");
  } catch {}
  if (!rows.length) return <p className="text-[14px] text-white/55">No tokens checked yet — be the first.</p>;
  return (
    <div className="flex flex-col gap-2">
      {rows.map((r) => (
        <Link
          key={r.id}
          href={`/v/${r.id}`}
          className="glass-fx grid grid-cols-[40px_1fr_auto] items-center gap-4 rounded-[16px] border border-white/[0.1] bg-white/[0.04] p-4 backdrop-blur-[20px] transition-colors hover:border-white/30"
        >
          {r.src.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={r.src.image} alt="" width={40} height={40} className="h-10 w-10 rounded-full grayscale" />
          ) : (
            <span className="grid h-10 w-10 place-items-center rounded-full border border-white/20 text-[12px]">{r.src.symbol.slice(0, 3)}</span>
          )}
          <div className="min-w-0">
            <div className="truncate text-[15px] text-white">
              {r.src.name} <span className="text-white/50">${r.src.symbol}</span>
            </div>
            <div className="truncate font-mono text-[12px] text-white/45">
              {r.src.address.slice(0, 10)}…{r.src.address.slice(-6)} · {ago(r.done_at)}
            </div>
          </div>
          <div className="text-right">
            <div className="font-mono text-[15px] text-white">{verdictLabel(r.src, r.verdict)}</div>
            <div className="text-[12px] text-white/45">
              {Math.round(r.agree * 100)}% · {r.n} cores
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function TokenPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/token" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">Token Check</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,72px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          Rug or not? <span className="text-white/45">Ask the network.</span>
        </h1>
        <p className="mt-6 max-w-[660px] text-[17px] leading-relaxed text-white/75">
          Paste any token on Robinhood Chain — Pons launches included. Coreum pulls its on-chain facts (holders, deployer share,
          the deployer's past launches, honeypot, owner, liquidity, curve), six independent AI cores judge them with commit–reveal, and the verdict is
          sealed on Robinhood Chain.
        </p>

        <div className="mt-10 max-w-[760px]">
          <AskBox
            placeholder="Paste a token address or Pons link — 0x…"
            cta="Check token"
            examples={[{ label: `$${CORS_TOKEN.symbol} · Coreum`, value: CORS_TOKEN.address }]}
          />
          <p className="mt-4 text-[12px] leading-relaxed text-white/45">
            Verdicts: <b className="font-medium text-white/70">NO RED FLAGS</b>, <b className="font-medium text-white/70">RED FLAGS</b> or{" "}
            <b className="font-medium text-white/70">MIXED</b>. Judged only from the facts shown on each check (GeckoTerminal + the
            token contract). A risk screen, not financial advice — always do your own research.
          </p>
        </div>

        <div className="glass-fx mt-10 max-w-[760px] rounded-[18px] border border-white/[0.12] bg-white/[0.04] p-6 backdrop-blur-[20px]">
          <p className="text-[12px] tracking-[0.12em] text-white/50 uppercase">New · Deployer history</p>
          <p className="mt-2 text-[16px] leading-relaxed text-white/85">
            Every check now reads the chain for everything the same wallet launched on Pons before — how many tokens, how many
            reached a DEX, how many died. A wallet with a trail of dead launches is a red flag the cores see too.
          </p>
          <p className="mt-2 text-[13px] text-white/50">
            Tokens made through a shared launcher contract are marked as such — that contract is many people, not one record.
          </p>
        </div>

        <section className="mt-16 border-t border-white/10 pt-10">
          <h2 className="text-[28px] leading-tight text-white">Latest checks</h2>
          <div className="mt-6 max-w-[860px]">
            <Suspense fallback={<p className="text-white/55">Reading the network…</p>}>
              <Recent />
            </Suspense>
          </div>
        </section>
      </div>
    </main>
  );
}
