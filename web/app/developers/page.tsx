import Link from "next/link";
import Nav from "@/components/Nav";
import { CORS_TOKEN } from "@/lib/cors";

export const metadata = {
  title: "API & badge — Coreum",
  description: "Put Coreum token checks on your launchpad, wallet or bot: a free JSON API and an SVG badge with the latest verdict.",
};

const A = CORS_TOKEN.address;
const SITE = "https://www.coreum.xyz";

function Code({ children }: { children: string }) {
  return (
    <pre className="mt-3 overflow-x-auto rounded-[14px] border border-white/[0.1] bg-black/60 p-4 font-mono text-[13px] leading-relaxed text-white/85">
      {children}
    </pre>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-16 border-t border-white/10 pt-10">
      <p className="font-mono text-[12px] text-white/45">{n}</p>
      <h2 className="mt-2 text-[28px] leading-tight text-white">{title}</h2>
      <div className="mt-4 max-w-[820px] text-[16px] leading-relaxed text-white/75">{children}</div>
    </section>
  );
}

const SAMPLE = `{
  "address": "${A}",
  "name": "COREUM",
  "symbol": "CORS",
  "status": "checked",            // checked | checking | not_checked
  "verdict": "NO_RED_FLAGS",      // NO_RED_FLAGS | RED_FLAGS | MIXED
  "agreement": 0.75,              // share of cores that agree
  "cores": 4,
  "checked_at": "2026-10-22T04:24:01.000Z",
  "age_hours": 1.2,
  "facts": {
    "holders": 126, "top10_pct": 63.9, "deployer_pct": 0, "honeypot": false,
    "owner": "none", "liquidity_usd": 8200, "volume24_usd": 26600, "fdv_usd": 15100,
    "pool_age_days": 4.9, "curve_pct": 38, "graduated": false
  },
  "deployer": {
    "address": "0x9c75…e9b5", "shared_launcher": false,
    "other_launches": 0, "graduated": 0, "dead": 0
  },
  "proof": {
    "job": 98,
    "page": "${SITE}/v/98",
    "ledger_block": "c1e40257…",   // SHA-256 ledger block
    "chain_tx": "0x…"              // CoreumVerdicts on Robinhood Chain (within the hour)
  },
  "badge": "${SITE}/api/v1/badge/${A}",
  "check_url": "${SITE}/t/${A}"
}`;

export default function DevelopersPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/developers" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">For launchpads, wallets and bots</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,72px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          A second opinion <span className="text-white/45">at the buy button.</span>
        </h1>
        <p className="mt-6 max-w-[700px] text-[17px] leading-relaxed text-white/75">
          Show your users, or your trading agent, what six independent AI cores think of a token before they buy it, with the facts they judged,
          the deployer&apos;s past launches and a verdict sealed on Robinhood Chain. One GET request, or one image tag.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={`/api/v1/badge/${A}`} alt="Coreum check badge for $CORS" height={22} />
          <span className="text-[13px] text-white/50">← live badge for ${CORS_TOKEN.symbol}</span>
        </div>

        <Section n="01" title="Read the latest verdict">
          <p>
            No key, CORS open, cached for a minute. If the network has not checked the token yet, <code>status</code> is{" "}
            <code>not_checked</code> — ask for a check below.
          </p>
          <Code>{`curl ${SITE}/api/v1/token/${A}`}</Code>
          <Code>{SAMPLE}</Code>
        </Section>

        <Section n="02" title="Ask for a fresh check">
          <p>
            The cores answer in about a minute. Poll the GET endpoint until <code>status</code> is <code>checked</code>. Fresh
            checks share the site&apos;s daily limits — call it when a token is new or its last check is old (see{" "}
            <code>age_hours</code>), not on every page view.
          </p>
          <Code>{`curl -X POST ${SITE}/api/v1/check \\
  -H "content-type: application/json" \\
  -d '{"address": "${A}"}'

→ 202 {"job": 99, "status": "checking", "page": "${SITE}/v/99", ...}`}</Code>
        </Section>

        <Section n="03" title="Drop in the badge">
          <p>An SVG that always shows the latest verdict. It links to the full check with every core&apos;s reasoning.</p>
          <Code>{`<a href="${SITE}/t/${A}">
  <img src="${SITE}/api/v1/badge/${A}" alt="Coreum check" height="22">
</a>`}</Code>
          <p className="mt-4">Markdown:</p>
          <Code>{`[![Coreum check](${SITE}/api/v1/badge/${A})](${SITE}/t/${A})`}</Code>
        </Section>

        <Section n="04" title="For AI agents (MCP)">
          <p>
            Trading agents can ask the network before they buy. Coreum runs a remote MCP server: add it to Claude, Cursor or any
            MCP client and call <code>check_token</code> with an address. The agent gets the grade, every deduction, a signal (
            <code>ok</code> / <code>caution</code> / <code>avoid</code>) and the proof link.
          </p>
          <Code>{`{
  "mcpServers": {
    "coreum": { "url": "${SITE}/mcp" }
  }
}`}</Code>
          <Code>{`→ check_token({ "address": "${A}" })

$CORS (COREUM) on Robinhood Chain
Grade: B (80/100) · signal: ok
Verdict: MIXED · 40% of 5 cores agree
Deductions:
  -20 Cores were split or unsure
Proof (sealed on Robinhood Chain): ${SITE}/v/107`}</Code>
        </Section>

        <Section n="05" title="On-chain, for smart contracts">
          <p>
            The latest grade of every checked token is written every hour into{" "}
            <a
              href="https://robinhoodchain.blockscout.com/address/0x32F69057dFda5785A898e33933853aBD0EEF1Db7?tab=contract"
              target="_blank"
              rel="noopener noreferrer"
              className="underline decoration-white/30 underline-offset-4 hover:text-white"
            >
              CoreumTokenRegistry
            </a>{" "}
            on Robinhood Chain. A launchpad, a swap or a vault can read it in one call, with no API and no trust in our servers.
          </p>
          <Code>{`interface ICoreumTokenRegistry {
  // true when the token was graded A or B within maxAge seconds
  function isClean(address token, uint256 maxAge) external view returns (bool ok, uint8 letter);
}

ICoreumTokenRegistry constant COREUM = ICoreumTokenRegistry(0x32F69057dFda5785A898e33933853aBD0EEF1Db7);

(bool ok, ) = COREUM.isClean(token, 1 days);
require(ok, "Coreum: no recent clean grade");`}</Code>
          <p className="mt-3 text-[14px] text-white/55">
            gradeOf(token) returns the full entry: letter (1 A to 5 F), score, verdict, agreement, job id and check time. The list it is
            written from: <code>{`${SITE}/api/v1/grades`}</code>
          </p>
        </Section>

        <Section n="06" title="What a verdict means">
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <b className="font-medium text-white">NO_RED_FLAGS</b> — the cores found no major rug-pull signs in the facts shown.
            </li>
            <li>
              <b className="font-medium text-white">RED_FLAGS</b> — clear risks: honeypot, an owner or deployer able to control
              supply, near-zero liquidity, a few wallets holding most supply after graduation, a deployer whose earlier launches
              mostly died.
            </li>
            <li>
              <b className="font-medium text-white">MIXED</b> — the cores disagree or the data is too thin.
            </li>
          </ul>
          <p className="mt-4">
            It is a risk screen from public on-chain facts, not an audit and not financial advice. Facts come from GeckoTerminal
            and the chain; anyone can recompute every hash with the{" "}
            <Link href="/evidence" className="underline decoration-white/30 underline-offset-4 hover:text-white">
              open verifier
            </Link>
            .
          </p>
        </Section>

        <Section n="07" title="Limits and contact">
          <p>
            Free while in beta. Reads are cached and unmetered; fresh checks follow the site&apos;s daily limits per IP. Need more
            checks for a launchpad or a wallet? Message{" "}
            <a href="https://x.com/0xcoreum" target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-4 hover:text-white">
              @0xcoreum
            </a>
            . The code is{" "}
            <a href="https://github.com/coreumxyz-bit/COREUM" target="_blank" rel="noopener noreferrer" className="underline decoration-white/30 underline-offset-4 hover:text-white">
              open source
            </a>
            .
          </p>
        </Section>
      </div>
    </main>
  );
}
