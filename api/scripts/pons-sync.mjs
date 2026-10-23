// Keeps coreum.xyz/pons current: reads new Pons launches and graduations from
// Robinhood Chain and sends them to the Worker, which stores every launch and
// works out the numbers. Runs hourly from .github/workflows/anchor.yml.
//
//   COREUM_SECRET=… node api/scripts/pons-sync.mjs
//   COREUM_SECRET=… node api/scripts/pons-sync.mjs --seed <dir>   # first load from pons-census.mjs output
//
// env: COREUM_SECRET (admin key, required), COREUM_API (default https://www.coreum.xyz)

import fs from 'node:fs';
import path from 'node:path';

const RPC = process.env.RPC_URL || 'https://rpc.mainnet.chain.robinhood.com';
const API = (process.env.COREUM_API || 'https://www.coreum.xyz').replace(/\/$/, '');
const KEY = process.env.COREUM_SECRET;
const FACTORY = '0x7ed598bcef8bd9edd8c97a195c6d13f40801ec7e';
const CREATED = '0x8d4aad4953d0ca700d468f3753aa14432d1b35b43ec6409f051fb6aa43a89607';
const GRADUATED = '0xcdb72f157fd3666758a6ce201387ffb52038c7562e4fff352828da1096c4b6b4';
const FIRST_BLOCK = 27_027_321;
const SAMPLE = 2000; // curve balances read once a day
const seedIdx = process.argv.indexOf('--seed');
const SEED = seedIdx > 0 ? process.argv[seedIdx + 1] : null;

const summary = (s) => {
  console.log(s);
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, s + '\n');
};
if (!KEY) { summary('COREUM_SECRET is not set — skipping the Pons sync.'); process.exit(process.env.CI ? 1 : 0); }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function post(body, tries = 6) {
  await sleep(700); // the public RPC rate-limits bursts
  const r = await fetch(RPC, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).catch(() => null);
  const t = r ? await r.text() : '';
  if (t.startsWith('{') || t.startsWith('[')) {
    const j = JSON.parse(t);
    if (Array.isArray(j) || !j.error || !/too many|rate/i.test(j.error.message || '') || !tries) return j;
  } else if (!tries) throw new Error('RPC unavailable: ' + (r?.status ?? 'no response'));
  await sleep(4000 * (7 - tries));
  return post(body, tries - 1);
}
const rpc = async (method, params) => {
  const j = await post({ jsonrpc: '2.0', id: 1, method, params });
  if (j.error) throw new Error(j.error.message);
  return j.result;
};
const hex = (n) => '0x' + n.toString(16);

async function api(p, body) {
  const r = await fetch(API + p, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', 'x-coreum-admin': KEY },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`${p}: HTTP ${r.status} ${j.error || ''}`);
  return j;
}

// logs over [from, to], splitting any range the RPC says is too big
async function logs(topic, from, to) {
  const out = [];
  let span = 2_000_000;
  for (let a = from; a <= to; ) {
    const b = Math.min(to, a + span - 1);
    const j = await post({ jsonrpc: '2.0', id: 1, method: 'eth_getLogs', params: [{ address: FACTORY, topics: [topic], fromBlock: hex(a), toBlock: hex(b) }] });
    if (j.error) {
      if (!/exceed|limit|range/i.test(j.error.message)) throw new Error(j.error.message);
      span = Math.max(1000, Math.floor(span / 3));
      continue;
    }
    out.push(...j.result);
    a = b + 1;
    if (j.result.length < 3000) span = Math.min(span * 2, 9_999_000);
  }
  return out;
}

// block → unix time by linear interpolation between sampled blocks
function clock(points) {
  const pts = [...points].sort((x, y) => x[0] - y[0]);
  return (n) => {
    let i = pts.findIndex(([b]) => b >= n);
    if (i <= 0) i = 1;
    if (i >= pts.length) i = pts.length - 1;
    const [b0, t0] = pts[i - 1], [b1, t1] = pts[i];
    return Math.round(t0 + ((n - b0) * (t1 - t0)) / (b1 - b0 || 1));
  };
}
const blockTime = async (n) => [n, parseInt((await rpc('eth_getBlockByNumber', [hex(n), false])).timestamp, 16)];

async function send(launches, graduations, extra = {}) {
  for (let i = 0; i < launches.length; i += 2000) {
    await api('/api/pons/ingest', { launches: launches.slice(i, i + 2000) });
    if (launches.length > 2000) process.stdout.write(`\rlaunches sent ${Math.min(i + 2000, launches.length)} / ${launches.length}   `);
  }
  if (launches.length > 2000) console.log();
  for (let i = 0; i < graduations.length; i += 2000) await api('/api/pons/ingest', { graduations: graduations.slice(i, i + 2000) });
  if (Object.keys(extra).length) await api('/api/pons/ingest', extra);
}

const st = await api('/api/pons/state');
const head = parseInt(await rpc('eth_blockNumber', []), 16);
let launches = [], graduations = [];

if (SEED) {
  // first load: reuse a full pons-census.mjs run instead of rescanning months of blocks
  const read = (f) => JSON.parse(fs.readFileSync(path.join(SEED, f), 'utf8'));
  const seedHead = read('head.json');
  const at = clock(read('times.json'));
  launches = read('created.json').map((x) => ({ t: x.t, c: x.c, d: x.d, b: x.b, ts: at(x.b) }));
  graduations = Object.entries(read('graduated.json')).map(([t, b]) => ({ t, ts: at(b) }));
  await send(launches, graduations, { scanned_to: seedHead });
  console.log(`seeded ${launches.length} launches, ${graduations.length} graduations up to block ${seedHead}`);
  st.scanned_to = seedHead;
  launches = []; graduations = [];
}

const from = (st.scanned_to || FIRST_BLOCK - 1) + 1;
if (from <= head) {
  const at = clock([await blockTime(from), await blockTime(head)]);
  launches = (await logs(CREATED, from, head)).map((l) => {
    const b = parseInt(l.blockNumber, 16);
    return { t: '0x' + l.topics[1].slice(26), c: '0x' + l.topics[2].slice(26), d: '0x' + l.topics[3].slice(26), b, ts: at(b) };
  });
  graduations = (await logs(GRADUATED, from, head)).map((l) => ({ t: '0x' + l.topics[1].slice(26), ts: at(parseInt(l.blockNumber, 16)) }));
  await send(launches, graduations, { scanned_to: head });
}

// creators that just crossed 20 launches: a wallet, or a shared launcher contract?
const state = await api('/api/pons/state');
const creators = {};
for (let i = 0; i < state.unchecked_busy_creators.length; i += 20) {
  const part = state.unchecked_busy_creators.slice(i, i + 20);
  const j = await post(part.map((a, k) => ({ jsonrpc: '2.0', id: k, method: 'eth_getCode', params: [a, 'latest'] })));
  if (Array.isArray(j)) for (const r of j) if (r.result !== undefined) creators[part[r.id]] = r.result !== '0x';
}
if (Object.keys(creators).length) await api('/api/pons/ingest', { creators });

// once a day: how much ETH a random sample of curves holds
let sampled = '';
if (Date.now() / 1000 - (state.sample_at || 0) > 20 * 3600) {
  const rows = await api(`/api/pons/sample?n=${SAMPLE}`);
  const eth = {};
  for (let i = 0; i < rows.length; i += 20) {
    const part = rows.slice(i, i + 20);
    const j = await post(part.map((x, k) => ({ jsonrpc: '2.0', id: k, method: 'eth_getBalance', params: [x.c, 'latest'] })));
    if (Array.isArray(j)) for (const r of j) if (r.result !== undefined) eth[part[r.id].t] = Number(BigInt(r.result)) / 1e18;
  }
  const got = rows.filter((x) => x.t in eth);
  const live = got.filter((x) => !x.g);
  const under = (v) => live.filter((x) => eth[x.t] < v).length;
  const sample = {
    at: Math.floor(Date.now() / 1000),
    size: got.length,
    graduated: got.filter((x) => x.g).length,
    under_0_01: under(0.01),
    under_0_1: under(0.1),
  };
  if (sample.size >= SAMPLE / 2) { // a thin sample (RPC trouble) waits for the next run
    await api('/api/pons/ingest', { sample });
    sampled = ` · curve sample ${sample.size} (${sample.under_0_01} under 0.01 ETH)`;
  }
}

const r = await api('/api/pons/recompute', {});
summary(`Pons sync: +${launches.length} launches, +${graduations.length} graduations to block ${head} · ${r.launches} launches stored${sampled}`);
