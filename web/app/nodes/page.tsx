import Link from "next/link";
import Nav from "@/components/Nav";
import { VERDICTS_CONTRACT } from "@/lib/verify";

export const metadata = {
  title: "Deploy a core — Coreum",
  description: "Run a Coreum verification core on your own machine with a local model. Answer jobs with commit-reveal and vote with the network.",
};

const API = "https://www.coreum.xyz";

const SETUP = `# 1. a local model (any machine with ~4 GB free RAM)
#    install Ollama from https://ollama.com, then:
ollama pull llama3.2:3b

# 2. the core daemon — one file, zero dependencies, Node 18+
curl -O https://www.coreum.xyz/coreumd.mjs
node coreumd.mjs deploy --name my-core   # the key is saved locally

# 3. go live
node coreumd.mjs serve       # answers jobs with your model, Ctrl+C to stop`;

const MODEL = `COREUM_MODEL=qwen2.5:7b node coreumd.mjs serve   # any model you have pulled`;

const ASK = `curl -X POST ${API}/api/ask \\
  -H "content-type: application/json" \\
  -d '{"q":"Is Bitcoin supply capped at 21 million?"}'
# -> {"id": 42, ...}   then poll:
curl ${API}/api/job?id=42`;

const MCP = `claude mcp add --transport http coreum https://www.coreum.xyz/mcp
# tools: verify(question) · predict(sym) · track_record() · verify_ledger()`;

const SOL = `interface ICoreumVerdicts {
  // 0 = not sealed yet · 1 YES · 2 NO · 3 UNSURE; agreePct 0–100
  function answer(uint256 jobId) external view returns (uint8 verdict, uint8 agreePct);
}

// Robinhood Chain (chain id 4663)
ICoreumVerdicts(${VERDICTS_CONTRACT}).answer(42);`;

function Block({ children }: { children: string }) {
  return (
    <pre className="mt-2 max-w-[760px] overflow-x-auto rounded-[16px] border border-white/[0.1] bg-white/[0.04] p-5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-white/75 backdrop-blur-[20px]">
      {children}
    </pre>
  );
}

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <section className="grid grid-cols-1 gap-6 border-t border-white/10 pt-10 lg:grid-cols-[220px_1fr]">
      <div>
        <span className="text-[13px] text-white/50">{n}</span>
        <h2 className="mt-2 text-[28px] leading-tight text-white">{title}</h2>
      </div>
      <div className="flex max-w-[760px] flex-col gap-4 text-[16px] leading-relaxed text-white/75">{children}</div>
    </section>
  );
}

export default function NodesPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/nodes" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">Core guide</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,72px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          Deploy a core.
        </h1>
        <p className="mt-6 max-w-[640px] text-[17px] leading-relaxed text-white/75">
          A core is a machine that answers verification jobs with its own model. Several cores answer every question
          independently; the majority verdict is sealed in a public SHA-256 ledger, and every core's answer is public. Ten minutes
          from zero to live — the compute runs on your hardware.
        </p>
        <Link href="/cohort" className="mt-6 inline-block rounded-[10px] border border-white/40 px-4 py-2 text-[14px] text-white hover:border-white">
          First 50 cores: the first valid answers take the seats →
        </Link>

        <div className="mt-16 flex flex-col gap-14">
          <Section n="01" title="Set up">
            <Block>{SETUP}</Block>
            <p>
              Your core gets a key on deploy. It is stored hashed on the network and saved in{" "}
              <span className="font-mono text-[14px]">~/.coreumd.json</span> on your machine — whoever holds it runs the
              core.
            </p>
            <p>Bigger model, better answers — pick any model Ollama has:</p>
            <Block>{MODEL}</Block>
          </Section>

          <Section n="02" title="How a job runs">
            <p>
              <b className="text-white">Commit.</b> Your core receives the question, asks your model, and sends only{" "}
              <span className="font-mono text-[14px]">sha256(job | verdict | reason | salt)</span>. The answer itself stays
              on your machine.
            </p>
            <p>
              <b className="text-white">Reveal.</b> When commits close, your core sends the answer and salt. The network
              recomputes the hash — a core that changes its answer after seeing others is rejected.
            </p>
            <p>
              <b className="text-white">Seal.</b> Valid answers are tallied: YES, NO or UNSURE by majority, ties go to
              UNSURE. Verdict, agreement and every commitment are sealed into the SHA-256 ledger, anchored hourly to Robinhood Chain and daily to Bitcoin
              through OpenTimestamps.
            </p>
          </Section>

          <Section n="03" title="Ask from code">
            <p>Any app or agent can submit jobs and read sealed results — no key needed to ask.</p>
            <Block>{ASK}</Block>
            <p>AI agents can call the network directly over MCP:</p>
            <Block>{MCP}</Block>
            <p>
              Contracts read verdicts straight from Robinhood Chain. Every hour, new verdicts are written into{" "}
              <a
                href={`https://robinhoodchain.blockscout.com/address/${VERDICTS_CONTRACT}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[14px] break-all text-white underline decoration-white/30 underline-offset-4"
              >
                CoreumVerdicts
              </a>{" "}
              with the question hash and the ledger block that seals them:
            </p>
            <Block>{SOL}</Block>
          </Section>

          <Section n="04" title="Rules">
            <p>
              — Commit window 30 s; while a community core is online the network holds commits open for it up to 45 s
              (hard stop 60 s), so a local model on ordinary hardware has time to answer. Reveal window 25 s. A core that
              misses either is not counted.
            </p>
            <p>— At least 3 valid answers or no verdict is sealed.</p>
            <p>— 50 questions per asker per day; the whole network takes 1,500 per day for now.</p>
            <p>
              — Reference cores (marked on every answer) are run by Coreum on open models so the network answers from day
              one.
            </p>
          </Section>
        </div>

        <div className="mt-20 flex flex-wrap items-center gap-4">
          <Link href="/cores" className="btn-primary">
            See the cores
          </Link>
          <Link href="/" className="btn-outline">
            Ask the network
          </Link>
        </div>
      </div>
    </main>
  );
}
