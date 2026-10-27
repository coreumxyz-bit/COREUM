"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import LogoMark from "@/components/LogoMark";
import { Markdown } from "@/lib/markdown";
import { connectWallet, signMessage } from "@/lib/holder";

type Started = { address: string; symbol?: string; job?: number; page?: string; error?: string };
type Msg = { role: "user" | "assistant"; content: string; status?: string; started?: Started[]; error?: string; live?: boolean };
type Chat = { id: string; title: string; ts: number; msgs: Msg[]; remote?: boolean };

const STORE = "coreum_chats";
// starter questions: a few from what the network just checked, the rest drawn from a pool
const POOL = [
  { t: "Is $CORS safe to hold?", s: "Grade, red flags, proof link" },
  { t: "What can I do with $CORS?", s: "Holder tier, API keys, cores" },
  { t: "What got red flags on Pons today?", s: "Read the radar" },
  { t: "Which THKR is the real one?", s: "Tell copycats apart by ticker" },
  { t: "How do I spot a rug before buying?", s: "The checks that matter" },
  { t: "What does an F grade mean?", s: "How grades are scored" },
  { t: "How does Coreum know a verdict wasn't changed?", s: "Commit, reveal, sealed on chain" },
  { t: "How many tokens launched on Pons?", s: "The census, counted from the chain" },
  { t: "How do I run my own core?", s: "First 50 cores, seat #1 is open" },
  { t: "What are snipers and why do they matter?", s: "Launch buyers, explained" },
  { t: "Which Robinhood stock tokens are official?", s: "Real shares vs borrowed tickers" },
  { t: "How do I add Coreum checks to my bot?", s: "API, MCP, badge" },
  { t: "Is a renounced owner enough to be safe?", s: "What it does and doesn't prove" },
  { t: "What's the network's average agreement?", s: "Live network stats" },
];
const shuffle = <T,>(a: T[]) => a.map((x) => [Math.random(), x] as const).sort((p, q) => p[0] - q[0]).map(([, x]) => x);

function useSuggestions() {
  const [list, setList] = useState(POOL.slice(0, 4));
  useEffect(() => {
    const picked = shuffle(POOL);
    setList(picked.slice(0, 4));
    fetch("/api/radar")
      .then((r) => (r.ok ? r.json() : null))
      .then((j: { checks?: { verdict: string; src?: { symbol?: string } }[] } | null) => {
        const seen = new Set<string>();
        const fresh = (j?.checks ?? []).filter((c) => {
          const sym = c.src?.symbol;
          if (!sym || seen.has(sym) || /^\$?CORS$/i.test(sym)) return false;
          seen.add(sym);
          return true;
        });
        if (!fresh.length) return;
        const live = shuffle(fresh.slice(0, 6)).slice(0, 2).map((c, i) =>
          i === 0
            ? { t: `Is $${c.src!.symbol} safe?`, s: c.verdict === "NO" ? "Just checked: red flags" : "Just checked by the network" }
            : { t: `Who launched $${c.src!.symbol}?`, s: "Deployer history on Pons" }
        );
        setList([...live, ...picked.filter((x) => !live.some((l) => l.t === x.t))].slice(0, 4));
      })
      .catch(() => {});
  }, []);
  return list;
}

const load = (): Chat[] => {
  try {
    return JSON.parse(localStorage.getItem(STORE) || "[]");
  } catch {
    return [];
  }
};
const saveLocal = (c: Chat[]) => {
  try {
    if (c.length) localStorage.setItem(STORE, JSON.stringify(c.slice(0, 30)));
    else localStorage.removeItem(STORE);
  } catch {}
};
const newId = () => Math.random().toString(36).slice(2, 10);
const clean = (c: Chat) => ({ id: c.id, title: c.title, ts: c.ts, msgs: c.msgs.map(({ live, status, ...m }) => m) });
const short = (a: string) => `${a.slice(0, 6)}…${a.slice(-4)}`;

/**
 * Conversations: in this browser for guests, on the server for a signed-in wallet
 * (so they follow it to any device). The open one streams from /api/chat.
 */
function useChats() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [cur, setCur] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [left, setLeft] = useState<number | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [authErr, setAuthErr] = useState("");
  const [ready, setReady] = useState(false); // nothing is written back before the history is read
  const stop = useRef<AbortController | null>(null);
  const latest = useRef<Chat[]>([]);
  latest.current = chats;
  const meRef = useRef<string | null>(null);
  meRef.current = me;

  // a signed-in wallet: upload this browser's chats once, then the server is the source
  const loadRemote = useCallback(async () => {
    const local = load();
    for (const c of local) await fetch("/api/chats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(clean(c)) }).catch(() => null);
    if (local.length) saveLocal([]);
    const list = (await fetch("/api/chats").then((r) => (r.ok ? r.json() : [])).catch(() => [])) as { id: string; title: string; ts: number }[];
    setChats(list.map((c) => ({ ...c, msgs: [], remote: true })));
    setCur("");
  }, []);

  useEffect(() => {
    void (async () => {
      const a = (await fetch("/api/auth").then((r) => r.json()).catch(() => ({}))) as { addr?: string | null };
      if (a.addr) {
        setMe(a.addr);
        await loadRemote();
      } else {
        const c = load();
        setChats(c);
        if (c[0]) setCur(c[0].id);
      }
      setReady(true);
    })();
  }, [loadRemote]);
  useEffect(() => {
    if (ready && !me) saveLocal(chats.map(clean));
  }, [chats, me, ready]);

  // open a server chat: its messages load on first view
  const open = async (id: string) => {
    setCur(id);
    const c = latest.current.find((x) => x.id === id);
    if (!c?.remote || c.msgs.length) return;
    const full = (await fetch(`/api/chats?id=${id}`).then((r) => (r.ok ? r.json() : null)).catch(() => null)) as Chat | null;
    if (full) setChats((cs) => cs.map((x) => (x.id === id ? { ...x, msgs: full.msgs, remote: false } : x)));
  };
  const persist = (id: string) => {
    if (!meRef.current) return;
    setTimeout(() => {
      const c = latest.current.find((x) => x.id === id);
      if (c) void fetch("/api/chats", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(clean(c)) }).catch(() => null);
    }, 50);
  };

  const signIn = async () => {
    setAuthErr("");
    try {
      const addr = await connectWallet();
      if (!addr) throw new Error("no wallet connected");
      const n = (await fetch(`/api/auth?addr=${addr}`).then((r) => r.json())) as { message: string; nonce: string };
      const sig = await signMessage(n.message, addr);
      if (!sig) throw new Error("the signature was rejected");
      const r = await fetch("/api/auth", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ addr, sig, nonce: n.nonce }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "sign-in failed");
      setMe(j.addr);
      await loadRemote();
    } catch (e) {
      setAuthErr(e instanceof Error ? e.message : String(e));
    }
  };
  const signOut = async () => {
    await fetch("/api/auth", { method: "DELETE" }).catch(() => null);
    setMe(null);
    setChats([]);
    saveLocal([]);
    setCur("");
  };

  const chat = chats.find((c) => c.id === cur);
  const patchLast = (id: string, f: (m: Msg) => Msg) =>
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, msgs: c.msgs.map((m, i) => (i === c.msgs.length - 1 ? f(m) : m)) } : c)));

  const run = useCallback(async (id: string, history: Msg[]) => {
    setBusy(true);
    const ctl = new AbortController();
    stop.current = ctl;
    setChats((cs) => cs.map((c) => (c.id === id ? { ...c, ts: Date.now(), msgs: [...history, { role: "assistant", content: "", live: true, status: "Thinking" }] } : c)));
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: history.map(({ role, content }) => ({ role, content })) }),
        signal: ctl.signal,
      });
      if (!r.ok || !r.body || !(r.headers.get("content-type") || "").includes("event-stream")) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error ?? "the assistant is busy, try again");
      }
      const reader = r.body.getReader(), dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n\n")) >= 0) {
          const line = buf.slice(0, i);
          buf = buf.slice(i + 2);
          if (!line.startsWith("data:")) continue;
          const ev = JSON.parse(line.slice(5));
          if (ev.type === "delta") patchLast(id, (m) => ({ ...m, content: m.content + ev.text, status: undefined }));
          else if (ev.type === "status") patchLast(id, (m) => ({ ...m, status: ev.text }));
          else if (ev.type === "reset") patchLast(id, (m) => ({ ...m, content: "" }));
          else if (ev.type === "started") patchLast(id, (m) => ({ ...m, started: ev.checks }));
          else if (ev.type === "error") patchLast(id, (m) => ({ ...m, error: ev.text }));
          else if (ev.type === "done") setLeft(ev.left);
        }
      }
    } catch (e) {
      if (!ctl.signal.aborted) patchLast(id, (m) => ({ ...m, error: e instanceof Error ? e.message : String(e) }));
    }
    patchLast(id, (m) => ({ ...m, live: false, status: undefined }));
    setBusy(false);
    persist(id);
  }, []);

  const send = (text: string) => {
    const v = text.trim();
    if (!v || busy) return;
    let id = cur;
    let history: Msg[];
    if (!chat) {
      id = newId();
      history = [{ role: "user", content: v }];
      setChats((cs) => [{ id, title: v.slice(0, 60), ts: Date.now(), msgs: history }, ...cs]);
      setCur(id);
    } else history = [...chat.msgs.filter((m) => !m.error || m.content), { role: "user", content: v }];
    void run(id, history);
  };
  const retry = () => {
    if (!chat || busy) return;
    const lastUser = chat.msgs.map((m) => m.role).lastIndexOf("user");
    if (lastUser >= 0) void run(chat.id, chat.msgs.slice(0, lastUser + 1));
  };
  const fresh = () => {
    if (!busy) setCur("");
  };
  const remove = (id: string) => {
    setChats((cs) => cs.filter((c) => c.id !== id));
    if (me) void fetch(`/api/chats?id=${id}`, { method: "DELETE" }).catch(() => null);
    if (id === cur) setCur("");
  };
  return { chats, chat, cur, setCur: open, busy, left, send, retry, fresh, remove, me, signIn, signOut, authErr, stop: () => stop.current?.abort() };
}

function Account({ c, compact }: { c: ReturnType<typeof useChats>; compact?: boolean }) {
  if (c.me)
    return (
      <div className={`flex items-center justify-between gap-2 ${compact ? "text-[11px]" : "text-[12px]"} text-white/50`}>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-white" /> <span className="font-mono">{short(c.me)}</span>
        </span>
        <button type="button" onClick={() => void c.signOut()} className="hover:text-white">Sign out</button>
      </div>
    );
  return (
    <div>
      <button
        type="button"
        onClick={() => void c.signIn()}
        className={compact ? "text-[11px] text-white/60 underline decoration-white/25 underline-offset-2 hover:text-white" : "w-full rounded-[12px] bg-white px-3 py-2.5 text-[14px] font-medium text-black hover:bg-white/90"}
      >
        {compact ? "Sign in with wallet to keep chats" : "Sign in with wallet"}
      </button>
      {!compact && <p className="mt-2 text-[11px] leading-relaxed text-white/40">One signature, no gas. Your chats follow your wallet to any device; 1M $CORS holders get 150 messages a day.</p>}
      {c.authErr && <p className="mt-1.5 text-[11px] text-white/55">{c.authErr}</p>}
    </div>
  );
}

function Composer({ onSend, onStop, busy, big }: { onSend: (t: string) => void; onStop: () => void; busy: boolean; big?: boolean }) {
  const [q, setQ] = useState("");
  const ta = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ta.current;
    if (!el) return;
    el.style.height = "auto"; // one row by default; grow with the text up to 200px
    if (q) el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, [q]);
  const go = () => {
    if (!q.trim() || busy) return;
    onSend(q);
    setQ("");
  };
  return (
    <div className={`flex items-end gap-2 rounded-[26px] border border-white/[0.14] bg-white/[0.06] p-2 pl-4 backdrop-blur-[20px] focus-within:border-white/35 ${big ? "shadow-[0_0_60px_rgba(255,255,255,0.06)]" : ""}`}>
      <textarea
        ref={ta}
        rows={1}
        value={q}
        autoFocus={big}
        maxLength={4000}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            go();
          }
        }}
        placeholder="Ask about a token, a ticker, a wallet, anything…"
        className="max-h-[200px] min-h-[24px] flex-1 resize-none bg-transparent py-2 text-[15px] leading-6 text-white outline-none placeholder:text-white/35"
      />
      {busy ? (
        <button type="button" onClick={onStop} aria-label="Stop" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white">
          <span className="h-3 w-3 rounded-[2px] bg-black" />
        </button>
      ) : (
        <button type="button" onClick={go} disabled={!q.trim()} aria-label="Send" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-[18px] text-black transition-opacity disabled:opacity-25">
          ↑
        </button>
      )}
    </div>
  );
}

function Message({ m, last, onRetry }: { m: Msg; last: boolean; onRetry: () => void }) {
  const [copied, setCopied] = useState(false);
  if (m.role === "user")
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-[20px] bg-white/[0.1] px-4 py-2.5 text-[15px] leading-relaxed whitespace-pre-wrap text-white [overflow-wrap:anywhere]">{m.content}</div>
      </div>
    );
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-white/20">
        <LogoMark className="h-[14px] w-[13px] text-white" />
      </div>
      <div className="min-w-0 flex-1 text-[15px] leading-[1.65] text-white/[0.88]">
        {m.status && (
          <p className="mb-2 flex items-center gap-2 text-[14px] text-white/55">
            <span className="h-2 w-2 animate-pulse rounded-full bg-white/70" />
            {m.status}…
          </p>
        )}
        {m.content && <Markdown text={m.content + (m.live && !m.status ? " ▍" : "")} />}
        {m.started?.map((s) => (
          <div key={s.address} className="mt-3 rounded-[14px] border border-white/20 bg-white/[0.04] px-4 py-3 text-[14px]">
            {s.page ? (
              <Link href={s.page} className="flex items-center justify-between gap-3 text-white hover:underline">
                <span>Checking {s.symbol ? `$${s.symbol}` : s.address.slice(0, 10) + "…"} on six cores, about a minute</span>
                <span className="text-white/50">open →</span>
              </Link>
            ) : (
              <span className="text-white/55">Could not start a check: {s.error}</span>
            )}
          </div>
        ))}
        {m.error && <p className="mt-2 text-[14px] text-white/55">⚠ {m.error}</p>}
        {!m.live && (m.content || m.error) && (
          <div className="mt-2 flex gap-1 text-[12px] text-white/40">
            {m.content && (
              <button
                type="button"
                onClick={() => {
                  void navigator.clipboard?.writeText(m.content);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1200);
                }}
                className="rounded-[8px] px-2 py-1 hover:bg-white/[0.08] hover:text-white"
              >
                {copied ? "Copied" : "Copy"}
              </button>
            )}
            {last && (
              <button type="button" onClick={onRetry} className="rounded-[8px] px-2 py-1 hover:bg-white/[0.08] hover:text-white">
                Retry
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export function ChatBox({ full = false }: { full?: boolean }) {
  const c = useChats();
  const suggest = useSuggestions();
  const end = useRef<HTMLDivElement>(null);
  const msgs = c.chat?.msgs ?? [];
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs.length, msgs[msgs.length - 1]?.content, msgs[msgs.length - 1]?.status]);

  const empty = (
    <div className="flex flex-1 flex-col items-center justify-center px-4 pb-6 text-center">
      <LogoMark className={`${full ? "h-[44px] w-[40px]" : "h-[32px] w-[29px]"} text-white`} />
      <h2 className={`${full ? "mt-5 text-[clamp(28px,4vw,40px)]" : "mt-4 text-[22px]"} leading-tight tracking-[-0.02em] text-white`}>What do you want to check?</h2>
      <p className="mt-2 max-w-[460px] text-[14px] text-white/50">Tokens, tickers and wallets on Robinhood Chain, answered from Coreum&apos;s checks with the proof. Or ask anything.</p>
      <div className={`mt-6 grid w-full max-w-[640px] gap-2 ${full ? "sm:grid-cols-2" : ""}`}>
        {suggest.map((s) => (
          <button key={s.t} type="button" onClick={() => c.send(s.t)} className="rounded-[16px] border border-white/[0.12] bg-white/[0.03] px-4 py-3 text-left transition-colors hover:border-white/30 hover:bg-white/[0.06]">
            <span className="block text-[14px] text-white">{s.t}</span>
            <span className="mt-0.5 block text-[12px] text-white/45">{s.s}</span>
          </button>
        ))}
      </div>
    </div>
  );

  const thread = (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className={`mx-auto flex max-w-[760px] flex-col gap-6 ${full ? "px-4 pt-8 pb-10 sm:px-6" : "px-4 pt-5 pb-6"}`}>
        {msgs.map((m, i) => (
          <Message key={i} m={m} last={i === msgs.length - 1} onRetry={c.retry} />
        ))}
        <div ref={end} />
      </div>
    </div>
  );

  const composer = (
    <div className={`mx-auto w-full max-w-[760px] ${full ? "px-4 pb-4 sm:px-6" : "px-3 pb-3"}`}>
      <Composer onSend={c.send} onStop={c.stop} busy={c.busy} big={full && !msgs.length} />
      <p className="mt-2 text-center text-[11px] text-white/35">
        Ask Coreum can be wrong. A risk screen, not financial advice{c.left !== null ? ` · ${c.left} messages left today` : ""}
      </p>
      <div className={`mt-1.5 ${full ? "lg:hidden" : ""}`}>
        <Account c={c} compact />
      </div>
    </div>
  );

  if (!full)
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        {msgs.length ? thread : empty}
        {composer}
        <ChatHeaderHook onNew={c.fresh} />
      </div>
    );

  return (
    <div className="mx-auto flex h-[calc(100dvh-88px)] min-h-0 w-full max-w-[1280px] sm:px-8">
      <aside className="hidden w-[240px] shrink-0 flex-col border-r border-white/[0.08] py-3 pr-4 lg:flex">
        <button type="button" onClick={c.fresh} className="flex items-center gap-2 rounded-[12px] border border-white/[0.14] px-3 py-2.5 text-[14px] text-white hover:bg-white/[0.06]">
          <span className="text-[18px] leading-none">+</span> New chat
        </button>
        <p className="mt-5 mb-2 px-2 text-[12px] text-white/40">Recent</p>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {c.chats.map((x) => (
            <div key={x.id} className={`group flex items-center rounded-[10px] ${x.id === c.cur ? "bg-white/[0.09]" : "hover:bg-white/[0.05]"}`}>
              <button type="button" onClick={() => c.setCur(x.id)} className="min-w-0 flex-1 truncate px-2.5 py-2 text-left text-[13px] text-white/80">
                {x.title}
              </button>
              <button type="button" onClick={() => c.remove(x.id)} aria-label="Delete chat" className="px-2 text-white/0 group-hover:text-white/40 hover:!text-white">
                ×
              </button>
            </div>
          ))}
        </div>
        <div className="border-t border-white/[0.08] px-1 pt-3">
          <Account c={c} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 pt-2 lg:hidden">
          <span className="text-[13px] text-white/50">Ask Coreum</span>
          <button type="button" onClick={c.fresh} className="rounded-[10px] border border-white/15 px-3 py-1.5 text-[13px] text-white">+ New chat</button>
        </div>
        {msgs.length ? thread : empty}
        {composer}
      </div>
      {/* a twin of the history column keeps the conversation centered under the nav */}
      <div className="hidden w-[240px] shrink-0 xl:block" aria-hidden />
    </div>
  );
}

// lets the floating panel's header start a new chat
let newChatFromHeader: (() => void) | null = null;
function ChatHeaderHook({ onNew }: { onNew: () => void }) {
  useEffect(() => {
    newChatFromHeader = onNew;
    return () => {
      newChatFromHeader = null;
    };
  }, [onNew]);
  return null;
}

// the floating button on every page except /chat itself
export default function ChatWidget() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === "/chat" || path?.startsWith("/embed")) return null;
  return (
    <>
      {open && (
        <div className="fixed right-3 bottom-[72px] z-[60] flex h-[min(640px,calc(100dvh-100px))] w-[min(420px,calc(100vw-24px))] flex-col overflow-hidden rounded-[24px] border border-white/[0.16] bg-[#0b0b0b]/90 shadow-[0_20px_80px_rgba(0,0,0,0.6)] backdrop-blur-[24px] sm:right-5">
          <div className="flex items-center justify-between border-b border-white/[0.08] px-4 py-3">
            <span className="flex items-center gap-2 text-[15px] text-white">
              <LogoMark className="h-[16px] w-[15px] text-white" /> Ask Coreum
            </span>
            <span className="flex items-center gap-1 text-[12px] text-white/55">
              <button type="button" onClick={() => newChatFromHeader?.()} className="rounded-[8px] px-2 py-1 hover:bg-white/[0.08] hover:text-white">New</button>
              <Link href="/chat" onClick={() => setOpen(false)} className="rounded-[8px] px-2 py-1 hover:bg-white/[0.08] hover:text-white">Full screen</Link>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="rounded-[8px] px-2 py-1 text-[16px] leading-none hover:bg-white/[0.08] hover:text-white">×</button>
            </span>
          </div>
          <ChatBox />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed right-3 bottom-4 z-[60] flex items-center gap-2 rounded-full border border-white/25 bg-black/75 px-4 py-2.5 text-[14px] text-white shadow-[0_8px_30px_rgba(0,0,0,0.5)] backdrop-blur-[16px] hover:border-white sm:right-5 sm:bottom-5"
      >
        <LogoMark className="h-[15px] w-[14px] text-white" />
        {open ? "Close" : "Ask Coreum"}
      </button>
    </>
  );
}
