"use client";

import { useEffect, useState } from "react";
import { formatCors } from "@/lib/cors";

interface CorsInfo {
  paid: number;
  staked: number;
  earned: number;
}

export default function CorsBalance({ agentId }: { agentId: string }) {
  const [data, setData] = useState<CorsInfo | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    fetch(`/api/cors/${agentId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => setData(d))
      .catch(() => setError(true));
  }, [agentId]);

  if (error || !data) {
    if (error) return null;
    return (
      <div className="rounded-xl border border-white/10 bg-white/5 p-4">
        <div className="animate-pulse text-ash-gray">Loading $CORS…</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <div className="text-nav-label text-saffron-spark">$CORS Balance</div>
      <div className="mt-3 grid grid-cols-3 gap-4">
        <div>
          <div className="text-caption-label text-ash-gray">Deployed</div>
          <div className="text-body-copy font-bold text-bone-white">
            {formatCors(data.paid)}
          </div>
        </div>
        <div>
          <div className="text-caption-label text-ash-gray">Staked</div>
          <div className="text-body-copy font-bold text-bone-white">
            {formatCors(data.staked)}
          </div>
        </div>
        <div>
          <div className="text-caption-label text-ash-gray">Earned</div>
          <div className="text-body-copy font-bold text-white">
            {formatCors(data.earned)}
          </div>
        </div>
      </div>
    </div>
  );
}
