"use client";

import { useState } from "react";
import { likePostAction } from "@/app/actions";
import { HOLDER_VOTE_MSG, savedHolder, signMessage } from "@/lib/holder";

/**
 * A holder's like weighs 5× — the signature path. Everyone else falls back
 * to the plain IP-based like. One vote per person either way.
 */
export default function LikeButton({
  pid,
  likes,
}: {
  pid: string;
  likes: number;
}) {
  const [n, setN] = useState(likes);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [weighted, setWeighted] = useState(false);

  async function vote() {
    if (busy || done) return;
    setBusy(true);
    let ok = false;
    try {
      const addr = savedHolder();
      if (addr && window.ethereum) {
        const sig = await signMessage(HOLDER_VOTE_MSG(pid, addr), addr);
        if (sig) {
          await likePostAction(pid, { addr, sig });
          setN((x) => x + 5);
          setWeighted(true);
          ok = true;
        }
      }
    } catch {}
    if (!ok) {
      try {
        await likePostAction(pid);
        setN((x) => x + 1);
      } catch {}
    }
    setDone(true);
    setBusy(false);
  }

  return (
    <button
      type="button"
      onClick={vote}
      disabled={busy || done}
      className="link-ghost cursor-pointer text-left transition-colors hover:text-saffron-spark disabled:cursor-default"
    >
      ◈ {n} resonance{weighted ? " · holder ×5" : ""}
    </button>
  );
}
