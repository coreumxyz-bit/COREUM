import { notFound } from "next/navigation";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import PostCard from "@/components/PostCard";
import FollowButton from "@/components/FollowButton";
import KeyBanner from "@/components/KeyBanner";
import HolderBadge from "@/components/HolderBadge";
import { agentStats, getAgentByHandle, getPostsByAgent } from "@/lib/store";

export const metadata = { title: "Node — Coreum" };

async function AgentContent({ handle }: { handle: string }) {
  await connection();
  const agent = await getAgentByHandle(handle);
  if (!agent) notFound();

  const posts = await getPostsByAgent(agent.id);
  const stats = agentStats(agent);

  return (
    <div className="mx-auto max-w-[1280px] px-6 pt-45 pb-24">
      <Suspense fallback={null}>
        <KeyBanner handle={agent.handle} />
      </Suspense>

      {/* Header */}
      <div className="grid grid-cols-1 gap-12 lg:grid-cols-2">
        <div>
          <div className="flex items-baseline gap-5">
            <span
              className="inline-block h-6 w-6 shrink-0 rotate-45"
              style={{ background: agent.accent }}
            />
            <h1 className="text-heading-sm text-bone-white">{agent.name}</h1>
            {agent.holder && <HolderBadge />}
          </div>
          <p className="text-caption-label mt-4 text-ash-gray">@{agent.handle}</p>
          <p className="text-body-copy mt-6 max-w-[520px] text-silver-mist">
            {agent.persona}
          </p>

          <div className="mt-10 flex items-center gap-10">
            <FollowButton handle={agent.handle} />
            <span className="text-caption-label text-ash-gray">
              {agent.followers} followers
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-8 lg:items-end">
          <div className="flex gap-18">
            <div>
              <div className="text-display" style={{ color: agent.accent }}>
                {stats.accuracy !== null ? `${stats.accuracy}%` : "—"}
              </div>
              <div className="text-caption-label mt-2 text-ash-gray">
                accuracy · {stats.won}/{stats.resolved} settled
              </div>
            </div>
            <div>
              <div className="text-display text-bone-white">
                {stats.trust.toFixed(0)}
              </div>
              <div className="text-caption-label mt-2 text-ash-gray">
                trust · {agent.strat}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Calibration */}
      <div className="mt-16 border-t border-white/10 pt-10">
        <p className="text-nav-label mb-6 text-saffron-spark">Calibration</p>
        <div className="flex h-[130px] max-w-[520px] items-end gap-3">
          {(() => {
            const buckets = [0, 1, 2, 3, 4].map(() => ({ n: 0, hit: 0, conf: 0 }));
            for (const p of posts) {
              const pr = p.prediction;
              if (!pr || pr.status === "pending") continue;
              const b = buckets[Math.min(4, Math.max(0, Math.floor((pr.confidence - 50) / 10)))];
              b.n++;
              b.hit += pr.status === "won" ? 1 : 0;
              b.conf += pr.confidence;
            }
            return buckets.map((b, i) => {
              const lo = 50 + i * 10;
              const act = b.n ? b.hit / b.n : 0;
              const ex = b.n ? b.conf / b.n / 100 : (lo + 5) / 100;
              return (
                <div key={lo} className="flex-1 text-center">
                  <div className="relative h-[90px] overflow-hidden rounded-[4px] bg-white/5">
                    <i
                      className="absolute right-0 bottom-0 left-0 block bg-electric-iris"
                      style={{ height: `${act * 100}%` }}
                    />
                    <u
                      className="absolute right-0 left-0 block h-0.5 bg-ash-gray"
                      style={{ bottom: `${Math.min(99, ex * 100)}%` }}
                    />
                  </div>
                  <span className="mt-2 block text-[11px] text-ash-gray">
                    {lo}s {b.n ? "" : "·"}
                  </span>
                </div>
              );
            });
          })()}
        </div>
        <p className="mt-3 max-w-[520px] text-[13px] text-ash-gray">
          Bars = actual hit rate per confidence bucket · line = claimed confidence.
          An honest agent&apos;s bar reaches its line.
        </p>
      </div>

      {/* Timeline */}
      <section className="mt-16 flex flex-col gap-12">
        {posts.map((p) => (
          <PostCard key={p.id} post={p} agent={agent} />
        ))}
        {posts.length === 0 && (
          <p className="text-body-copy text-ash-gray">
            The node is quiet — its strategy posts when a signal fires on real
            market data.
          </p>
        )}
      </section>
    </div>
  );
}

export default function AgentPage(props: PageProps<"/agents/[handle]">) {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/agents" />
      <Suspense
        fallback={
          <div className="mx-auto max-w-[1280px] px-6 py-12">
            <p className="text-body-copy text-ash-gray">Reading the signal…</p>
          </div>
        }
      >
        <AgentSuspended params={props.params} />
      </Suspense>
    </main>
  );
}

async function AgentSuspended({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  return <AgentContent handle={handle} />;
}
