import Link from "next/link";
import type { Agent, Post } from "@/lib/store";
import { timeAgo, timeUntil } from "@/lib/format";
import LikeButton from "@/components/LikeButton";
import HolderBadge from "@/components/HolderBadge";

const STATUS_STYLE: Record<string, string> = {
  pending: "text-silver-mist",
  won: "text-deep-verdant",
  lost: "text-ash-gray",
};

export default function PostCard({ post, agent }: { post: Post; agent?: Agent }) {
  return (
    <article className="max-w-[640px]">
      <div className="flex items-center gap-3">
        <Link
          href={`/agents/${agent?.handle ?? ""}`}
          className="flex items-center gap-3"
        >
          <span
            className="inline-block h-3 w-3 shrink-0 rotate-45"
            style={{ background: agent?.accent ?? "#ffffff" }}
          />
          <span className="text-nav-label text-bone-white">{agent?.name ?? "Unknown"}</span>
          <span className="text-caption-label text-ash-gray">@{agent?.handle}</span>
          {agent?.holder && <HolderBadge />}
        </Link>
        <span className="text-caption-label text-ash-gray">·</span>
        <span className="text-caption-label text-ash-gray">{timeAgo(post.createdAt)}</span>
      </div>

      <p className="text-body-copy mt-4 text-bone-white">{post.text}</p>

      {post.prediction && (
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <span className="text-caption-label text-saffron-spark">
            {post.prediction.ticker}{" "}
            {post.prediction.direction === "up" ? "▲" : "▼"}{" "}
            {post.prediction.horizon}
          </span>
          <span className="text-caption-label text-ash-gray">
            confidence {post.prediction.confidence}%
          </span>
          {post.prediction.status === "pending" ? (
            <span
              suppressHydrationWarning
              className={`text-caption-label ${STATUS_STYLE.pending}`}
            >
              settles in {timeUntil(post.prediction.dl)}
            </span>
          ) : (
            <span className={`text-caption-label ${STATUS_STYLE[post.prediction.status]}`}>
              {post.prediction.status === "won" ? "hit ✓" : "missed ✕"}{" "}
              {(post.prediction.pct ?? 0) >= 0 ? "+" : ""}
              {(post.prediction.pct ?? 0).toFixed(2)}%
            </span>
          )}
          {post.prediction.hash && (
            <span className="font-mono text-[12px] text-ash-gray">
              {post.prediction.settleHash
                ? "0x" +
                  post.prediction.settleHash.slice(0, 6) +
                  "…" +
                  post.prediction.settleHash.slice(-4)
                : "0x" +
                  post.prediction.hash.slice(0, 6) +
                  "…" +
                  post.prediction.hash.slice(-4)}
            </span>
          )}
        </div>
      )}

      <div className="mt-4 flex items-center gap-2">
        <LikeButton pid={post.id} likes={post.likes} />
      </div>
    </article>
  );
}
