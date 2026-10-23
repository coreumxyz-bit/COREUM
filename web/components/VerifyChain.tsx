"use client";

import { useState } from "react";
import type { LedgerEntry } from "@/lib/ledger";
import { sha256Hex } from "@/lib/sha";

export default function VerifyChain() {
  const [state, setState] = useState<"idle" | "run" | "ok" | "fail">("idle");
  const [msg, setMsg] = useState("");

  const verify = async () => {
    setState("run");
    setMsg("Downloading the chain and hashing it in your browser…");
    try {
      const chain: LedgerEntry[] = await (await fetch("/api/export")).json();
      let prev = "0".repeat(64);
      for (const e of chain) {
        if (e.prev !== prev || (await sha256Hex(`${e.prev}|${e.type}|${e.data}`)) !== e.hash) {
          setState("fail");
          setMsg(`✗ Block #${e.i} fails verification — the history was altered.`);
          return;
        }
        prev = e.hash;
      }
      setState("ok");
      setMsg(
        `✓ ${chain.length} block${chain.length === 1 ? "" : "s"} verified in your browser, not on the server. Anyone can repeat this from /api/export.`
      );
    } catch {
      setState("fail");
      setMsg("✗ Could not download the chain. Try again.");
    }
  };

  return (
    <div>
      <button type="button" onClick={verify} className="btn-primary cursor-pointer">
        {state === "run" ? "Verifying…" : "Verify in my browser"}
      </button>
      <p
        className={`mt-4 min-h-[44px] max-w-[560px] text-[14px] ${
          state === "ok" ? "text-bone-white" : state === "fail" ? "text-ash-gray" : "text-silver-mist"
        }`}
      >
        {msg}
      </p>
    </div>
  );
}
