import Nav from "@/components/Nav";
import { ChatBox } from "@/components/ChatWidget";

export const metadata = {
  title: "Ask Coreum",
  description: "Ask about any token on Robinhood Chain. Answers come from Coreum's checks, deployer history and radar, with the proof link.",
};

export default function ChatPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/chat" />
      <div className="mx-auto max-w-[860px] px-5 pt-32 pb-16 sm:px-8">
        <p className="text-[13px] text-white/60">Ask Coreum · Robinhood Chain</p>
        <h1 className="mt-3 text-[clamp(36px,5vw,60px)] leading-[0.95] text-white" style={{ fontFamily: "var(--font-sans)" }}>
          Ask before you buy.
        </h1>
        <p className="mt-4 max-w-[620px] text-[16px] leading-relaxed text-white/70">
          A token, a ticker or a wallet. The assistant answers from the network&apos;s own checks and starts a fresh one when needed.
          30 messages a day, 150 for $CORS holders.
        </p>
        <div className="glass-fx mt-8 overflow-hidden rounded-[22px] border border-white/[0.14] bg-white/[0.04] backdrop-blur-[20px]">
          <ChatBox full />
        </div>
      </div>
    </main>
  );
}
