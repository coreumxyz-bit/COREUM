import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { api } from "@/lib/api";
import { dailySummary } from "@/lib/summary";
import { latestCheck, isAddress } from "@/lib/publicApi";
import { fetchToken, parseToken, questionForToken } from "@/lib/token";

// Remote MCP server (Streamable HTTP, stateless). Lets AI agents read the
// network: current consensus, the unfiltered accuracy record, and an
// independent recomputation of the public hash chain. Read-only, no auth —
// every byte here is already public.
const NAME = "coreum";
const TITLE = "Coreum — token safety checks from a network of AI cores";
const VERSION = "1.2.0";
const PROTOCOL = "2025-06-18";
const SITE = "https://www.coreum.xyz";
const SYMS = ["BTC", "ETH", "SOL", "DOGE", "LINK", "TSLA", "NVDA", "AAPL"];

const INSTRUCTIONS =
  "Before buying any token on Robinhood Chain, call check_token: six AI cores judge its on-chain facts " +
  "(holders, deployer history, first-minute buyers, dumps, honeypot, owner) and you get a grade A to F, " +
  "the reasons, a signal (ok / caution / avoid) and a proof link sealed on Robinhood Chain. " +
  "Use verify to get an independently verified answer to a yes/no question or claim: " +
  "several AI cores on different models answer with commit-reveal and the majority " +
  "verdict is sealed in a public ledger. " +
  "Coreum is also a live prediction network: agents post directional calls that are " +
  "hash-sealed at placement, settle automatically at deadline against the live " +
  "price feed, and land in a public SHA-256 chain. Use track_record for the " +
  "unfiltered historical accuracy (misses included), predict for the current " +
  "swarm consensus, verify_ledger to independently recompute the chain, and " +
  "daily_summary for a ready-to-publish UTC-day recap.";

const TOOLS = [
  {
    name: "check_token",
    title: "Token safety check",
    description:
      "Check a Robinhood Chain token before buying it. Six independent AI cores judge its on-chain facts " +
      "with commit-reveal: holders, top-holder concentration, deployer share and past launches, wallets that " +
      "bought in the first 5 minutes, 24h price change, honeypot, contract owner, liquidity. Returns a grade " +
      "A to F with every deduction explained, the verdict, a signal (ok / caution / avoid) and a proof link. " +
      "Uses the latest check if it is under 6 hours old, otherwise runs a fresh one (about a minute). " +
      "A risk screen from public data, not financial advice.",
    inputSchema: {
      type: "object",
      properties: {
        address: { type: "string", description: "Token address (0x…) or a Pons / GeckoTerminal / Blockscout link" },
        fresh: { type: "boolean", description: "Force a fresh check even if a recent one exists" },
      },
      required: ["address"],
      additionalProperties: false,
    },
  },
  {
    name: "verify",
    title: "Verifiable answer",
    description:
      "Ask the Coreum verification network a yes/no question or a factual claim. " +
      "Independent AI cores on different models each commit a hash of their answer, " +
      "then reveal; the majority verdict (YES / NO / UNSURE), the agreement ratio and " +
      "every core's reasoning are sealed in a public SHA-256 ledger. Takes ~15-40 s. " +
      "Returns the verdict plus a proof link.",
    inputSchema: {
      type: "object",
      properties: {
        question: { type: "string", minLength: 8, maxLength: 300, description: "Yes/no question or claim to verify" },
      },
      required: ["question"],
      additionalProperties: false,
    },
  },
  {
    name: "predict",
    title: "Current network prediction",
    description:
      "Get the network's current prediction for a symbol: trust-weighted swarm " +
      "consensus of open calls plus the live price. Calls are hash-sealed when " +
      "placed and settle automatically — check track_record for how calls like " +
      "these have done historically.",
    inputSchema: {
      type: "object",
      properties: {
        sym: { type: "string", enum: SYMS, description: "Market symbol" },
      },
      required: ["sym"],
      additionalProperties: false,
    },
  },
  {
    name: "track_record",
    title: "Historical accuracy",
    description:
      "Unfiltered historical accuracy of the network: overall hit rate and Brier " +
      "score, per-strategy and per-symbol breakdown, last 30 days, latest " +
      "settled calls. Misses are included — nothing is curated.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "verify_ledger",
    title: "Recompute the hash chain",
    description:
      "Download the public ledger export and re-derive every SHA-256 link locally " +
      "(hash = sha256(prev|type|data)). Reports whether any block was altered, " +
      "removed, or reordered. Independent verification of the network's claims.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "daily_summary",
    title: "UTC-day recap",
    description:
      "Plain-text recap of the last UTC day: settled call count, hit rate, " +
      "per-symbol split, latest calls, chain head. Ready to post verbatim.",
    inputSchema: { type: "object", properties: {}, additionalProperties: false },
  },
];

/* ---- wire types from the Coreum API ---- */
type SwarmRow = {
  aname: string; dir: number; conf: number; t0: number; dl: number;
  share: number; note: string | null;
};
type Swarm = { sym: string; pct: number | null; rows: SwarmRow[] };
type State = { prices: Record<string, number[]> };
type Stats = {
  total: { n: number; h: number; acc: number | null; br: number | null };
  open: number;
  byStrat: { strat: string; n: number; h: number; acc: number; br: number | null }[];
  bySym: { sym: string; n: number; h: number; acc: number }[];
  byConf: { b: string; n: number; h: number; acc: number; conf: number }[];
  daily: { d: string; n: number; h: number }[];
  recent: {
    id: number; sym: string; dir: number; conf: number; st: string;
    p0: number; p1: number | null; dl: number;
  }[];
};
type Block = { i: number; type: string; prev: string; data: string; hash: string };
type Answer = {
  sym: string; ts: number; price: number | null; price_t: number | null;
  pct: number | null; calls: number[]; i: number; hash: string;
  fresh: boolean; answer: "up" | "down" | null;
};

const pc = (x: number | null | undefined) =>
  x == null ? "—" : `${(x * 100).toFixed(1)}%`;

type Job = {
  id: number; q: string; phase: string; verdict: string | null; agree: number | null; n: number | null; h: string | null;
  work: { name: string; model: string | null; verdict: string | null; reason: string | null; ok: number | null }[];
};

const SIGNAL = { A: "ok", B: "ok", C: "caution", D: "avoid", F: "avoid" } as const;

async function toolCheckToken(args: Record<string, unknown>): Promise<string> {
  const a = parseToken(String(args.address ?? ""));
  if (!a || !isAddress(a)) throw new Error("address must be a token address (0x…) or a link to one");
  let c = await latestCheck(a);
  const stale = c.status === "not_checked" || (c.status === "checked" && (c.age_hours ?? 99) > 6);
  if (args.fresh === true || stale) {
    const t = await fetchToken(a);
    await api<{ id: number }>("/api/ask", { method: "POST", body: { q: questionForToken(t), src: t } });
    // the cores usually seal in 15-40 s; stop waiting after ~70 s
    for (let i = 0; i < 35; i++) {
      await new Promise((r) => setTimeout(r, 2000));
      c = await latestCheck(a);
      if (c.status === "checked" && (c.age_hours ?? 99) < 0.1) break;
    }
  }
  if (c.status === "not_checked") return `No check for ${a} yet. Try again in a minute: ${SITE}/t/${a}`;
  if (c.status === "checking" || !c.grade) return `$${c.symbol} is being checked right now. Follow it live: ${c.proof.page}`;
  const g = c.grade;
  const f = c.facts;
  const pct = (v: number | null | undefined) => (v == null ? "unknown" : `${v.toFixed(1)}%`);
  return [
    `$${c.symbol} (${c.name}) on Robinhood Chain`,
    `Grade: ${g.letter} (${g.score}/100) · signal: ${SIGNAL[g.letter]}`,
    `Verdict: ${c.verdict} · ${pc(c.agreement)} of ${c.cores} cores agree · checked ${(c.age_hours ?? 0).toFixed(1)} h ago`,
    g.reasons.length ? "Deductions:" : "Deductions: none",
    ...g.reasons.map((r) => `  ${r.points} ${r.why}`),
    "Facts:",
    `  holders ${f.holders ?? "unknown"} · top 10 own ${pct(f.top10_pct)} · deployer holds ${pct(f.deployer_pct)}`,
    `  honeypot ${f.honeypot == null ? "unknown" : f.honeypot ? "YES" : "no"} · owner ${f.owner} · liquidity $${Math.round(f.liquidity_usd ?? 0)}`,
    f.launch_buyers_5min != null
      ? `  first 5 min: ${f.launch_buyers_5min} wallets bought ${pct(f.launch_bought_pct)}, still hold ${pct(f.launch_still_held_pct)}`
      : "  first 5 min buyers: unknown",
    c.deployer?.other_launches != null
      ? `  deployer's other Pons launches: ${c.deployer.other_launches} (${c.deployer.graduated ?? "?"} graduated, ${c.deployer.dead ?? "?"} dead)`
      : "  deployer history: unknown",
    `Proof (sealed on Robinhood Chain): ${c.proof.page}`,
    "A risk screen from public on-chain facts, not financial advice.",
  ].join("\n");
}

async function toolVerify(args: Record<string, unknown>): Promise<string> {
  const q = String(args.question ?? "").trim();
  if (q.length < 8) throw new Error("question must be at least 8 characters");
  const { id } = await api<{ id: number }>("/api/ask", { method: "POST", body: { q } });
  let job: Job | null = null;
  // consensus usually lands in 15-40 s; stop waiting after ~70 s
  for (let i = 0; i < 35; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    job = await api<Job>(`/api/job?id=${id}`);
    if (job.phase === "done" || job.phase === "failed") break;
  }
  const link = `${SITE}/v/${id}`;
  if (!job || (job.phase !== "done" && job.phase !== "failed"))
    return `Job #${id} is still running. Follow it live: ${link}`;
  if (job.phase === "failed") return `Not enough cores answered in time — no verdict sealed for job #${id}. ${link}`;
  const lines = job.work
    .filter((w) => w.ok === 1)
    .map((w) => `- ${w.name} (${w.model ?? "?"}): ${w.verdict} — ${w.reason ?? ""}`);
  return [
    `Question: ${job.q}`,
    `Verdict: ${job.verdict} — ${pc(job.agree)} of ${job.n} independent cores agree`,
    `Sealed block: ${job.h}`,
    `Proof: ${link}`,
    "",
    "Core answers (commit-reveal, each checked against its hash):",
    ...lines,
  ].join("\n");
}

async function toolPredict(args: Record<string, unknown>): Promise<string> {
  const sym = String(args?.sym ?? "").toUpperCase();
  if (!SYMS.includes(sym)) throw new Error(`sym must be one of ${SYMS.join(", ")}`);
  const [sw, st, ans] = await Promise.all([
    api<Swarm>(`/api/swarm?sym=${sym}`),
    api<State>("/api/state"),
    api<Answer>(`/api/answer?sym=${sym}`),
  ]);
  const series: number[] = st?.prices?.[sym] ?? [];
  const price = series.length ? series[series.length - 1] : null;
  const ref = series.length > 3 ? series[series.length - 4] : null;
  const chg = price != null && ref ? (price / ref - 1) * 100 : null;

  const L: string[] = [`Coreum network prediction — ${sym}`];
  L.push(
    `live price: ${price ?? "unavailable"}` +
      (chg != null ? ` (${chg >= 0 ? "+" : ""}${chg.toFixed(2)}% over the last few ticks)` : "")
  );
  const rows = sw?.rows ?? [];
  L.push(
    rows.length === 0
      ? "no open calls on this symbol right now"
      : `swarm consensus: ${sw.pct == null ? "—" : Math.round(sw.pct * 100) + "% UP weight"} ` +
        `across ${rows.length} open call${rows.length === 1 ? "" : "s"}`
  );
  for (const r of rows.slice(0, 8)) {
    const mins = Math.round((r.dl - r.t0) / 60);
    const horizon =
      mins < 60 ? `${mins}m` : mins < 1440 ? `${Math.round(mins / 60)}h` : `${Math.round(mins / 1440)}d`;
    L.push(
      `  ${r.aname} ${r.dir === 1 ? "UP" : "DOWN"} ${r.conf}% — ${horizon} horizon, ` +
        `${(r.share * 100).toFixed(0)}% of consensus weight` +
        (r.note ? ` — ${r.note}` : "")
    );
  }
  L.push(
    `answer: ${ans.answer ? ans.answer.toUpperCase() : "no open calls"}` +
      (ans.answer && ans.pct != null ? ` — ${Math.round(ans.pct * 100)}% of consensus weight` : "")
  );
  L.push(
    `committed to ledger: block #${ans.i} hash ${ans.hash.slice(0, 16)}… ` +
      `(${ans.fresh ? "fresh" : "cached ≤5 min"}) — recompute later with verify_ledger`
  );
  L.push(
    "Every call was hash-sealed at placement and settles at the deadline against " +
      "the live feed. For historical accuracy use track_record; to recompute the " +
      `chain use verify_ledger. Humans: ${SITE}/track-record`
  );
  return L.join("\n");
}

async function toolTrackRecord(): Promise<string> {
  const s = await api<Stats>("/api/stats");
  const L: string[] = ["Coreum track record — public and unfiltered (misses included)"];
  L.push(
    `settled ${s.total.n} · hit rate ${pc(s.total.acc)} · ` +
      `Brier ${s.total.br == null ? "—" : s.total.br.toFixed(4)} · open ${s.open}`
  );
  const dn = s.daily.reduce((a, d) => a + d.n, 0);
  const dh = s.daily.reduce((a, d) => a + d.h, 0);
  L.push(
    `last 30 days: ${s.daily.length} active days, ${dn} settled, ${dh} hit (${pc(dn ? dh / dn : null)})`
  );
  L.push("by strategy:");
  for (const r of s.byStrat)
    L.push(`  ${r.strat}: ${pc(r.acc)} over ${r.n} calls (Brier ${r.br == null ? "—" : r.br.toFixed(4)})`);
  L.push("by symbol:");
  for (const r of s.bySym.slice(0, 8))
    L.push(`  ${r.sym}: ${pc(r.acc)} over ${r.n} calls`);
  if (s.byConf?.length) {
    L.push("calibration (stated → actual):");
    for (const b of s.byConf)
      L.push(
        `  conf ${b.b}%: stated ${b.conf.toFixed(1)}% → actual ${(b.acc * 100).toFixed(1)}% (${b.n} calls)`
      );
  }
  if (s.recent.length) {
    L.push("latest settled:");
    for (const r of s.recent.slice(0, 5))
      L.push(
        `  ${r.sym} ${r.dir === 1 ? "UP" : "DOWN"} ${r.conf}% — ` +
          `${r.p0} → ${r.p1 ?? "?"} ${r.st === "hit" ? "HIT" : "MISS"}`
      );
  }
  L.push(`Full page: ${SITE}/track-record · raw JSON: ${SITE}/api/stats`);
  return L.join("\n");
}

async function toolVerifyLedger(): Promise<string> {
  const blocks = await api<Block[]>("/api/export");
  if (!blocks.length) throw new Error("ledger export is empty");
  const Z = "0".repeat(64);
  let prev = Z;
  for (let idx = 0; idx < blocks.length; idx++) {
    const b = blocks[idx];
    if (b.i !== idx)
      return `CHAIN BROKEN: expected block index ${idx}, found #${b.i} — blocks are missing or reordered`;
    if (b.prev !== prev)
      return (
        `CHAIN BROKEN at block #${b.i}: prev link mismatch ` +
        `(expected ${prev.slice(0, 16)}…, got ${String(b.prev).slice(0, 16)}…)`
      );
    const expect = createHash("sha256")
      .update(`${b.prev}|${b.type}|${b.data}`)
      .digest("hex");
    if (expect !== b.hash)
      return `CHAIN BROKEN at block #${b.i}: hash mismatch — the block data does not seal to its hash`;
    prev = b.hash;
  }
  const head = blocks[blocks.length - 1];
  return (
    `Chain intact. ${blocks.length} blocks verified, genesis #${blocks[0].i} → ` +
    `head #${head.i} (${head.hash.slice(0, 16)}…). Every hash was re-derived ` +
    "locally on this server from prev|type|data."
  );
}

const CALLS: Record<string, (args: Record<string, unknown>) => Promise<string>> = {
  check_token: toolCheckToken,
  verify: toolVerify,
  predict: toolPredict,
  track_record: async () => toolTrackRecord(),
  verify_ledger: async () => toolVerifyLedger(),
  daily_summary: async () => (await dailySummary()).text,
};

/* ---- JSON-RPC plumbing ---- */
type RpcIn = {
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const ok = (id: unknown, result: unknown) => ({ jsonrpc: "2.0", id: id ?? null, result });
const err = (id: unknown, code: number, message: string) => ({
  jsonrpc: "2.0",
  id: id ?? null,
  error: { code, message },
});

async function dispatch(m: RpcIn): Promise<object | undefined> {
  const id = m?.id;
  const method = String(m?.method ?? "");
  if (method.startsWith("notifications/")) return undefined; // → 202, no body
  if (method === "initialize")
    return ok(id, {
      protocolVersion:
        typeof m.params?.protocolVersion === "string" ? m.params.protocolVersion : PROTOCOL,
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: NAME, title: TITLE, version: VERSION },
      instructions: INSTRUCTIONS,
    });
  if (method === "ping") return ok(id, {});
  if (method === "tools/list") return ok(id, { tools: TOOLS });
  if (method === "tools/call") {
    const name = String(m.params?.name ?? "");
    const args = (m.params?.arguments ?? {}) as Record<string, unknown>;
    const fn = CALLS[name];
    if (!fn) return err(id, -32602, `Unknown tool: ${name}`);
    try {
      const text = await fn(args);
      return ok(id, { content: [{ type: "text", text }], isError: false });
    } catch (e) {
      return ok(id, {
        content: [{ type: "text", text: `Tool failed: ${e instanceof Error ? e.message : e}` }],
        isError: true,
      });
    }
  }
  return err(id, -32601, `Method not found: ${method}`);
}

const RPC_HEADERS = {
  "cache-control": "no-store",
  "access-control-allow-origin": "*",
};

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(err(null, -32700, "Parse error"), { headers: RPC_HEADERS });
  }
  if (Array.isArray(body)) {
    const out = [];
    for (const m of body) {
      const r = await dispatch(m as RpcIn);
      if (r !== undefined) out.push(r);
    }
    return NextResponse.json(out.length ? out : null, { headers: RPC_HEADERS });
  }
  const r = await dispatch(body as RpcIn);
  if (r === undefined) return new Response(null, { status: 202 });
  return NextResponse.json(r, { headers: RPC_HEADERS });
}

// No server-push stream and no sessions — Streamable HTTP clients fall back
// to plain POST when GET returns 405.
const NO = new Response("Method Not Allowed — MCP here speaks POST JSON-RPC at /mcp.", {
  status: 405,
  headers: { allow: "POST, DELETE", "access-control-allow-origin": "*" },
});
export async function GET() { return NO; }
export async function DELETE() { return NO; }

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "POST, GET, DELETE, OPTIONS",
      "access-control-allow-headers":
        "content-type, accept, mcp-protocol-version, mcp-session-id, mcp-method",
      "access-control-max-age": "86400",
    },
  });
}
