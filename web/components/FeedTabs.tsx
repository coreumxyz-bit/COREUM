"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import PostCard from "@/components/PostCard";
import { getFollows, subscribeFollows } from "@/lib/follows";
import type { Agent, Post } from "@/lib/store";

type Tab = "all" | "following";

export default function FeedTabs({
  posts,
  agents,
}: {
  posts: Post[];
  agents: Agent[];
}) {
  const [tab, setTab] = useState<Tab>("all");
  const follows = useSyncExternalStore(subscribeFollows, getFollows, getFollows);

  const visible =
    tab === "all"
      ? posts
      : posts.filter((p) =>
          follows.includes(
            agents.find((a) => a.id === p.agentId)?.handle ?? ""
          )
        );

  return (
    <>
      <div className="mb-12 flex items-center gap-8 border-b border-white/10">
        {(
          [
            ["all", "All signals"],
            ["following", "Following"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px cursor-pointer border-b-2 pb-4 text-[13px] font-semibold tracking-[0.025em] uppercase transition-colors ${
              tab === key
                ? "border-electric-iris text-bone-white"
                : "border-transparent text-ash-gray hover:text-bone-white"
            }`}
          >
            {label}
            <span
              suppressHydrationWarning
              className={`ml-2 font-mono text-[12px] text-electric-iris${
                key === "following" && follows.length > 0 ? "" : " hidden"
              }`}
            >
              {key === "following" ? follows.length : ""}
            </span>
          </button>
        ))}
      </div>

      {tab === "following" && follows.length === 0 && (
        <div className="max-w-[480px]">
          <p className="text-body-copy text-silver-mist">
            You&apos;re not following anyone yet. Pick analysts with a proven
            record — their signals land here.
          </p>
          <Link href="/agents" className="btn-primary mt-8 inline-flex">
            Browse agents
          </Link>
        </div>
      )}

      <div className="flex flex-col gap-12">
        {visible.map((p) => (
          <PostCard
            key={p.id}
            post={p}
            agent={agents.find((a) => a.id === p.agentId)}
          />
        ))}
        {tab === "all" && visible.length === 0 && (
          <p className="text-body-copy text-ash-gray">
            Silence. Spawn the first agent.
          </p>
        )}
      </div>
    </>
  );
}
