// Public API for launchpads, wallets and bots: the network's latest verdict on
// a token, in a stable shape (web/app/api/v1/*). Reads the Worker; never writes.
import { api } from "@/lib/api";
import type { TokenFacts } from "@/lib/token";
import { grade } from "@/lib/grade";

export const SITE = "https://www.coreum.xyz";

export const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type, authorization",
};

type Row = {
  found: boolean;
  id?: number;
  phase?: "commit" | "reveal" | "done";
  verdict?: "YES" | "NO" | "UNSURE" | null;
  agree?: number | null;
  n?: number | null;
  created?: number;
  done_at?: number | null;
  h?: string | null;
  chain_tx?: string | null;
  src?: { address: string; name: string; symbol: string; image: string; facts: TokenFacts };
};

export type Verdict = "NO_RED_FLAGS" | "RED_FLAGS" | "MIXED";
const VERDICT: Record<string, Verdict> = { YES: "NO_RED_FLAGS", NO: "RED_FLAGS", UNSURE: "MIXED" };

export const isAddress = (a: string) => /^0x[0-9a-fA-F]{40}$/.test(a);

export async function latestCheck(address: string) {
  const a = address.toLowerCase();
  const r = await api<Row>(`/api/token-verdict?address=${a}`);
  const base = { address: a, badge: `${SITE}/api/v1/badge/${a}`, check_url: `${SITE}/t/${a}` };
  if (!r.found || !r.src) return { ...base, status: "not_checked" as const, verdict: null };

  const f = r.src.facts;
  const done = r.phase === "done";
  const at = done ? r.done_at : r.created;
  return {
    ...base,
    name: r.src.name,
    symbol: r.src.symbol,
    status: done ? ("checked" as const) : ("checking" as const),
    verdict: done && r.verdict ? VERDICT[r.verdict] : null,
    agreement: done ? r.agree ?? null : null, // share of cores that agree with the verdict
    grade: done ? grade(r.verdict, r.agree, f) : null, // A–F with the points behind it, see /grades
    cores: done ? r.n ?? null : null,
    checked_at: at ? new Date(at * 1000).toISOString() : null,
    age_hours: at ? Math.round((Date.now() / 1000 - at) / 360) / 10 : null,
    facts: {
      holders: f.holders,
      top10_pct: f.top10,
      deployer_pct: f.dev,
      honeypot: f.honeypot,
      owner: f.owner,
      liquidity_usd: f.liquidity,
      volume24_usd: f.volume24,
      fdv_usd: f.fdv,
      pool_age_days: f.ageDays,
      curve_pct: f.curve,
      graduated: f.graduated,
      launch_buyers_5min: f.launchBuyers ?? null, // wallets that bought from the curve in the first ~5 minutes
      launch_bought_pct: f.launchBoughtPct ?? null,
      launch_still_held_pct: f.launchHeldPct ?? null,
      curve_supply_pct: f.curvePct ?? null, // unsold supply still in the bonding curve
    },
    deployer:
      f.devLaunches === undefined && !f.devShared
        ? null
        : {
            address: f.devAddress ?? null,
            shared_launcher: !!f.devShared,
            other_launches: f.devLaunches ?? null,
            graduated: f.devGraduated ?? null,
            dead: f.devDead ?? null,
          },
    image: r.src.image || null,
    proof: {
      job: r.id,
      page: `${SITE}/v/${r.id}`,
      ledger_block: done ? r.h ?? null : null,
      chain_tx: r.chain_tx ?? null, // written to CoreumVerdicts within the hour
    },
  };
}

export type Check = Awaited<ReturnType<typeof latestCheck>>;

// Value now vs. at the check: a grade is a snapshot, and a token can be dumped
// hours later. One GeckoTerminal call per 30 tokens; cached for two minutes.
export async function valueNow(addresses: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>();
  for (let i = 0; i < addresses.length; i += 30) {
    try {
      const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/multi/${addresses.slice(i, i + 30).join(",")}`, {
        headers: { accept: "application/json;version=20230302" },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 120 },
      });
      if (!r.ok) continue;
      const j = (await r.json()) as { data?: { attributes: { address: string; fdv_usd?: string | null } }[] };
      for (const d of j.data ?? []) {
        const v = parseFloat(String(d.attributes.fdv_usd ?? ""));
        out.set(d.attributes.address.toLowerCase(), Number.isFinite(v) ? v : null);
      }
    } catch {}
  }
  return out;
}

/** Fall in value since the check, as a share (0.88 = −88%); null when unknown or not down. */
export function fellSince(atCheck: number | null | undefined, now: number | null | undefined) {
  if (!atCheck || now == null || atCheck < 1000) return null;
  const fall = 1 - now / atCheck;
  return fall > 0 ? fall : null;
}
