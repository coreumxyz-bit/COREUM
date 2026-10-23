// Token Check: on-chain facts about a Robinhood Chain token (GeckoTerminal's
// public API + one RPC call), turned into a claim the cores judge from those
// facts alone. Server-side only.
import { stockIdentity } from "@/lib/stocks";

const GT = "https://api.geckoterminal.com/api/v2/networks/robinhood";
const RPC = "https://rpc.mainnet.chain.robinhood.com";

export type TokenFacts = {
  holders: number | null;
  top10: number | null; // % of supply held by the top 10 holders
  dev: number | null; // % held by the deployer
  honeypot: boolean | null;
  owner: "renounced" | "none" | string; // owner() of the token contract, if it has one
  liquidity: number | null; // USD in pools
  volume24: number | null;
  fdv: number | null;
  change24: number | null;
  buys24: number | null;
  sells24: number | null;
  ageDays: number | null;
  curve: number | null; // launchpad bonding-curve progress, % (null if not a launchpad token)
  graduated: boolean | null;
  score: number | null; // GeckoTerminal trust score 0–100
  // the deployer's other launches through the Pons factory (absent on older checks)
  devAddress?: string | null;
  devLaunches?: number | null; // other tokens this wallet launched
  devGraduated?: number | null; // of the latest DEV_SAMPLE: reached a DEX
  devDead?: number | null; // of the latest DEV_SAMPLE: older than a day and worth under $1K
  devShared?: boolean; // created through a shared launcher contract, not by a wallet of its own
  // who bought from the Pons curve in the first LAUNCH_BLOCKS after launch (absent on older checks)
  launchBuyers?: number | null; // distinct wallets
  launchBoughtPct?: number | null; // % of supply they bought
  launchHeldPct?: number | null; // % of supply those wallets still hold
  curvePct?: number | null; // % of supply still sitting in the bonding curve (unsold)
  stockOfficial?: string; // an official "• Robinhood Token" for this stock ticker
  stockBorrowed?: string; // uses the ticker of an official stock token without being it
};

export type TokenSrc = {
  kind: "token";
  address: string;
  name: string;
  symbol: string;
  image: string;
  url: string;
  facts: TokenFacts;
  via?: "radar" | "watch"; // checked automatically by Pons Radar or the Watchlist
};

const ADDR = /\b(0x[0-9a-fA-F]{40})\b/;

/** A token address, or a Pons / GeckoTerminal / Blockscout link that names one. */
export const parseToken = (s: string) => {
  const t = s.trim();
  if (/^(?:https?:\/\/)?(?:www\.)?(?:x|twitter)\.com\//i.test(t)) return null;
  const m = t.match(ADDR);
  if (!m) return null;
  // a bare address, or a link — not a sentence that merely contains one
  return /^0x[0-9a-fA-F]{40}$/.test(t) || /^https?:\/\//i.test(t) ? m[1].toLowerCase() : null;
};

const num = (v: unknown) => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return Number.isFinite(n) ? n : null;
};

async function gt(path: string) {
  const r = await fetch(GT + path, {
    headers: { accept: "application/json;version=20230302" },
    signal: AbortSignal.timeout(9000),
    next: { revalidate: 60 },
  });
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`GeckoTerminal did not answer (HTTP ${r.status}) — try again in a minute`);
  return (await r.json()) as { data?: { attributes?: Record<string, unknown> }; included?: { type: string; attributes: Record<string, unknown> }[] };
}

// owner() → address; zero address = renounced; revert / no such function = none
export async function ownerOf(address: string): Promise<TokenFacts["owner"]> {
  try {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: address, data: "0x8da5cb5b" }, "latest"] }),
      signal: AbortSignal.timeout(6000),
      cache: "no-store",
    });
    const j = (await r.json()) as { result?: string; error?: unknown };
    if (!j.result || j.result === "0x" || j.result.length < 66) return "none";
    const a = "0x" + j.result.slice(-40);
    return /^0x0{40}$/.test(a) ? "renounced" : a;
  } catch {
    return "none";
  }
}

const DEV_SAMPLE = 30; // one GeckoTerminal "multi" call
const BLOCKS_PER_DAY = 860_000; // Robinhood Chain, measured over Aug–Oct 2026
// The Pons factory emits TokenCreated(token, curve, creator) with the creator indexed.
const PONS_FACTORY = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const PONS_CREATED = "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
const PONS_GRADUATED = "0xcdb72f157fd3666758a6ce201387ffb52038c7562e4fff352828da1096c4b6b4";
const PONS_FIRST_BLOCK = 27_027_321; // the factory's first launch, 2026-08-03
const LOG_WINDOW = 9_999_000; // the public RPC allows 10M blocks per eth_getLogs
const DEV_FRESH = 120; // seconds a stored scan counts as current

type DevHistory = Pick<TokenFacts, "devAddress" | "devLaunches" | "devGraduated" | "devDead" | "devShared">;
type Launch = { a: string; b: number };

async function rpc<T>(method: string, params: unknown[], tries = 2): Promise<T> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  const t = await r.text();
  const j = t.startsWith("{") ? (JSON.parse(t) as { result?: T; error?: { message?: string } }) : null;
  if (j && !j.error) return j.result as T;
  if (tries > 0) {
    await new Promise((ok) => setTimeout(ok, 3500 - tries * 1000)); // rate-limited: wait, then retry
    return rpc(method, params, tries - 1);
  }
  throw new Error(j?.error?.message || "RPC busy");
}

// Every token the wallet launched through Pons: read from the chain here (the
// public RPC turns away Cloudflare Workers) and kept by the Worker, so the next
// check only reads blocks since the last one.
async function ponsLaunches(dev: string): Promise<{ head: number; contract: boolean; tokens: Launch[] }> {
  const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
  const headers = { "content-type": "application/json", "x-coreum-secret": process.env.COREUM_SITE_SECRET ?? "" };
  const stored = (await fetch(`${base}/api/deployer?address=${dev}`, { headers, signal: AbortSignal.timeout(6000), cache: "no-store" })
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)) as { found?: boolean; contract?: boolean; scanned_to?: number; updated?: number; tokens?: Launch[] } | null;
  if (stored?.found && (stored.contract || Date.now() / 1000 - (stored.updated ?? 0) < DEV_FRESH))
    return { head: stored.scanned_to ?? 0, contract: !!stored.contract, tokens: stored.tokens ?? [] };

  // a contract creator is a shared launcher many people use: not one person's record
  const contract = !stored?.found && (await rpc<string>("eth_getCode", [dev, "latest"])) !== "0x";
  const head = parseInt(await rpc<string>("eth_blockNumber", []), 16);
  const tokens: Launch[] = stored?.found ? [...(stored.tokens ?? [])] : [];
  if (!contract) {
    const topic = "0x" + dev.slice(2).padStart(64, "0");
    // one window at a time: the public RPC rate-limits bursts
    for (let from = (stored?.found ? stored.scanned_to! : PONS_FIRST_BLOCK - 1) + 1; from <= head; from += LOG_WINDOW) {
      const to = Math.min(head, from + LOG_WINDOW - 1);
      const logs = await rpc<{ topics: string[]; blockNumber: string }[]>("eth_getLogs", [
        { address: PONS_FACTORY, fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16), topics: [PONS_CREATED, null, null, topic] },
      ]);
      for (const l of logs) tokens.push({ a: "0x" + l.topics[1].slice(26), b: parseInt(l.blockNumber, 16) });
    }
  }
  const seen = new Set<string>();
  const out = tokens.filter((t) => !seen.has(t.a) && seen.add(t.a)).sort((x, y) => y.b - x.b);
  await fetch(`${base}/api/deployer`, {
    method: "POST",
    headers,
    body: JSON.stringify({ address: dev, scanned_to: head, tokens: out, contract }),
    signal: AbortSignal.timeout(6000),
  }).catch(() => {});
  return { head, contract, tokens: out };
}

// What happened to the deployer's other Pons launches; their value today comes
// from one GeckoTerminal call.
export async function deployerHistory(dev: string, self: string): Promise<DevHistory> {
  const none: DevHistory = { devAddress: dev || null, devLaunches: null, devGraduated: null, devDead: null };
  if (!/^0x[0-9a-fA-F]{40}$/.test(dev)) return none;
  dev = dev.toLowerCase();
  try {
    const h = await ponsLaunches(dev);
    if (h.contract) return { ...none, devAddress: dev, devShared: true };
    const others = h.tokens.filter((t) => t.a !== self.toLowerCase());
    const out: DevHistory = { devAddress: dev, devLaunches: others.length, devGraduated: 0, devDead: 0 };
    const sample = others.slice(0, DEV_SAMPLE);
    if (!sample.length) return out;
    const m = await fetch(`${GT}/tokens/multi/${sample.map((t) => t.a).join(",")}`, {
      headers: { accept: "application/json;version=20230302" },
      signal: AbortSignal.timeout(9000),
      next: { revalidate: 300 },
    });
    if (!m.ok) return { ...out, devGraduated: null, devDead: null };
    const j = (await m.json()) as { data?: { attributes: Record<string, unknown> }[] };
    const byAddr = new Map((j.data ?? []).map((d) => [String(d.attributes.address).toLowerCase(), d.attributes]));
    for (const t of sample) {
      const a = byAddr.get(t.a);
      const lp = a?.launchpad_details as { completed?: boolean } | null | undefined;
      if (lp?.completed) out.devGraduated!++;
      else if (h.head - t.b > BLOCKS_PER_DAY && (num(a?.fdv_usd) ?? 0) < 1000) out.devDead!++;
    }
    return out;
  } catch {
    return none;
  }
}

const LAUNCH_BLOCKS = 3000; // ~5 minutes on Robinhood Chain
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
type LaunchFacts = Pick<TokenFacts, "launchBuyers" | "launchBoughtPct" | "launchHeldPct" | "curvePct">;

async function rpcBatch(calls: { method: string; params: unknown[] }[], tries = 2): Promise<(string | null)[]> {
  const r = await fetch(RPC, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(calls.map((c, id) => ({ jsonrpc: "2.0", id, ...c }))),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  const j = (await r.json().catch(() => null)) as { id: number; result?: string }[] | null;
  if (!Array.isArray(j) && tries > 0) {
    await new Promise((ok) => setTimeout(ok, 3500 - tries * 1000)); // rate-limited: wait, then retry
    return rpcBatch(calls, tries - 1);
  }
  const out: (string | null)[] = calls.map(() => null);
  if (Array.isArray(j)) for (const x of j) out[x.id] = x.result ?? null;
  return out;
}
const balanceCall = (token: string, who: string) => ({ method: "eth_call", params: [{ to: token, data: "0x70a08231" + who.slice(2).padStart(64, "0") }, "latest"] });

// A bundled launch: many wallets buy most of the supply in the first minutes,
// then sell together. Read from the chain: every curve sale in the first
// LAUNCH_BLOCKS, and what those wallets hold now. Pons tokens only.
export async function launchFacts(token: string): Promise<LaunchFacts> {
  const none: LaunchFacts = { launchBuyers: null, launchBoughtPct: null, launchHeldPct: null, curvePct: null };
  try {
    const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
    let l =(await fetch(`${base}/api/pons-token?address=${token}`, { signal: AbortSignal.timeout(5000), cache: "no-store" })
      .then((r) => r.json())
      .catch(() => null)) as { curve?: string; block?: number } | null;
    if (!l?.curve) {
      // launched since the last hourly sync: look for its launch event directly
      const head = parseInt(await rpc<string>("eth_blockNumber", []), 16);
      const logs = await rpc<{ topics: string[]; blockNumber: string }[]>("eth_getLogs", [
        { address: PONS_FACTORY, topics: [PONS_CREATED, "0x" + token.slice(2).padStart(64, "0")], fromBlock: "0x" + Math.max(PONS_FIRST_BLOCK, head - 3_000_000).toString(16), toBlock: "latest" },
      ]);
      if (!logs.length) return none;
      l = { curve: "0x" + logs[0].topics[2].slice(26), block: parseInt(logs[0].blockNumber, 16) };
    }
    const curve = l.curve!, from = l.block!;
    // after graduation DEX trades also pass through the curve address: stop the window there
    const grad = await rpc<{ blockNumber: string }[]>("eth_getLogs", [
      { address: PONS_FACTORY, topics: [PONS_GRADUATED, "0x" + token.slice(2).padStart(64, "0")], fromBlock: "0x" + from.toString(16), toBlock: "0x" + (from + LAUNCH_BLOCKS).toString(16) },
    ]);
    const to = grad.length ? parseInt(grad[0].blockNumber, 16) : from + LAUNCH_BLOCKS;
    const sales = await rpc<{ topics: string[]; data: string }[]>("eth_getLogs", [
      { address: token, topics: [TRANSFER, "0x" + curve.slice(2).padStart(64, "0")], fromBlock: "0x" + from.toString(16), toBlock: "0x" + to.toString(16) },
    ]);
    // wallets only: a contract receiving from the curve is the DEX pool at graduation, not a buyer
    const recipients = [...new Set(sales.map((x) => "0x" + x.topics[2].slice(26)))].slice(0, 150);
    const code = (await Promise.all(Array.from({ length: Math.ceil(recipients.length / 30) }, (_, i) => rpcBatch(recipients.slice(i * 30, i * 30 + 30).map((w) => ({ method: "eth_getCode", params: [w, "latest"] })))))).flat();
    const buyers = recipients.filter((_, i) => !code[i] || code[i] === "0x");
    // each wallet's net position over the window: what it got from the curve minus everything it sent
    // anywhere, so quick flips and buy-sell loops don't count (the total never exceeds the supply)
    const net = new Map<string, bigint>();
    for (const x of sales) {
      const w = "0x" + x.topics[2].slice(26);
      if (buyers.includes(w)) net.set(w, (net.get(w) ?? BigInt(0)) + BigInt(x.data));
    }
    for (let i = 0; i < buyers.length; i += 50) {
      const out = await rpc<{ topics: string[]; data: string }[]>("eth_getLogs", [
        {
          address: token,
          topics: [TRANSFER, buyers.slice(i, i + 50).map((w) => "0x" + w.slice(2).padStart(64, "0"))],
          fromBlock: "0x" + from.toString(16),
          toBlock: "0x" + to.toString(16),
        },
      ]);
      for (const x of out) {
        const w = "0x" + x.topics[1].slice(26);
        net.set(w, (net.get(w) ?? BigInt(0)) - BigInt(x.data));
      }
    }
    const bought = [...net.values()].reduce((s, v) => (v > BigInt(0) ? s + v : s), BigInt(0));
    const [supplyHex, curveHex] = await rpcBatch([{ method: "eth_call", params: [{ to: token, data: "0x18160ddd" }, "latest"] }, balanceCall(token, curve)]);
    const supply = BigInt(supplyHex || "0x0");
    if (!supply) return none;
    let held = BigInt(0);
    for (let i = 0; i < buyers.length; i += 30) {
      for (const b of await rpcBatch(buyers.slice(i, i + 30).map((w) => balanceCall(token, w)))) if (b && b !== "0x") held += BigInt(b);
    }
    const pct = (v: bigint) => Number((v * BigInt(10000)) / supply) / 100;
    return { launchBuyers: buyers.length, launchBoughtPct: pct(bought), launchHeldPct: pct(held), curvePct: pct(BigInt(curveHex || "0x0")) };
  } catch {
    return none;
  }
}

export async function fetchToken(address: string): Promise<TokenSrc> {
  const [info, tok, owner, launch] = await Promise.all([
    gt(`/tokens/${address}/info`),
    gt(`/tokens/${address}?include=top_pools`),
    ownerOf(address),
    launchFacts(address),
  ]);
  if (!tok?.data?.attributes) throw new Error("no token at that address on Robinhood Chain");
  const a = tok.data.attributes;
  const i = info?.data?.attributes ?? {};
  const pools = (tok.included ?? []).filter((x) => x.type === "pool").map((x) => x.attributes);
  const main = pools[0] ?? {};
  const tx24 = (main.transactions as { h24?: { buys?: number; sells?: number } } | undefined)?.h24;
  const created = pools.map((p) => Date.parse(String(p.pool_created_at || ""))).filter(Number.isFinite);
  const holders = i.holders as { count?: number; distribution_percentage?: { top_10?: string } } | undefined;
  const lp = (a.launchpad_details ?? i.launchpad_details) as { graduation_percentage?: number; completed?: boolean } | undefined;

  const facts: TokenFacts = {
    holders: num(holders?.count),
    top10: num(holders?.distribution_percentage?.top_10),
    dev: num(i.developer_holding_percentage),
    honeypot: typeof i.is_honeypot === "boolean" ? i.is_honeypot : null,
    owner,
    liquidity: num(a.total_reserve_in_usd),
    volume24: num((a.volume_usd as { h24?: string } | undefined)?.h24),
    fdv: num(a.fdv_usd),
    change24: num((main.price_change_percentage as { h24?: string } | undefined)?.h24),
    buys24: num(tx24?.buys),
    sells24: num(tx24?.sells),
    ageDays: created.length ? Math.max(0, Math.round(((Date.now() - Math.min(...created)) / 864e5) * 10) / 10) : null,
    curve: lp ? num(lp.graduation_percentage) : null,
    graduated: lp ? !!lp.completed : null,
    score: num(i.gt_score),
    ...(await deployerHistory(String(i.developer_address || ""), address)),
    ...launch,
  };
  const symbol = String(a.symbol || "?").slice(0, 20);
  const stock = stockIdentity(address, symbol);
  if (stock.official) facts.stockOfficial = stock.official.sym;
  else if (stock.borrows) facts.stockBorrowed = stock.borrows.sym;
  return {
    kind: "token",
    address,
    name: String(a.name || symbol).slice(0, 60),
    symbol,
    image: String(i.image_url || a.image_url || "").startsWith("https://") ? String(i.image_url || a.image_url) : "",
    url: `https://www.geckoterminal.com/robinhood/tokens/${address}`,
    facts,
  };
}

const usd = (n: number | null) =>
  n == null ? "unknown" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : `$${n.toFixed(0)}`;
const pc = (n: number | null) => (n == null ? "unknown" : `${n.toFixed(1)}%`);

// absent on checks made before deployer history existed
function devLine(f: TokenFacts): [string, string][] {
  if (f.devLaunches === undefined) return [];
  if (f.devShared) return [["Deployer's other launches", "n/a — made through a shared launcher"]];
  if (f.devLaunches == null) return [["Deployer's other launches", "unknown"]];
  if (f.devLaunches === 0) return [["Deployer's other launches", "none — first Pons launch"]];
  const n = Math.min(f.devLaunches, DEV_SAMPLE);
  const of = f.devLaunches > DEV_SAMPLE ? ` (latest ${DEV_SAMPLE})` : "";
  const live = f.devGraduated == null ? 0 : n - f.devGraduated - (f.devDead ?? 0);
  return [[
    "Deployer's other launches",
    f.devGraduated == null ? `${f.devLaunches} on Pons` : `${f.devLaunches} on Pons${of}: ${f.devGraduated} graduated, ${f.devDead} dead${live ? `, ${live} live or new` : ""}`,
  ]];
}

/** One line per fact — shown on the page and quoted to the cores word for word. */
export function factLines(f: TokenFacts): [string, string][] {
  return [
    ["Holders", f.holders == null ? "unknown" : String(f.holders)],
    ["Top 10 holders own", pc(f.top10)],
    ["Deployer holds", pc(f.dev)],
    ["Honeypot (can't sell)", f.honeypot == null ? "unknown" : f.honeypot ? "YES" : "no"],
    ["Contract owner", f.owner === "renounced" ? "renounced" : f.owner === "none" ? "no owner function" : `active: ${f.owner.slice(0, 8)}…`],
    ["Liquidity", usd(f.liquidity)],
    ["24h volume", usd(f.volume24)],
    ["24h price change", f.change24 == null ? "unknown" : `${f.change24 > 0 ? "+" : ""}${f.change24.toFixed(0)}%`],
    ["24h buys / sells", f.buys24 == null ? "unknown" : `${f.buys24} / ${f.sells24 ?? "?"}`],
    ["Pool age", f.ageDays == null ? "unknown" : `${f.ageDays} days`],
    ...(f.stockOfficial ? ([["Stock token", `official ${f.stockOfficial} • Robinhood Token`]] as [string, string][]) : []),
    ...(f.stockBorrowed ? ([["Stock ticker", `borrows ${f.stockBorrowed}, not the official Robinhood Token`]] as [string, string][]) : []),
    ...devLine(f),
    ...(f.launchBuyers == null
      ? []
      : ([["First 5 min buyers", `${f.launchBuyers} wallets bought ${pc(f.launchBoughtPct ?? null)} · still hold ${pc(f.launchHeldPct ?? null)}`]] as [string, string][])),
    ...(f.curvePct == null || f.graduated ? [] : ([["Unsold, in the curve", pc(f.curvePct)]] as [string, string][])),
    [
      "Launchpad curve",
      f.curve == null ? "not a launchpad token" : f.graduated ? "graduated to a DEX" : `${f.curve.toFixed(0)}% filled, not graduated`,
    ],
  ];
}

// The claim the cores judge. On a launchpad the curve contract holds the unsold
// supply, so part of the top-10 share can be the curve itself — the cores are
// told how much, so concentration in wallets is not excused by it.
export function questionForToken(t: TokenSrc) {
  const f = t.facts;
  const facts = factLines(f).map(([k, v]) => `${k}: ${v}`).join("; ");
  const curveNote =
    f.curve != null && !f.graduated
      ? f.curvePct != null && f.top10 != null
        ? ` Note: the curve itself is a top holder (${f.curvePct.toFixed(0)}% unsold); wallets hold ~${Math.max(0, f.top10 - f.curvePct).toFixed(0)}% of the top-10 share.`
        : " Note: the curve itself is a top holder (unsold supply)."
      : "";
  return (
    `Token risk check from these on-chain facts only. Claim: "${t.name} (${t.symbol}) on Robinhood Chain shows no major rug-pull red flags." ` +
    `Facts — ${facts}.${curveNote} NO if: honeypot; posing as an official stock token it is not; price down 50%+ in 24h (dumped); active owner or deployer controlling supply; near-zero liquidity; a few wallets holding most supply; many first-5-min buyers still holding a big share (likely bundle); deployer's earlier launches mostly died. YES if none apply. UNSURE if mixed or thin data.`
  ).slice(0, 1000);
}
