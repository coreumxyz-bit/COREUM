// Deployer passport: what one wallet launched on Pons and what became of it.
// Launches come from the Worker's Pons census (synced from the chain); what
// each token is worth today comes from one GeckoTerminal call.
import { api } from "@/lib/api";

export type PassportToken = { token: string; ts: number; grad_ts: number | null; symbol: string | null; name: string | null; image: string | null; fdv: number | null; status: "graduated" | "dead" | "live" | "new" };
export type Passport = {
  address: string;
  launches: number;
  graduated: number;
  first_launch: number | null;
  last_launch: number | null;
  contract: boolean | null;
  tokens: PassportToken[];
  sample: { checked: number; dead: number; live: number; graduated: number };
  badges: { label: string; tone: "good" | "warn" | "bad" | "info"; why: string }[];
};

const DAY = 86400;
const DEAD_FDV = 1000; // USD

export async function passport(address: string): Promise<Passport> {
  const a = address.toLowerCase();
  const d = await api<{ launches: number; graduated: number; first_launch: number | null; last_launch: number | null; contract: boolean | null; tokens: { token: string; ts: number; grad_ts: number | null }[] }>(
    `/api/pons-deployer?address=${a}`
  );
  const info = new Map<string, { symbol: string; name: string; image: string | null; fdv: number | null }>();
  const latest = d.tokens.slice(0, 30);
  if (latest.length) {
    try {
      const r = await fetch(`https://api.geckoterminal.com/api/v2/networks/robinhood/tokens/multi/${latest.map((t) => t.token).join(",")}`, {
        headers: { accept: "application/json;version=20230302" },
        signal: AbortSignal.timeout(8000),
        next: { revalidate: 300 },
      });
      if (r.ok) {
        const j = (await r.json()) as { data?: { attributes: Record<string, unknown> }[] };
        for (const x of j.data ?? []) {
          const at = x.attributes;
          const fdv = parseFloat(String(at.fdv_usd ?? ""));
          info.set(String(at.address).toLowerCase(), {
            symbol: String(at.symbol ?? ""),
            name: String(at.name ?? ""),
            image: String(at.image_url ?? "").startsWith("https://") ? String(at.image_url) : null,
            fdv: Number.isFinite(fdv) ? fdv : null,
          });
        }
      }
    } catch {}
  }
  const now = Date.now() / 1000;
  const tokens: PassportToken[] = d.tokens.map((t, i) => {
    const x = info.get(t.token);
    const status: PassportToken["status"] = t.grad_ts
      ? "graduated"
      : now - t.ts < DAY
        ? "new"
        : i < 30 && (x?.fdv ?? 0) < DEAD_FDV
          ? "dead"
          : "live";
    return { ...t, symbol: x?.symbol ?? null, name: x?.name ?? null, image: x?.image ?? null, fdv: x?.fdv ?? null, status };
  });
  const sampled = tokens.slice(0, 30);
  const sample = {
    checked: sampled.length,
    dead: sampled.filter((t) => t.status === "dead").length,
    live: sampled.filter((t) => t.status === "live").length,
    graduated: sampled.filter((t) => t.status === "graduated").length,
  };

  // badges are plain readings of the record, each with its reason
  const badges: Passport["badges"] = [];
  const old = sample.checked - sampled.filter((t) => t.status === "new").length;
  if (d.contract) badges.push({ label: "Shared launcher", tone: "info", why: "This is a contract many people launch through, not one person's wallet." });
  if (!d.launches) badges.push({ label: "No Pons launches", tone: "info", why: "This wallet has not launched a token through Pons." });
  if (d.launches === 1) badges.push({ label: "New deployer", tone: "info", why: "One Pons launch so far: no track record yet, good or bad." });
  if (d.graduated > 0 && (old === 0 || sample.dead / old < 0.5))
    badges.push({ label: "Trusted builder", tone: "good", why: `${d.graduated} launch${d.graduated > 1 ? "es" : ""} reached a DEX, and most of the rest are still alive.` });
  if (d.launches >= 20 && !d.contract) badges.push({ label: "Serial launcher", tone: "warn", why: `${d.launches.toLocaleString("en-US")} tokens launched from this one wallet.` });
  if (old >= 5 && sample.dead / old >= 0.7)
    badges.push({ label: "Mostly dead launches", tone: "bad", why: `${sample.dead} of the latest ${old} launches older than a day are worth under $1K.` });

  return { address: a, launches: d.launches, graduated: d.graduated, first_launch: d.first_launch, last_launch: d.last_launch, contract: d.contract, tokens, sample, badges };
}
