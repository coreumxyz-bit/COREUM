"use client";

import { useEffect, useState } from "react";
import { burnAndRecord } from "@/lib/burnFlow";
import { HOLDER_CHECK_MSG, connectWallet, signMessage } from "@/lib/holder";

type Status = { holders: number; burns: Record<string, number>; live_keys: number };
const card = "glass-fx rounded-[22px] border border-white/[0.12] bg-white/[0.05] p-6 backdrop-blur-[20px]";
const btn = "rounded-[10px] border border-white/40 px-4 py-2 text-[14px] text-white hover:border-white disabled:opacity-50";

// The holder tier: sign one message (no gas), the site reads the balance on chain.
function Holder() {
  const [s, setS] = useState<{ busy?: boolean; addr?: string; error?: string; amount?: string }>({});
  useEffect(() => {
    fetch("/api/cors/holder").then((r) => r.json()).then((j) => j.holder && setS({ addr: j.addr })).catch(() => {});
  }, []);
  async function run() {
    setS({ busy: true });
    const addr = await connectWallet();
    if (!addr) return setS({ error: "no wallet connected" });
    const sig = await signMessage(HOLDER_CHECK_MSG(addr), addr);
    if (!sig) return setS({ error: "the signature was rejected" });
    const r = await fetch("/api/cors/holder", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ addr, sig }) });
    const j = await r.json();
    if (j.ok) setS({ addr: addr.toLowerCase(), amount: j.amount });
    else setS({ error: j.error ?? `this wallet holds ${Number(j.amount || 0).toLocaleString("en-US")} $CORS, the tier starts at 1,000,000` });
  }
  return (
    <div className={card}>
      <p className="text-[13px] text-white/55">Hold · 1,000,000 $CORS</p>
      <h3 className="mt-2 text-[24px] text-white">200 checks a day</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-white/65">
        Everyone gets 50 token checks a day. Holders get 200. Sign one message, no gas: the site reads your balance on Robinhood
        Chain and remembers the wallet for a week.
      </p>
      <div className="mt-5">
        {s.addr ? (
          <p className="text-[14px] text-white">
            ✓ Holder tier on <span className="font-mono text-white/70">{s.addr.slice(0, 6)}…{s.addr.slice(-4)}</span>
            {s.amount && <span className="text-white/55"> · {Number(s.amount).toLocaleString("en-US")} $CORS</span>}
          </p>
        ) : (
          <button type="button" onClick={() => void run()} disabled={s.busy} className={btn}>
            {s.busy ? "Checking…" : "Verify my wallet"}
          </button>
        )}
        {s.error && <p className="mt-3 text-[13px] text-white/55">{s.error}</p>}
      </div>
    </div>
  );
}

// 1,000,000 $CORS burned → a key with 500 checks a day for 30 days, shown once.
function ApiKey() {
  const [s, setS] = useState<{ busy?: boolean; step?: string; key?: string; error?: string }>({});
  async function run() {
    setS({ busy: true });
    try {
      const tx = await burnAndRecord(1_000_000, "apikey", (step) => setS({ busy: true, step }));
      setS({ busy: true, step: "Burned. Making your key…" });
      const r = await fetch("/api/cors/apikey", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ tx }) });
      const j = await r.json();
      if (!r.ok || !j.key) throw new Error(j.error ?? "the key could not be made, write to us with the tx: " + tx);
      setS({ key: j.key });
    } catch (e) {
      setS({ error: e instanceof Error ? e.message : String(e) });
    }
  }
  return (
    <div className={card}>
      <p className="text-[13px] text-white/55">Burn · 1,000,000 $CORS</p>
      <h3 className="mt-2 text-[24px] text-white">An API key</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-white/65">
        500 checks a day for 30 days on <span className="font-mono">/api/v1/check</span>, for bots, launchpads and wallets. The key is
        shown once and stored only as a hash.
      </p>
      <div className="mt-5">
        {s.key ? (
          <div>
            <p className="text-[13px] text-white/60">Your key. Copy it now, it will not be shown again:</p>
            <p className="mt-2 rounded-[10px] border border-white/20 bg-black/40 px-3 py-2 font-mono text-[13px] break-all text-white">{s.key}</p>
            <p className="mt-2 text-[12px] text-white/45">Send it as Authorization: Bearer {"<key>"}</p>
          </div>
        ) : (
          <button type="button" onClick={() => void run()} disabled={s.busy} className={btn}>
            {s.busy ? "Working…" : "Burn and get a key"}
          </button>
        )}
        {s.step && <p className="mt-3 text-[13px] text-white/70">{s.step}</p>}
        {s.error && <p className="mt-3 text-[13px] text-white/55">{s.error}</p>}
      </div>
    </div>
  );
}

// 100,000 $CORS burned → the burn tx goes into coreumd deploy --tx, the core is verified.
function Core() {
  const [s, setS] = useState<{ busy?: boolean; step?: string; tx?: string; error?: string }>({});
  async function run() {
    setS({ busy: true });
    try {
      const tx = await burnAndRecord(100_000, "core", (step) => setS({ busy: true, step }));
      setS({ tx });
    } catch (e) {
      setS({ error: e instanceof Error ? e.message : String(e) });
    }
  }
  return (
    <div className={card}>
      <p className="text-[13px] text-white/55">Burn · 100,000 $CORS</p>
      <h3 className="mt-2 text-[24px] text-white">A verified core</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-white/65">
        Anyone can run a core. Burning marks yours as verified: the burn is tied to your wallet on chain, so the network can tell an
        operator with skin in the game from a throwaway.
      </p>
      <div className="mt-5">
        {s.tx ? (
          <div>
            <p className="text-[13px] text-white/60">Burn recorded. Deploy your core with it:</p>
            <p className="mt-2 rounded-[10px] border border-white/20 bg-black/40 px-3 py-2 font-mono text-[12px] break-all text-white">
              node coreumd.mjs deploy --name my-core --tx {s.tx}
            </p>
          </div>
        ) : (
          <button type="button" onClick={() => void run()} disabled={s.busy} className={btn}>
            {s.busy ? "Working…" : "Burn for a verified core"}
          </button>
        )}
        {s.step && <p className="mt-3 text-[13px] text-white/70">{s.step}</p>}
        {s.error && <p className="mt-3 text-[13px] text-white/55">{s.error}</p>}
      </div>
    </div>
  );
}

export default function CorsUtility() {
  const [st, setSt] = useState<Status | null>(null);
  useEffect(() => {
    fetch("/api/cors-utility").then((r) => (r.ok ? r.json() : null)).then((j) => j && !j.error && setSt(j)).catch(() => {});
  }, []);
  return (
    <>
      <div className="mt-12 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Holder />
        <ApiKey />
        <Core />
      </div>
      <div className={`${card} mt-4`}>
        <p className="text-[13px] text-white/55">Burn · 100,000 $CORS</p>
        <h3 className="mt-2 text-[24px] text-white">One more check past the limit</h3>
        <p className="mt-3 max-w-[760px] text-[14px] leading-relaxed text-white/65">
          Out of checks for today? The Token Check box offers a burn right where the limit message shows. One burn, one check.
        </p>
      </div>
      {st && (
        <p className="mt-6 text-[13px] text-white/50">
          Live: {st.holders} holder wallets · {st.live_keys} API keys · burns used for checks {st.burns.check ?? 0}, keys{" "}
          {st.burns.apikey ?? 0}, cores {st.burns.core ?? 0}
        </p>
      )}
    </>
  );
}
