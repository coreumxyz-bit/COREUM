"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Safe Swap: the network's grade stands between you and the buy button.
// Funds never touch Coreum — the trade itself happens on Pons or a DEX.
type Grade = { letter: "A" | "B" | "C" | "D" | "F"; score: number; reasons: { why: string; points: number }[] };
type Check = {
  address: string;
  status: "checked" | "checking" | "not_checked";
  name?: string;
  symbol?: string;
  image?: string | null;
  verdict?: string | null;
  agreement?: number | null;
  grade?: Grade | null;
  age_hours?: number | null;
  fell_since_check_pct?: number | null;
  proof?: { page: string; job: number };
};

const FRESH_H = 6;
const ADDR = /0x[0-9a-fA-F]{40}/;
const NOTE: Record<Grade["letter"], string> = {
  A: "No red flags in the facts and the cores agree.",
  B: "Mostly clean, a few things to watch.",
  C: "Mixed. Read the facts before you buy.",
  D: "Several warning signs.",
  F: "Red flags. The cores advise against buying.",
};

export default function SafeSwap({ initial = "" }: { initial?: string }) {
  const [input, setInput] = useState(initial);
  const [check, setCheck] = useState<Check | null>(null);
  const [state, setState] = useState<"idle" | "loading" | "checking" | "ready" | "error">("idle");
  const [error, setError] = useState("");
  const [pons, setPons] = useState(false);
  const [fellPct, setFellPct] = useState<number | null>(null);
  const [accept, setAccept] = useState(false);

  async function run(raw: string) {
    const address = raw.match(ADDR)?.[0]?.toLowerCase();
    if (!address) {
      setError("Paste a token address (0x…) or a link that contains one.");
      setState("error");
      return;
    }
    setError("");
    setAccept(false);
    setState("loading");
    setCheck(null);
    setFellPct(null);
    fetch(`/api/pons-token?address=${address}`)
      .then((r) => r.json())
      .then((j) => setPons(!!j?.curve))
      .catch(() => setPons(false));
    try {
      let c = (await (await fetch(`/api/v1/token/${address}`)).json()) as Check;
      if (c.status === "not_checked" || (c.status === "checked" && (c.age_hours ?? 99) > FRESH_H)) {
        setState("checking");
        const r = await fetch("/api/v1/check", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ address }) });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "could not start a check");
        // the cores usually seal in 15-40 s
        for (let i = 0; i < 40; i++) {
          await new Promise((ok) => setTimeout(ok, 3000));
          c = (await (await fetch(`/api/v1/token/${address}?t=${Date.now()}`)).json()) as Check;
          if (c.status === "checked" && (c.age_hours ?? 99) < 0.2) break;
        }
      }
      setCheck(c);
      setState(c.status === "checked" ? "ready" : "checking");
      // a grade is a snapshot: the API says how far the value fell since the check
      setFellPct(c.fell_since_check_pct ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setState("error");
    }
  }

  useEffect(() => {
    if (initial) run(initial);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const g = check?.grade ?? null;
  const dumped = (fellPct ?? 0) >= 50;
  const risky = !!g && (g.letter === "D" || g.letter === "F" || dumped);
  const buyUrl = check ? (pons ? `https://ponsfamily.com/launchpad/${check.address}` : `https://www.geckoterminal.com/robinhood/tokens/${check.address}`) : "#";
  const canBuy = state === "ready" && !!g && (!risky || accept);

  return (
    <div className="mt-10 max-w-[760px]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          run(input);
        }}
        className="glass-fx flex items-center gap-2 rounded-[16px] border border-white/[0.14] bg-white/[0.05] p-2 backdrop-blur-[20px]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Token you want to buy — 0x… or a Pons link"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[16px] text-white outline-none placeholder:text-white/45"
        />
        <button type="submit" className="btn-primary shrink-0" disabled={state === "loading" || state === "checking"}>
          {state === "loading" ? "Reading…" : state === "checking" ? "Checking…" : "Check"}
        </button>
      </form>

      {state === "checking" && (
        <p className="mt-6 flex items-center gap-2 text-[15px] text-white/70">
          <span className="live-dot" /> No recent check. The six cores are checking it now, about a minute.
        </p>
      )}
      {state === "error" && <p className="mt-6 text-[15px] text-white/80">{error}</p>}

      {state === "ready" && check && g && (
        <div className="glass-fx mt-8 rounded-[24px] border border-white/[0.14] bg-white/[0.04] p-7 backdrop-blur-[20px]">
          <div className="flex items-center gap-4">
            {check.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={check.image} alt="" width={44} height={44} className="h-11 w-11 rounded-full" />
            ) : (
              <span className="grid h-11 w-11 place-items-center rounded-full border border-white/20 text-[11px]">{(check.symbol ?? "?").slice(0, 3)}</span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-[20px] text-white">
                {check.name} <span className="text-white/50">${check.symbol}</span>
              </div>
              <div className="truncate font-mono text-[12px] text-white/45">{check.address}</div>
            </div>
            <div className={`text-[72px] leading-none font-medium ${dumped ? "text-white/30 line-through" : "text-white"}`}>{g.letter}</div>
          </div>

          {dumped && (
            <p className="mt-5 rounded-[12px] border-2 border-white p-3 text-[15px] text-white">
              ⚠ Value fell {fellPct}% since this check. The grade is outdated: treat it as a red flag.
            </p>
          )}
          <p className="mt-5 text-[16px] text-white/85">
            {g.score}/100 · {NOTE[g.letter]}
          </p>
          {g.reasons.length > 0 && (
            <ul className="mt-3 space-y-1 text-[14px] text-white/65">
              {g.reasons.slice(0, 4).map((r) => (
                <li key={r.why}>
                  <span className="font-mono text-white/85">{r.points}</span> {r.why}
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-[13px] text-white/45">
            Checked {(check.age_hours ?? 0) < 1 ? "under an hour" : `${Math.round(check.age_hours ?? 0)} h`} ago ·{" "}
            {check.proof && (
              <Link href={check.proof.page.replace("https://www.coreum.xyz", "")} className="underline decoration-white/30 underline-offset-4 hover:text-white">
                full check and proof
              </Link>
            )}
          </p>

          {risky && (
            <label className="mt-6 flex cursor-pointer items-start gap-3 text-[14px] text-white/80">
              <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-1 h-4 w-4 accent-white" />
              I have read the red flags above and still want to continue to the trade.
            </label>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href={canBuy ? buyUrl : undefined}
              target="_blank"
              rel="noopener noreferrer"
              aria-disabled={!canBuy}
              className={`btn-primary ${canBuy ? "" : "pointer-events-none opacity-40"}`}
            >
              {pons ? "Buy on Pons ↗" : "Trade on a DEX ↗"}
            </a>
            <span className="text-[13px] text-white/50">The trade happens there. Coreum never holds your funds.</span>
          </div>
        </div>
      )}
    </div>
  );
}
