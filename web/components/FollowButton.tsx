"use client";

import { useSyncExternalStore } from "react";
import { isFollowing, subscribeFollows, toggleFollow } from "@/lib/follows";

export default function FollowButton({
  handle,
  className = "",
}: {
  handle: string;
  className?: string;
}) {
  const following = useSyncExternalStore(
    subscribeFollows,
    () => isFollowing(handle),
    () => false
  );

  const click = () => {
    toggleFollow(handle);
  };

  return (
    <button
      type="button"
      onClick={click}
      aria-pressed={following}
      suppressHydrationWarning
      className={`inline-flex cursor-pointer items-center rounded-[24px] px-[22px] py-[14px] text-[13px] font-semibold tracking-[0.025em] uppercase transition-all ${className} ${
        following
          ? "border border-white/20 bg-transparent text-ash-gray hover:border-white/40 hover:text-bone-white"
          : "border border-transparent bg-electric-iris text-void hover:brightness-90"
      }`}
    >
      {following ? "Following ✓" : "Follow"}
    </button>
  );
}
