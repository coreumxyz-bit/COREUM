"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PLAY_MIN, PLAY_SYMS, beatAi, verdict, type Play } from "@/lib/play";

const SECRET_KEY = "coreum.play.secret";
const NAME_KEY = "coreum.play.name";

// localStorage can throw (private mode, blocked storage) — the game still works
// for the session, the player just loses history on reload.
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
};

const fmt = (p: number) =>
  p >= 1000 ? p.toLocaleString("en-US", { maximumFractionDigits: 0 }) : p >= 10 ? p.toFixed(2) : p.toFixed(3);

const mmss = (s: number) => {
  const v = Math.max(0, Math.floor(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
};

export function shareUrl(p: Play) {
  const site = "https://www.coreum.xyz";
  const arrow = p.dir > 0 ? "UP" : "DOWN";
  const text =
    p.st === "open"
      ? `I just called $${p.sym} ${arrow} for the next ${PLAY_MIN} min against @0xcoreum's AI swarm. Sealed in a public ledger, no edits. Think you can beat the AI?`
      : beatAi(p)
        ? `I beat the AI. Called $${p.sym} ${arrow} while @0xcoreum's swarm said the opposite — and it's sealed in a SHA-256 ledger. Your turn:`
        : `${verdict(p)}: $${p.sym} ${arrow} vs @0xcoreum's AI swarm. Every call sealed, misses included. Your turn:`;
  return `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(`${site}/play/${p.id}`)}`;
}

function Spark({ pts, up }: { pts: number[]; up: boolean }) {
  if (pts.length < 2) return <div className="h-full w-full animate-pulse rounded-xl bg-white/[0.03]" />;
  const W = 400, H = 90;
  const lo = Math.min(...pts), hi = Math.max(...pts), span = hi - lo || 1;
  const d = pts
    .map((p, i) => `${i ? "L" : "M"}${((i / (pts.length - 1)) * W).toFixed(1)},${(H - 6 - ((p - lo) / span) * (H - 12)).toFixed(1)}`)
    .join("");
  const c = up ? "var(--color-saffron-spark)" : "rgba(255,255,255,0.45)";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-full w-full">
      <path d={d} fill="none" stroke={c} strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function PlayRow({ p, price, now }: { p: Play; price?: number; now: number }) {
  const left = p.dl - now;
  const live = p.st === "open" && price != null;
  const winning = live && p.dir * (price - p.p0) > 0;
  const tone =
    p.st === "open"
      ? winning ? "text-saffron-spark" : "text-white/45"
      : p.st === "hit" ? "text-saffron-spark" : "text-white/45";
  return (
    <div className="row-in flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.08] py-4">
      <div className="flex items-center gap-4">
        <span className={`font-mono text-[22px] ${p.dir > 0 ? "text-saffron-spark" : "text-white/45"}`}>
          {p.dir > 0 ? "▲" : "▼"}
        </span>
        <div>
          <div className="text-[15px] font-semibold text-bone-white">
            ${p.sym} {p.dir > 0 ? "up" : "down"}{" "}
            <span className="font-mono text-[12px] font-normal text-ash-gray">from {fmt(p.p0)}</span>
          </div>
          <div className="mt-0.5 font-mono text-[12px] text-ash-gray">
            AI said {p.ai === 0 ? "nothing" : p.ai > 0 ? "▲ up" : "▼ down"}
            {p.ai !== 0 && p.ai !== p.dir && <span className="text-saffron-spark"> · you&apos;re against the swarm</span>}
          </div>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <span className={`font-mono text-[13px] ${tone}`}>
          {p.st === "open"
            ? left > 0
              ? `${winning ? "winning" : "losing"} · ${mmss(left)}`
              : "settling…"
            : `${verdict(p)} · ${fmt(p.p1 ?? 0)}`}
        </span>
        <a href={shareUrl(p)} target="_blank" rel="noopener noreferrer" className="link-ghost">
          Share ↗
        </a>
        <Link href={`/play/${p.id}`} className="link-ghost">
          Proof
        </Link>
      </div>
    </div>
  );
}

export default function PlayGame() {
  const [sym, setSym] = useState<(typeof PLAY_SYMS)[number]>("BTC");
  const [prices, setPrices] = useState<Record<string, number[]>>({});
  const [ai, setAi] = useState<{ pct: number | null; n: number } | null>(null);
  const [secret, setSecret] = useState("");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [mine, setMine] = useState<Play[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [now, setNow] = useState(0);

  useEffect(() => {
    let s = store.get(SECRET_KEY);
    if (!s) {
      s = crypto.randomUUID() + crypto.randomUUID();
      store.set(SECRET_KEY, s);
    }
    setSecret(s);
    const n = store.get(NAME_KEY) ?? "";
    setName(n);
    setDraft(n);
    setNow(Date.now() / 1000);
    const id = setInterval(() => setNow(Date.now() / 1000), 1000);
    return () => clearInterval(id);
  }, []);

  const loadMine = useCallback(() => {
    if (!secret) return;
    fetch("/api/plays", { method: "POST", body: JSON.stringify({ secret }) })
      .then((r) => r.json())
      .then((j) => Array.isArray(j) && setMine(j))
      .catch(() => {});
  }, [secret]);

  useEffect(() => {
    const load = () => {
      fetch("/api/state")
        .then((r) => r.json())
        .then((j) => j.prices && setPrices(j.prices))
        .catch(() => {});
      loadMine();
    };
    load();
    const id = setInterval(load, 20_000);
    return () => clearInterval(id);
  }, [loadMine]);

  useEffect(() => {
    setAi(null);
    fetch(`/api/swarm?sym=${sym}`)
      .then((r) => r.json())
      .then((j) => setAi({ pct: j.pct ?? null, n: j.rows?.length ?? 0 }))
      .catch(() => setAi({ pct: null, n: 0 }));
  }, [sym]);

  const pts = prices[sym] ?? [];
  const price = pts[pts.length - 1];
  const up30 = pts.length > 1 ? price >= pts[0] : true;
  const chg = pts.length > 1 ? ((price - pts[0]) / pts[0]) * 100 : null;
  const openHere = mine.find((p) => p.sym === sym && p.st === "open");

  async function go(dir: "up" | "down") {
    const nm = (name || draft).trim();
    if (nm.length < 2) {
      setErr("Pick a name first — 2+ characters.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/play", {
        method: "POST",
        body: JSON.stringify({ secret, name: nm, sym, dir }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? "call failed");
      if (!name) {
        setName(nm);
        store.set(NAME_KEY, nm);
      }
      setMine((m) => [{ ...j, name: nm } as Play, ...m]);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "call failed");
    } finally {
      setBusy(false);
    }
  }

  const aiDir = ai?.pct == null ? 0 : ai.pct >= 0.5 ? 1 : -1;
  const aiShare = ai?.pct == null ? null : Math.round((aiDir > 0 ? ai.pct : 1 - ai.pct) * 100);

  return (
    <div className="card-glow lift overflow-hidden rounded-[28px] border border-white/10 glass-fx bg-white/[0.06] border border-white/[0.12] backdrop-blur-[20px]">
      {/* market tabs */}
      <div className="flex border-b border-white/10">
        {PLAY_SYMS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSym(s)}
            className={`flex-1 py-4 font-mono text-[14px] tracking-[0.04em] transition-colors ${
              s === sym ? "bg-saffron-spark/10 text-saffron-spark" : "text-ash-gray hover:text-bone-white"
            }`}
          >
            ${s}
          </button>
        ))}
      </div>

      <div className="p-6 sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-caption-label text-ash-gray">
              <span className="live-dot" /> ${sym} · live · last 30 min
            </p>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="font-mono text-[clamp(36px,7vw,60px)] leading-none tracking-[-0.04em] text-bone-white">
                {price != null ? `$${fmt(price)}` : "…"}
              </span>
              {chg != null && (
                <span className={`font-mono text-[14px] ${up30 ? "text-saffron-spark" : "text-white/45"}`}>
                  {up30 ? "▲" : "▼"} {Math.abs(chg).toFixed(2)}%
                </span>
              )}
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-right">
            <div className="text-[11px] font-semibold tracking-[0.04em] text-ash-gray uppercase">The AI swarm says</div>
            <div className="mt-1 font-mono text-[18px]">
              {ai == null ? (
                <span className="text-ash-gray">…</span>
              ) : aiDir === 0 ? (
                <span className="text-silver-mist">silent — you call it first</span>
              ) : (
                <span className={aiDir > 0 ? "text-saffron-spark" : "text-white/45"}>
                  {aiDir > 0 ? "▲ UP" : "▼ DOWN"} · {aiShare}%
                </span>
              )}
            </div>
            {ai != null && ai.n > 0 && (
              <div className="text-[11px] text-ash-gray">{ai.n} open node call{ai.n > 1 ? "s" : ""}, trust-weighted</div>
            )}
          </div>
        </div>

        <div className="mt-5 h-[90px]">
          <Spark pts={pts} up={up30} />
        </div>

        {!name && (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            maxLength={24}
            placeholder="Your name on the scoreboard"
            className="mt-6 w-full rounded-2xl border border-white/15 bg-white/[0.03] px-5 py-4 text-[16px] text-bone-white outline-none placeholder:text-ash-gray focus:border-saffron-spark/60"
          />
        )}

        <p className="mt-6 text-center text-[15px] text-silver-mist">
          Where is <b className="text-bone-white">${sym}</b> in <b className="text-bone-white">{PLAY_MIN} minutes</b>?
        </p>

        {openHere ? (
          <div className="mt-4 rounded-2xl border border-saffron-spark/30 bg-saffron-spark/[0.06] px-5 py-4 text-center">
            <p className="text-[14px] text-bone-white">
              {openHere.dl > now
                ? <>Your ${sym} call is locked in — {mmss(openHere.dl - now)} to go.</>
                : <>Time&apos;s up — settling on the next price tick…</>}
            </p>
            <a href={shareUrl(openHere)} target="_blank" rel="noopener noreferrer" className="btn-primary mt-3">
              Dare your friends on X ↗
            </a>
          </div>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              type="button"
              disabled={busy || price == null || !secret}
              onClick={() => go("up")}
              className="rounded-2xl bg-saffron-spark py-6 text-[22px] font-bold tracking-[-0.01em] text-black transition-transform hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-40"
            >
              ▲ UP
            </button>
            <button
              type="button"
              disabled={busy || price == null || !secret}
              onClick={() => go("down")}
              className="rounded-2xl bg-white/[0.06] border border-white/40 !text-white backdrop-blur-[20px] py-6 text-[22px] font-bold tracking-[-0.01em] text-black transition-transform hover:-translate-y-0.5 active:scale-[.98] disabled:opacity-40"
            >
              ▼ DOWN
            </button>
          </div>
        )}
        {err && <p className="mt-3 text-center text-[13px] text-white/45">{err}</p>}
        <p className="mt-4 text-center text-[12px] text-ash-gray">
          Free, no wallet. Your call is sealed into the public SHA-256 ledger with server time and price — it can&apos;t be
          edited or deleted, win or lose.
        </p>

        {mine.length > 0 && (
          <div className="mt-8">
            <p className="text-caption-label text-ash-gray">
              Your calls{name && <> · {name}</>}
            </p>
            <div className="mt-2">
              {mine.slice(0, 8).map((p) => (
                <PlayRow key={p.id} p={p} price={prices[p.sym]?.at(-1)} now={now} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
