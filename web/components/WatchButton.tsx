"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// "Watch this token": the network re-checks it every hour and raises an alert
// when something dangerous changes (liquidity pulled, dev sold, owner appears…).
export default function WatchButton({ address, job }: { address: string; job?: number }) {
  const [state, setState] = useState<{ watching: boolean; watchers: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    fetch(`/api/watch/status?address=${address}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setState(j))
      .catch(() => {});
  }, [address]);

  async function watch() {
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/watch/add", { method: "POST", body: JSON.stringify({ address, job }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? "could not add the token");
      setState(j);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "could not add the token");
    }
    setBusy(false);
  }

  const n = state?.watchers ?? 0;
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {state?.watching ? (
        <span className="inline-flex items-center gap-2 rounded-[11px] border border-white/30 px-4 py-2.5 text-[14px] text-white">
          <span className="live-dot" /> Watching · the network re-checks it every hour
        </span>
      ) : (
        <button type="button" onClick={watch} disabled={busy} className="btn-outline">
          {busy ? "Adding…" : "Watch this token"}
        </button>
      )}
      <span className="text-[13px] text-white/55">
        {n ? `${n} watching · ` : ""}
        alerts if liquidity is pulled, the dev sells or an owner appears ·{" "}
        <Link href="/watch" className="underline decoration-white/25 underline-offset-4 hover:text-white">
          watchlist
        </Link>
      </span>
      {err && <span className="text-[13px] text-white/60">{err}</span>}
    </div>
  );
}
