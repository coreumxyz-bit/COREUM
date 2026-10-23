"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EXAMPLES } from "@/lib/verify";

// Ask the network: the question becomes a job, the page that follows shows
// the cores committing, revealing and agreeing in real time.
type Example = string | { label: string; value: string };

export default function AskBox({
  placeholder = "Ask a question, paste an X post link or a token address…",
  examples = EXAMPLES,
  cta = "Verify",
}: { placeholder?: string; examples?: Example[]; cta?: string } = {}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function submit(text: string) {
    const v = text.trim();
    if (v.length < 8) {
      setErr("Ask something with a bit more to it — 8 characters at least.");
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const r = await fetch("/api/ask", { method: "POST", body: JSON.stringify({ q: v }) });
      const j = await r.json();
      if (!r.ok || j.error) throw new Error(j.error ?? "the network did not take the job");
      router.push(`/v/${j.id}`);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "the network did not take the job");
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit(q);
        }}
        className="glass-fx flex items-center gap-2 rounded-[16px] border border-white/[0.14] bg-white/[0.06] p-[6px] backdrop-blur-[20px] focus-within:border-white/40"
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          maxLength={300}
          placeholder={placeholder}
          aria-label="Question for the network"
          className="min-w-0 flex-1 bg-transparent px-4 py-3 text-[16px] text-white outline-none placeholder:text-white/45"
        />
        <button
          type="submit"
          disabled={busy}
          className="flex h-[46px] shrink-0 items-center rounded-[11px] bg-[#E9E9E9] px-[22px] text-[15px] font-[450] text-[#0A0707] transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {busy ? "Sending…" : cta}
        </button>
      </form>
      {err && <p className="mt-2 text-[13px] text-white/60">{err}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        {examples.map((e) => {
          const x = typeof e === "string" ? { label: e, value: e } : e;
          return (
          <button
            key={x.value}
            type="button"
            disabled={busy}
            onClick={() => {
              setQ(x.value);
              void submit(x.value);
            }}
            className="rounded-[8px] border border-white/[0.12] bg-white/[0.04] px-3 py-1.5 text-left text-[12px] text-white/70 transition-colors hover:border-white/30 hover:text-white"
          >
            {x.label}
          </button>
          );
        })}
      </div>
    </div>
  );
}
