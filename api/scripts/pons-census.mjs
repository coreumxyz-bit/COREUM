// Pons census: every token ever launched through the Pons launchpad on
// Robinhood Chain, read straight from the chain — no indexer, no API key.
//
//   node api/scripts/pons-census.mjs [out-dir]
//
// 1. TokenCreated(token, curve, creator) logs from the Pons factory
// 2. Graduated logs (the curve hit its 4.2 ETH target and moved to a DEX)
// 3. the ETH a bonding curve holds right now (batched eth_getBalance), for a
//    seeded random sample of SAMPLE launches older than two days — the public
//    RPC is too slow to read all of them; launches and graduations are counted in full
// 4. whether each busy creator (20+ launches) is a wallet or a contract (a shared launcher)
// Progress is cached in out-dir, so a rerun resumes. Prints the summary and
// writes census.json with every token.

import fs from 'node:fs';
import path from 'node:path';

const RPC = 'https://rpc.mainnet.chain.robinhood.com';
const FACTORY = '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
const CREATED = '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607';
const GRADUATED = '0xcdb72f157fd3666758a6ce201387ffb52038c7562e4fff352828da1096c4b6b4';
const FIRST_BLOCK = 27_027_321; // the factory's first launch, 2026-08-03
const OUT = process.argv[2] || 'pons-census';
const SAMPLE = Number(process.env.SAMPLE || 5000);
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0;
async function post(body, tries = 6) {
  await sleep(700); // the public RPC rate-limits bursts
  calls++;
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  const t = r ? await r.text() : '';
  if (t.startsWith('{') || t.startsWith('[')) {
    const j = JSON.parse(t);
    const err = Array.isArray(j) ? null : j.error;
    if (!err) return j;
    if (!/too many|rate/i.test(err.message || '') || !tries) return j; // a real error: let the caller decide
  } else if (!tries) throw new Error('RPC unavailable: ' + (r?.status ?? 'no response'));
  await sleep(4000 * (7 - tries));
  return post(body, tries - 1);
}
const rpc = async (method, params) => {
  const j = await post({ jsonrpc: '2.0', id: 1, method, params });
  if (j.error) throw Object.assign(new Error(j.error.message), { rpc: j.error });
  return j.result;
};
const hex = (n) => '0x' + n.toString(16);
const cache = (name, fn) => async () => {
  const f = path.join(OUT, name);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, 'utf8'));
  const v = await fn();
  fs.writeFileSync(f, JSON.stringify(v));
  return v;
};

// logs over [from, to], splitting any range the RPC says is too big
async function logs(filter, from, to, onChunk) {
  let span = 2_000_000;
  for (let a = from; a <= to; ) {
    const b = Math.min(to, a + span - 1);
    try {
      const got = await rpc('eth_getLogs', [{ ...filter, fromBlock: hex(a), toBlock: hex(b) }]);
      onChunk(got, a, b);
      a = b + 1;
      if (got.length < 3000) span = Math.min(span * 2, 9_999_000);
    } catch (e) {
      if (!/exceed|limit|too many|range/i.test(e.message)) throw e;
      span = Math.max(1000, Math.floor(span / 3));
    }
  }
}

const head = await cache('head.json', async () => parseInt(await rpc('eth_blockNumber', []), 16))();
console.log('head block', head);

const created = await cache('created.json', async () => {
  const out = [];
  await logs({ address: FACTORY, topics: [CREATED] }, FIRST_BLOCK, head, (got, a, b) => {
    for (const l of got) out.push({ t: '0x' + l.topics[1].slice(26), c: '0x' + l.topics[2].slice(26), d: '0x' + l.topics[3].slice(26), b: parseInt(l.blockNumber, 16) });
    process.stdout.write(`\rlaunches ${out.length} · block ${b} / ${head}   `);
  });
  console.log();
  return out;
})();
console.log('launches', created.length);

const graduated = await cache('graduated.json', async () => {
  const out = {};
  await logs({ address: FACTORY, topics: [GRADUATED] }, FIRST_BLOCK, head, (got) => {
    for (const l of got) out['0x' + l.topics[1].slice(26)] = parseInt(l.blockNumber, 16);
  });
  return out;
})();
console.log('graduated', Object.keys(graduated).length);

// block → time, from a handful of sampled blocks (the chain's block time drifts a little)
const times = await cache('times.json', async () => {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const n = Math.round(FIRST_BLOCK + ((head - FIRST_BLOCK) * i) / 12);
    pts.push([n, parseInt((await rpc('eth_getBlockByNumber', [hex(n), false])).timestamp, 16)]);
  }
  return pts;
})();
const timeOf = (n) => {
  let i = times.findIndex(([b]) => b >= n);
  if (i <= 0) i = 1;
  const [b0, t0] = times[i - 1], [b1, t1] = times[i];
  return Math.round(t0 + ((n - b0) * (t1 - t0)) / (b1 - b0));
};

// one call per item, 20 per batch
async function batched(name, items, call, parse) {
  const f = path.join(OUT, name);
  const done = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
  const todo = items.filter((x) => !(x in done));
  for (let i = 0; i < todo.length; i += 20) {
    const part = todo.slice(i, i + 20);
    const j = await post(part.map((x, k) => ({ jsonrpc: '2.0', id: k, ...call(x) })));
    if (Array.isArray(j)) for (const r of j) if (r.result !== undefined) done[part[r.id]] = parse(r.result);
    if (i % 400 === 0) fs.writeFileSync(f, JSON.stringify(done));
    process.stdout.write(`\r${name} ${Object.keys(done).length} / ${items.length}   `);
  }
  fs.writeFileSync(f, JSON.stringify(done));
  console.log();
  return done;
}
// a seeded shuffle, so anyone rerunning this gets the same sample
let seed = 42;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const nowT = timeOf(head);
const eligible = created.filter((x) => nowT - timeOf(x.b) > 2 * 86400);
for (let i = eligible.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [eligible[i], eligible[j]] = [eligible[j], eligible[i]]; }
const sample = eligible.slice(0, SAMPLE);
const curveEth = await batched('curve-eth.json', sample.map((x) => x.c), (c) => ({ method: 'eth_getBalance', params: [c, 'latest'] }), (h) => Number(BigInt(h)) / 1e18);
const counts = {};
for (const x of created) counts[x.d] = (counts[x.d] || 0) + 1;
const busy = Object.keys(counts).filter((a) => counts[a] >= 20);
const isContract = await batched('creator-code.json', busy, (a) => ({ method: 'eth_getCode', params: [a, 'latest'] }), (h) => h !== '0x');

// ---- summary ----
const now = nowT;
const DAY = 86400;
const pct = (a, b) => ((100 * a) / b).toFixed(1) + '%';
const gradTimes = created.filter((x) => x.t in graduated).map((x) => (timeOf(graduated[x.t]) - timeOf(x.b)) / 3600).sort((a, b) => a - b);
const sampled = sample.map((x) => ({ ...x, eth: curveEth[x.c], grad: x.t in graduated })).filter((x) => x.eth != null);
const sampledLive = sampled.filter((x) => !x.grad);
const under = (v) => sampledLive.filter((x) => x.eth < v).length;
const serialWallets = busy.filter((a) => isContract[a] === false);
const launchers = busy.filter((a) => isContract[a] === true);
const perDay = {};
for (const x of created) { const d = new Date(timeOf(x.b) * 1000).toISOString().slice(0, 10); perDay[d] = (perDay[d] || 0) + 1; }
const days = Object.values(perDay);

const summary = {
  as_of: new Date(now * 1000).toISOString(),
  head_block: head,
  launches: created.length,
  first_launch: new Date(timeOf(created[0].b) * 1000).toISOString(),
  launches_per_day_avg: Math.round(created.length / ((now - timeOf(created[0].b)) / DAY)),
  busiest_day: Object.entries(perDay).sort((a, b) => b[1] - a[1])[0],
  graduated: gradTimes.length,
  graduated_pct: pct(gradTimes.length, created.length),
  graduation_hours_median: gradTimes.length ? +gradTimes[Math.floor(gradTimes.length / 2)].toFixed(1) : null,
  creators: Object.keys(counts).length,
  creators_one_launch: Object.values(counts).filter((n) => n === 1).length,
  creators_20plus: busy.length,
  serial_wallets_20plus: serialWallets.length,
  launches_by_serial_wallets: serialWallets.reduce((s, a) => s + counts[a], 0),
  top_serial_wallet_launches: Math.max(0, ...serialWallets.map((a) => counts[a])),
  shared_launcher_contracts: launchers.length,
  launches_via_shared_launchers: launchers.reduce((s, a) => s + counts[a], 0),
  sample: { size: sampled.length, of_launches_older_than_2_days: eligible.length, seed: 42 },
  sample_graduated_pct: pct(sampled.filter((x) => x.grad).length, sampled.length),
  sample_not_graduated_curve_under_0_01_eth_pct: pct(under(0.01), sampled.length),
  sample_not_graduated_curve_under_0_1_eth_pct: pct(under(0.1), sampled.length),
  sample_not_graduated_curve_under_1_eth_pct: pct(under(1), sampled.length),
  rpc_calls: calls,
};
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
console.log(summary);
