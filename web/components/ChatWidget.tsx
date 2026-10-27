"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState } from "react";

type Started = { address: string; symbol?: string; job?: number; page?: string; error?: string };
type Msg = { role: "user" | "assistant"; content: string; started?: Started[] };

const KEY = "coreum_chat";
const SUGGEST = ["Is $CORS safe?", "Which THKR is the real one?", "What got red flags on Pons today?", "What can I do with $CORS?"];

// links in replies: our own pages open in place, everything else in a new tab
function Rich({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/[^\s)]+|\*\*[^*]+\*\*)/g);
  return (
    <>
      {parts.map((p, i) => {
        if (/^https?:\/\//.test(p)) {
          const own = p.match(/^https?:\/\/(?:www\.)?coreum\.xyz(\/[^\s]*)?$/);
          const cls = "underline decoration-white/35 underline-offset-4 break-all hover:text-white";
          return own ? (
            <Link key={i} href={own[1] || "/"} className={cls}>{p.replace(/^https?:\/\/(www\.)?/, "")}</Link>
          ) : (
            <a key={i} href={p} target="_blank" rel="noreferrer" className={cls}>{p.replace(/^https?:\/\//, "")}</a>
          );
        }
        if (/^\*\*.+\*\*$/.test(p)) return <strong key={i} className="font-medium text-white">{p.slice(2, -2)}</strong>;
        return <Fragment key={i}>{p}</Fragment>;
      })}
    </>
  );
}

export function ChatBox({ full = false }: { full?: boolean }) {
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [left, setLeft] = useState<number | null>(null);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const s = localStorage.getItem(KEY);
      if (s) setMsgs(JSON.parse(s));
    } catch {}
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(msgs.slice(-30)));
    } catch {}
    end.current?.scrollIntoView({ block: "end" });
  }, [msgs, busy]);

  async function send(text: string) {
    const v = text.trim();
    if (!v || busy) return;
    const next: Msg[] = [...msgs, { role: "user", content: v }];
    setMsgs(next);
    setQ("");
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
      });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? "the assistant is busy, try again");
      setMsgs([...next, { role: "assistant", content: j.reply, started: j.started }]);
      if (typeof j.left === "number") setLeft(j.left);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    }
    setBusy(false);
  }

  return (
    <div className={`flex min-h-0 flex-col ${full ? "h-[min(72vh,760px)]" : "h-full"}`}>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        {msgs.length === 0 && (
          <div>
            <p className="text-[15px] leading-relaxed text-white/75">
              Ask about any token on Robinhood Chain. Answers come from Coreum&apos;s checks, with the proof link.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {SUGGEST.map((s) => (
                <button key={s} type="button" onClick={() => void send(s)} className="rounded-[10px] border border-white/15 bg-white/[0.04] px-3 py-1.5 text-left text-[13px] text-white/80 hover:border-white/40">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        <div className="flex flex-col gap-3">
          {msgs.map((m, i) => (
            <div key={i} className={m.role === "user" ? "self-end max-w-[85%]" : "self-start max-w-[92%]"}>
              <div
                className={`rounded-[14px] px-3.5 py-2.5 text-[14px] leading-relaxed whitespace-pre-wrap [overflow-wrap:anywhere] ${
                  m.role === "user" ? "bg-white text-black" : "border border-white/[0.12] bg-white/[0.05] text-white/85"
                }`}
              >
                {m.role === "user" ? m.content : <Rich text={m.content} />}
              </div>
              {m.started?.map((s) => (
                <div key={s.address} className="mt-2 rounded-[12px] border border-white/25 px-3 py-2 text-[13px] text-white/80">
                  {s.page ? (
                    <Link href={s.page} className="hover:text-white">
                      Checking {s.symbol ? `$${s.symbol}` : s.address.slice(0, 8) + "…"} now, about a minute → view the check
                    </Link>
                  ) : (
                    <span className="text-white/55">Could not start a check: {s.error}</span>
                  )}
                </div>
              ))}
            </div>
          ))}
          {busy && <div className="self-start rounded-[14px] border border-white/[0.12] bg-white/[0.05] px-3.5 py-2.5 text-[14px] text-white/55">Looking it up…</div>}
        </div>
        <div ref={end} />
      </div>
      {err && <p className="px-4 pb-2 text-[13px] text-white/55">{err}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(q);
        }}
        className="flex gap-2 border-t border-white/[0.1] p-3"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={1000}
          placeholder="A token, a ticker or a question…"
          className="min-w-0 flex-1 rounded-[10px] border border-white/15 bg-black/40 px-3 py-2 text-[14px] text-white outline-none placeholder:text-white/35 focus:border-white/45"
        />
        <button type="submit" disabled={busy || !q.trim()} className="rounded-[10px] bg-white px-4 py-2 text-[14px] text-black disabled:opacity-40">
          Ask
        </button>
      </form>
      <div className="flex items-center justify-between px-4 pb-3 text-[11px] text-white/35">
        <span>A risk screen, not financial advice</span>
        <span>
          {left !== null && `${left} left today · `}
          {msgs.length > 0 && (
            <button type="button" onClick={() => setMsgs([])} className="hover:text-white">clear</button>
          )}
        </span>
      </div>
    </div>
  );
}

// the floating button on every page except /chat itself
export default function ChatWidget() {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === "/chat" || path?.startsWith("/embed")) return null;
  return (
    <>
      {open && (
        <div className="fixed right-3 bottom-20 z-[60] flex h-[min(600px,calc(100dvh-110px))] w-[min(400px,calc(100vw-24px))] flex-col overflow-hidden rounded-[22px] border border-white/[0.16] bg-black/80 backdrop-blur-[24px] sm:right-5">
          <div className="flex items-center justify-between border-b border-white/[0.1] px-4 py-3">
            <span className="text-[15px] text-white">Ask Coreum</span>
            <span className="flex items-center gap-3 text-[12px] text-white/50">
              <Link href="/chat" onClick={() => setOpen(false)} className="hover:text-white">full screen</Link>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="text-[18px] leading-none hover:text-white">×</button>
            </span>
          </div>
          <ChatBox />
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="fixed right-3 bottom-4 z-[60] rounded-full border border-white/30 bg-black/70 px-4 py-2.5 text-[14px] text-white backdrop-blur-[16px] hover:border-white sm:right-5 sm:bottom-5"
      >
        {open ? "Close" : "Ask Coreum"}
      </button>
    </>
  );
}
