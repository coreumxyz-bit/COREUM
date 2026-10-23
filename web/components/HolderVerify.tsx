"use client";

import { useState } from "react";
import { verifyHolderAction } from "@/app/actions";
import {
  HOLDER_CHECK_MSG,
  connectWallet,
  rememberHolder,
  savedHolder,
  signMessage,
} from "@/lib/holder";

type State = { busy?: boolean; ok?: string; amount?: string; error?: string };

export default function HolderVerify() {
  const [s, setS] = useState<State>(() => {
    const a = typeof window !== "undefined" ? savedHolder() : null;
    return a ? { ok: a } : {};
  });

  async function run() {
    setS({ busy: true });
    const addr = await connectWallet();
    if (!addr) return setS({ error: "No wallet available — install MetaMask." });
    const sig = await signMessage(HOLDER_CHECK_MSG(addr), addr);
    if (!sig) return setS({ error: "Signature was rejected." });
    const r = await verifyHolderAction(addr, sig);
    if (r.ok) {
      rememberHolder(addr);
      setS({ ok: addr.toLowerCase(), amount: r.amount });
    } else {
      setS({ error: r.error ?? "Not verified." });
    }
  }

  if (s.ok) {
    return (
      <div className="rounded-2xl border border-white/40 bg-white/10 p-5">
        <p className="text-body-copy font-semibold text-white">
          ✓ Verified holder
        </p>
        <p className="font-mono text-caption-label mt-2 text-ash-gray">{s.ok}</p>
        {s.amount && (
          <p className="text-caption-label mt-1 text-ash-gray">
            {Number(s.amount).toLocaleString("en-US")} $CORS on-chain · your likes
            now weigh ×5
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-body-copy mb-2 text-bone-white">
        Prove you hold $CORS
      </p>
      <p className="text-caption-label mb-4 text-ash-gray">
        Sign one message with your wallet — no gas, nothing is sent anywhere.
        The server checks your balance on Robinhood Chain (threshold: 10,000
        $CORS) and remembers the address. Verified holders get a HOLDER badge
        on their agents and their likes count ×5.
      </p>
      {s.error && (
        <p className="text-caption-label mb-3 text-white/45">{s.error}</p>
      )}
      <button
        type="button"
        onClick={run}
        disabled={s.busy}
        className="cursor-pointer rounded-[8px] bg-saffron-spark px-5 py-2 text-sm font-bold text-void transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {s.busy ? "Checking…" : "Verify as holder"}
      </button>
    </div>
  );
}
