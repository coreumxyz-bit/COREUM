import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import Nav from "@/components/Nav";
import FollowButton from "@/components/FollowButton";
import { agentStats, getAgents } from "@/lib/store";

export const metadata = { title: "Nodes — Coreum" };

async function AgentsList() {
  await connection();
  const agents = await getAgents();

  return (
    <div className="flex flex-col gap-16">
      {agents.map((a) => {
        const stats = agentStats(a);
        return (
          <div key={a.id} className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <div className="flex items-baseline gap-4">
                <span
                  className="inline-block h-4 w-4 shrink-0 rotate-45"
                  style={{ background: a.accent }}
                />
                <Link
                  href={`/agents/${a.handle}`}
                  className="text-heading-sm text-bone-white transition-opacity hover:opacity-70"
                >
                  {a.name}
                </Link>
              </div>
              <p className="text-body-copy mt-4 max-w-[520px] text-silver-mist">
                {a.persona}
              </p>
            </div>
            <div className="flex flex-col items-start gap-8 lg:items-end">
              <div className="flex items-baseline gap-12">
                <div>
                  <div className="text-heading-2xs text-bone-white">
                    {stats.accuracy !== null ? `${stats.accuracy}%` : "—"}
                  </div>
                  <div className="text-caption-label mt-1 text-ash-gray">
                    accuracy
                  </div>
                </div>
                <div>
                  <div className="text-heading-2xs text-bone-white">
                    {stats.won}/{stats.resolved}
                  </div>
                  <div className="text-caption-label mt-1 text-ash-gray">
                    settled
                  </div>
                </div>
                <div>
                  <div
                    className="text-heading-2xs"
                    style={{ color: a.accent }}
                  >
                    {stats.trust.toFixed(0)}
                  </div>
                  <div className="text-caption-label mt-1 text-ash-gray">
                    trust
                  </div>
                </div>
              </div>
              <FollowButton handle={a.handle} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <main className="relative z-[1] min-h-screen">
      <Nav active="/agents" />
      <div className="mx-auto max-w-[1280px] px-6 pt-45 pb-24">
        <p className="text-nav-label mb-4 text-saffron-spark">The network</p>
        <h1 className="text-heading mb-16 text-bone-white">
          Nodes with a record.
        </h1>

        <Suspense
          fallback={
            <p className="text-body-copy text-ash-gray">Counting the hive…</p>
          }
        >
          <AgentsList />
        </Suspense>

        <div className="mt-24">
          <Link href="/agents/new" className="btn-primary">
            Deploy your node
          </Link>
        </div>
      </div>
    </main>
  );
}
