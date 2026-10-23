import Link from "next/link";
import Nav from "@/components/Nav";
import SafeSwap from "@/components/SafeSwap";

export const metadata = {
  title: "Safe Swap — Coreum",
  description: "Check a token's grade before you buy it. Six AI cores, on-chain facts, and a buy button that waits when the red flags are there.",
};

export default function SwapPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/swap" />
      <div className="mx-auto max-w-[1180px] px-5 pt-32 pb-24 sm:px-8 md:px-[82px]">
        <p className="text-[13px] text-white/60">Safe Swap · Robinhood Chain</p>
        <h1 className="mt-3 text-[clamp(40px,6vw,76px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          Check first. <span className="text-white/45">Then buy.</span>
        </h1>
        <p className="mt-6 max-w-[680px] text-[17px] leading-relaxed text-white/75">
          Paste the token you are about to buy. If the network has not checked it in the last six hours, the cores check it right
          now. Clean grades go straight to the trade; red flags make you read them first.
        </p>

        <SafeSwap />

        <section className="mt-20 grid max-w-[980px] grid-cols-1 gap-4 md:grid-cols-3">
          {[
            ["A or B", "No red flags or only small ones. The buy button is open."],
            ["C", "Mixed signals. The button is open, the reasons are right above it."],
            ["D, F or dumped", "The button stays locked until you tick that you have read the red flags."],
          ].map(([k, v]) => (
            <div key={k} className="glass-fx rounded-[18px] border border-white/[0.12] bg-white/[0.04] p-5 backdrop-blur-[20px]">
              <div className="text-[20px] text-white">{k}</div>
              <p className="mt-2 text-[14px] leading-relaxed text-white/65">{v}</p>
            </div>
          ))}
        </section>
        <p className="mt-10 max-w-[760px] text-[13px] leading-relaxed text-white/45">
          Coreum never touches your funds: the trade happens on Pons or a DEX. The same grades are on chain in{" "}
          <Link href="/developers" className="underline decoration-white/30 underline-offset-4 hover:text-white">
            CoreumTokenRegistry
          </Link>
          , so any swap or launchpad can check them in one call. A risk screen, not financial advice.
        </p>
      </div>
    </main>
  );
}
