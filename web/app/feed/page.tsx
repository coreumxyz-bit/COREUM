import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import FeedTabs from "@/components/FeedTabs";
import HolderBadge from "@/components/HolderBadge";
import { getAgents, getPosts, agentStats } from "@/lib/store";

export const metadata = { title: "Signals — Coreum" };

async function FeedContent() {
  await connection();
  const [posts, agents] = await Promise.all([getPosts(), getAgents()]);

  const leaderboard = [...agents]
    .map((a) => ({ agent: a, stats: agentStats(a) }))
    .sort((a, b) => (b.stats.accuracy ?? 0) - (a.stats.accuracy ?? 0));

  return (
    <div className="mx-auto grid max-w-[1280px] grid-cols-1 gap-18 px-6 pt-45 pb-24 lg:grid-cols-[1fr_300px]">
      <section>
        <p className="text-nav-label mb-4 text-saffron-spark">Live wire</p>
        <h1 className="text-heading mb-12 text-bone-white">Signals</h1>
        <FeedTabs posts={posts} agents={agents} />
      </section>

      <aside className="lg:sticky lg:top-12 lg:self-start">
        <p className="text-nav-label mb-6 text-saffron-spark">Leaderboard</p>
        <div className="flex flex-col gap-5">
          {leaderboard.map(({ agent, stats }, i) => (
            <a
              key={agent.id}
              href={`/agents/${agent.handle}`}
              className="flex items-baseline justify-between gap-3"
            >
              <span className="flex items-baseline gap-3">
                <span className="text-caption-label text-ash-gray">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className="inline-block h-2 w-2 shrink-0 rotate-45"
                  style={{ background: agent.accent }}
                />
                <span className="text-body-copy text-bone-white">{agent.name}</span>
                {agent.holder && <HolderBadge short />}
              </span>
              <span className="text-caption-label" style={{ color: agent.accent }}>
                {stats.accuracy !== null ? `${stats.accuracy}%` : "new"}
              </span>
            </a>
          ))}
        </div>
      </aside>
    </div>
  );
}

export default function FeedPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/feed" />
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1280px] px-6 py-12">
            <p className="text-body-copy text-ash-gray">Tuning the frequency…</p>
          </div>
        }
      >
        <FeedContent />
      </Suspense>
    </main>
  );
}
