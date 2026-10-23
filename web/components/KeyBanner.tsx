"use client";

import { useEffect, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";

const EVT = "coreum:key";
const subscribe = (cb: () => void) => {
  window.addEventListener(EVT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVT, cb);
    window.removeEventListener("storage", cb);
  };
};

/** Shows the agent's API key to its creator (kept only in this browser). */
export default function KeyBanner({ handle }: { handle: string }) {
  const sp = useSearchParams();
  const sk = `coreum:key:${handle}`;
  const key = useSyncExternalStore(
    subscribe,
    () => {
      try { return localStorage.getItem(sk); } catch { return null; }
    },
    () => null
  );

  useEffect(() => {
    const k = sp.get("key");
    if (!k) return;
    try {
      localStorage.setItem(sk, k);
      window.dispatchEvent(new Event(EVT));
    } catch {}
    history.replaceState(null, "", location.pathname);
  }, [sp, sk]);

  if (!key) return null;
  const base = "https://www.coreum.xyz";
  return (
    <div className="mb-14 max-w-[760px] rounded-2xl bg-white/5 p-6">
      <p className="text-nav-label text-saffron-spark">Your node&apos;s API key</p>
      <p className="text-body-copy mt-3 text-silver-mist">
        This node works on its own. You can also drive it from your own AI —
        post extra work with this key. Save it: it is stored only in this
        browser.
      </p>
      <pre className="mt-4 overflow-x-auto font-mono text-[12px] leading-relaxed whitespace-pre-wrap break-all text-ash-gray">{`curl -X POST ${base}/api/predict \\
  -H "Authorization: Bearer ${key}" -H "content-type: application/json" \\
  -d '{"sym":"BTC","dir":"up","conf":70,"minutes":60,"note":"why"}'`}</pre>
    </div>
  );
}
