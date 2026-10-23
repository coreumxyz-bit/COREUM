// Hourly Pons census sync, run on the site (the public RPC turns away
// Cloudflare Workers): new launches and graduations since the last block
// synced, creators that just crossed 20 launches, and once a day a curve-balance
// sample. The Worker stores it all (api/src/pons.js). Same steps as
// api/scripts/pons-sync.mjs, which stays as a manual / backup runner.

const RPC = "https://rpc.mainnet.chain.robinhood.com";
const FACTORY = "0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e";
const CREATED = "0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607";
const GRADUATED = "0xcdb72f157fd3666758a6ce201387ffb52038c7562e4fff352828da1096c4b6b4";
const FIRST_BLOCK = 27_027_321;
const SAMPLE = 1000; // curve balances read once a day (fits one function run)

type Log = { topics: string[]; blockNumber: string };
const hex = (n: number) => "0x" + n.toString(16);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function post<T>(body: unknown, tries = 3): Promise<T> {
  const r = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body), cache: "no-store", signal: AbortSignal.timeout(15000) });
  const t = await r.text();
  const j = t.startsWith("{") || t.startsWith("[") ? JSON.parse(t) : null;
  const limited = !j || (!Array.isArray(j) && /too many|rate/i.test(j.error?.message || ""));
  if (limited && tries > 0) {
    await sleep(4000 - tries * 1000);
    return post<T>(body, tries - 1);
  }
  if (!j) throw new Error("RPC unavailable");
  return j as T;
}
const rpc = async <T>(method: string, params: unknown[]): Promise<T> => {
  const j = await post<{ result?: T; error?: { message: string } }>({ jsonrpc: "2.0", id: 1, method, params });
  if (j.error) throw new Error(j.error.message);
  return j.result as T;
};

async function logs(topic: string, from: number, to: number): Promise<Log[]> {
  const out: Log[] = [];
  let span = 2_000_000;
  for (let a = from; a <= to; ) {
    const b = Math.min(to, a + span - 1);
    const j = await post<{ result?: Log[]; error?: { message: string } }>({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_getLogs",
      params: [{ address: FACTORY, topics: [topic], fromBlock: hex(a), toBlock: hex(b) }],
    });
    if (j.error) {
      if (!/exceed|limit|range/i.test(j.error.message)) throw new Error(j.error.message);
      span = Math.max(1000, Math.floor(span / 3));
      continue;
    }
    out.push(...(j.result ?? []));
    a = b + 1;
  }
  return out;
}

export async function ponsSync(admin: string) {
  const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
  const api = async <T>(p: string, body?: unknown): Promise<T> => {
    const r = await fetch(base + p, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", "x-coreum-admin": admin, "x-coreum-secret": process.env.COREUM_SITE_SECRET ?? "" },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(30000),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(`${p}: HTTP ${r.status} ${(j as { error?: string }).error ?? ""}`);
    return j as T;
  };

  const st = await api<{ scanned_to: number; sample_at: number; unchecked_busy_creators: string[] }>("/api/pons/state");
  const head = parseInt(await rpc<string>("eth_blockNumber", []), 16);
  const from = (st.scanned_to || FIRST_BLOCK - 1) + 1;
  let launches = 0, graduations = 0;
  if (from <= head) {
    const [t0, t1] = await Promise.all(
      [from, head].map(async (n) => parseInt((await rpc<{ timestamp: string }>("eth_getBlockByNumber", [hex(n), false])).timestamp, 16))
    );
    const at = (n: number) => Math.round(t0 + ((n - from) * (t1 - t0)) / (head - from || 1));
    const L = (await logs(CREATED, from, head)).map((l) => {
      const b = parseInt(l.blockNumber, 16);
      return { t: "0x" + l.topics[1].slice(26), c: "0x" + l.topics[2].slice(26), d: "0x" + l.topics[3].slice(26), b, ts: at(b) };
    });
    const G = (await logs(GRADUATED, from, head)).map((l) => ({ t: "0x" + l.topics[1].slice(26), ts: at(parseInt(l.blockNumber, 16)) }));
    for (let i = 0; i < L.length; i += 2000) await api("/api/pons/ingest", { launches: L.slice(i, i + 2000) });
    for (let i = 0; i < G.length; i += 2000) await api("/api/pons/ingest", { graduations: G.slice(i, i + 2000) });
    await api("/api/pons/ingest", { scanned_to: head });
    launches = L.length;
    graduations = G.length;
  }

  // creators that just crossed 20 launches: a wallet, or a shared launcher contract?
  const state = await api<{ sample_at: number; unchecked_busy_creators: string[] }>("/api/pons/state");
  const creators: Record<string, boolean> = {};
  for (let i = 0; i < state.unchecked_busy_creators.length; i += 20) {
    const part = state.unchecked_busy_creators.slice(i, i + 20);
    const j = await post<{ id: number; result?: string }[]>(part.map((a, id) => ({ jsonrpc: "2.0", id, method: "eth_getCode", params: [a, "latest"] })));
    if (Array.isArray(j)) for (const r of j) if (r.result !== undefined) creators[part[r.id]] = r.result !== "0x";
  }
  if (Object.keys(creators).length) await api("/api/pons/ingest", { creators });

  // once a day: how much ETH a random sample of curves holds
  let sampled = 0;
  if (Date.now() / 1000 - (state.sample_at || 0) > 20 * 3600) {
    const rows = await api<{ t: string; c: string; g: number }[]>(`/api/pons/sample?n=${SAMPLE}`);
    const eth: Record<string, number> = {};
    for (let i = 0; i < rows.length; i += 25) {
      const part = rows.slice(i, i + 25);
      const j = await post<{ id: number; result?: string }[]>(part.map((x, id) => ({ jsonrpc: "2.0", id, method: "eth_getBalance", params: [x.c, "latest"] })));
      if (Array.isArray(j)) for (const r of j) if (r.result !== undefined) eth[part[r.id].t] = Number(BigInt(r.result)) / 1e18;
    }
    const got = rows.filter((x) => x.t in eth);
    const live = got.filter((x) => !x.g);
    if (got.length >= SAMPLE / 2) {
      await api("/api/pons/ingest", {
        sample: {
          at: Math.floor(Date.now() / 1000),
          size: got.length,
          graduated: got.filter((x) => x.g).length,
          under_0_01: live.filter((x) => eth[x.t] < 0.01).length,
          under_0_1: live.filter((x) => eth[x.t] < 0.1).length,
        },
      });
      sampled = got.length;
    }
  }

  const r = await api<{ launches: number }>("/api/pons/recompute", {});
  return { head, launches, graduations, creators_checked: Object.keys(creators).length, sampled, stored: r.launches };
}
