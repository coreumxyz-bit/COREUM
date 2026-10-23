import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import { stockBoard, STOCK_TOKENS } from "@/lib/stocks";

export const metadata = {
  title: "Stock tokens — Coreum",
  description: "Every official Robinhood stock token on Robinhood Chain against the real share: price gap, liquidity, and how to tell the real token from a copy.",
};

const usd = (v: number | null, d = 2) => (v == null ? "—" : v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : v >= 1e3 ? `$${(v / 1e3).toFixed(1)}K` : `$${v.toFixed(d)}`);
const pct = (v: number | null) => (v == null ? "—" : `${v > 0 ? "+" : ""}${(v * 100).toFixed(2)}%`);

async function Board() {
  await connection();
  const rows = await stockBoard();
  const open = rows.some((r) => r.open);
  const off = rows.filter((r) => r.status === "off");
  return (
    <>
      <p className="mt-6 flex items-center gap-2 text-[14px] text-white/65">
        <span className="live-dot" />
        {open ? "US market open · gaps are live" : "US market closed · tokens keep trading 24/7, so gaps show the move since the close"}
        {off.length > 0 && <span className="text-white"> · {off.length} off by 3%+</span>}
      </p>
      <div className="glass-fx mt-6 overflow-x-auto rounded-[18px] border border-white/[0.12] bg-white/[0.03] backdrop-blur-[20px]">
        <table className="w-full min-w-[720px] text-left text-[14px]">
          <thead>
            <tr className="border-b border-white/10 text-[12px] tracking-[0.08em] text-white/45 uppercase">
              <th className="px-5 py-3 font-normal">Stock</th>
              <th className="px-5 py-3 text-right font-normal">Token on chain</th>
              <th className="px-5 py-3 text-right font-normal">{open ? "Market now" : "Last close"}</th>
              <th className="px-5 py-3 text-right font-normal">Gap</th>
              <th className="px-5 py-3 text-right font-normal">Liquidity</th>
              <th className="px-5 py-3 text-right font-normal">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.address} className="border-b border-white/[0.06] last:border-0">
                <td className="px-5 py-2.5">
                  <a href={`https://www.geckoterminal.com/robinhood/tokens/${r.address}`} target="_blank" rel="noopener noreferrer" className="hover:underline">
                    <span className="font-mono text-white">{r.sym}</span> <span className="text-white/50">{r.name}</span>
                  </a>
                </td>
                <td className="px-5 py-2.5 text-right font-mono text-white">{usd(r.token)}</td>
                <td className="px-5 py-2.5 text-right font-mono text-white/75">{usd(r.market)}</td>
                <td className={`px-5 py-2.5 text-right font-mono ${r.status === "off" ? "text-white" : "text-white/75"}`}>{pct(r.gap)}</td>
                <td className="px-5 py-2.5 text-right font-mono text-white/60">{usd(r.liquidity, 0)}</td>
                <td className={`px-5 py-2.5 text-right text-[13px] ${r.status === "off" ? "font-medium text-white" : "text-white/55"}`}>
                  {r.status === "off" ? "⚠ off by 3%+" : r.status}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-[12px] text-white/40">
        Token prices from GeckoTerminal, market prices from Yahoo Finance, refreshed every minute. While the exchange is closed the
        gap is expected: the token trades on, the share does not.
      </p>
    </>
  );
}

export default function StocksPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/stocks" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">Stock tokens · Robinhood Chain</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,76px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          Is your stock token <span className="text-white/45">the real one, at the real price?</span>
        </h1>
        <p className="mt-6 max-w-[700px] text-[17px] leading-relaxed text-white/75">
          Robinhood Chain carries {STOCK_TOKENS.length} official stock tokens, from TSLA to SPY. The network watches each one against the
          real share on its exchange, and Token Check flags any token that borrows a stock&apos;s ticker without being the official one.
        </p>

        <Suspense fallback={<p className="mt-10 text-white/55">Reading prices…</p>}>
          <Board />
        </Suspense>

        <section className="mt-16 max-w-[820px]">
          <h2 className="text-[28px] text-white">Real or copy?</h2>
          <p className="mt-3 text-[16px] leading-relaxed text-white/70">
            Official tokens are named &quot;Company • Robinhood Token&quot;, like &quot;Tesla • Robinhood Token&quot;. Anyone can launch a token called
            TSLA or AMD, and dozens have. Paste any token into{" "}
            <Link href="/token" className="underline decoration-white/30 underline-offset-4 hover:text-white">
              Token Check
            </Link>{" "}
            and the cores are told when it borrows the ticker of a real stock token.
          </p>
          <p className="mt-6 text-[12px] text-white/40">Market data for information only — not financial advice.</p>
        </section>
      </div>
    </main>
  );
}
