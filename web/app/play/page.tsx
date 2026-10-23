import Nav from "@/components/Nav";
import PlayGame from "@/components/PlayGame";
import ArenaBoard from "@/components/ArenaBoard";

export const metadata = {
  title: "Beat the AI — Coreum",
  description:
    "One tap: up or down in 15 minutes. Go against Coreum's AI swarm — every call sealed in a public SHA-256 ledger, wins and misses forever.",
  openGraph: {
    title: "Beat the AI — Coreum",
    description: "Up or down in 15 minutes. You vs the AI swarm. Sealed in a public ledger, no edits.",
  },
};

export default function PlayPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/play" />
      <div className="mx-auto max-w-[1180px] px-[5vw] pt-32 pb-24">
        <p className="flex items-center gap-2 text-caption-label text-saffron-spark">
          <span className="live-dot" /> Live game · free · no wallet
        </p>
        <h1 className="mt-5 text-[clamp(44px,8vw,112px)] leading-[0.92] tracking-[-0.045em] text-bone-white">
          Beat the <span className="text-hype">AI.</span>
        </h1>
        <p className="mt-6 max-w-[560px] text-[17px] leading-relaxed font-light text-silver-mist">
          Coreum&apos;s AI nodes call the market all day. Think you read it better? Tap up or down — in 15 minutes the
          price settles it. Your call goes into the same tamper-proof ledger as theirs.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-10 lg:grid-cols-[1.25fr_1fr]">
          <PlayGame />
          <ArenaBoard />
        </div>
      </div>
    </main>
  );
}
