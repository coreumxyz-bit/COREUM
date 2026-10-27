import { verifyMessage } from 'ethers';
import { makeVerify } from './verify.js';
import { makeWatch } from './watch.js';
import { makeDeployer } from './deployer.js';
import { makePons } from './pons.js';
import { makeCors, HOLDER_PER_DAY as CORS_HOLDER_PER_DAY } from './cors.js';
import { makeChat, CHAT_HOLDER_PER_DAY } from './chat.js';

const SYMS = {
  BTC: 'BTC-USD', ETH: 'ETH-USD', SOL: 'SOL-USD', DOGE: 'DOGE-USD', LINK: 'LINK-USD',
  TSLA: 0, NVDA: 0, AAPL: 0
};
const CRY = [
  ['BTC', 'BTC-USD'], ['ETH', 'ETH-USD'], ['SOL', 'SOL-USD'],
  ['DOGE', 'DOGE-USD'], ['LINK', 'LINK-USD']
];
const STK = ['TSLA', 'NVDA', 'AAPL'];
const HZ = [5, 15, 60, 240, 1440];
const ALL = Object.keys(SYMS).join(',');
const SEED = [
  ['Macro Hive', 'macro-hive', 'momentum', ALL, .12, 'Reads liquidity cycles, funding rates and index flows. Posts calm macro theses with one ticker call per day.'],
  ['Meme Sniper', 'meme-sniper', 'breakout', ALL, .14, 'Tracks social velocity on tokenized markets. Strikes fast, admits losses loudly, never averages down.'],
  ['Earnings Oracle', 'earnings-oracle', 'meanrev', 'BTC,ETH', .1, 'Mean-reversion specialist. Fades exhaustion moves on majors when momentum stats get stretched.'],
  ['Liquidity Ghost', 'liquidity-ghost', 'meanrev', 'SOL,DOGE,LINK', .1, 'Watches order-book imbalances and thin liquidity on the alt pairs. Silent most of the day, then pounces.'],
  ['Wall Street Owl', 'wall-street-owl', 'momentum', 'TSLA,NVDA,AAPL', .12, 'Trades tokenized US stocks during market hours only. Respects the closing bell.']
];
const LINE = {
  momentum: 'Momentum structure intact — trend continuation.',
  meanrev: 'Stats stretched to the extreme — fading the move.',
  breakout: 'Price cleared the 30-minute range — breakout on.'
};
const CORS_ADDR = '0x3a2ec7aeb4b3c3d6ae9ff6f390bc9da05a8cb945';
const BURN_ADDR = '0x000000000000000000000000000000000000dEaD';
const TRANSFER_TOPIC = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';

const cip = (req, env) =>
  (env.SHARED_SECRET &&
    req.headers.get('x-coreum-secret') === env.SHARED_SECRET &&
    req.headers.get('x-client-ip')) ||
  req.headers.get('cf-connecting-ip') || '';

const J = (o, s = 200) =>
  new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

const sha = async s =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))]
    .map(b => b.toString(16).padStart(2, '0')).join('');

const now = () => Math.floor(Date.now() / 1000);
const Z = '0'.repeat(64);

async function append(db, type, obj) {
  const data = JSON.stringify(obj);
  for (let k = 0; k < 6; k++) {
    const h = await db.prepare('SELECT i,hash FROM ledger ORDER BY i DESC LIMIT 1').first();
    const i = h ? h.i + 1 : 0;
    const prev = h ? h.hash : Z;
    const hash = await sha(prev + '|' + type + '|' + data);
    try {
      await db.prepare('INSERT INTO ledger(i,ts,type,prev,data,hash) VALUES(?,?,?,?,?,?)')
        .bind(i, now(), type, prev, data, hash).run();
      return hash;
    } catch (e) {
      console.error('append failed (i=' + i + ' type=' + type + '):', e.message);
    }
  }
  throw new Error('ledger busy, retry');
}

const V = makeVerify({ append, sha, now });
const W = makeWatch({ sha, now });
const D = makeDeployer({ now });
const PONS = makePons({ now });
const CORS = makeCors({ sha, now });
const CHAT = makeChat({ V, now, sha });

const last = (db, s) =>
  db.prepare('SELECT p,t FROM prices WHERE sym=? ORDER BY t DESC LIMIT 1').bind(s).first();

const hist = async (db, s, n) =>
  (await db.prepare('SELECT p FROM prices WHERE sym=? ORDER BY t DESC LIMIT ?').bind(s, n).all())
    .results.map(x => x.p).reverse();

function mkt() {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false
    }).formatToParts(new Date()).map(x => [x.type, x.value])
  );
  const m = (+p.hour % 24) * 60 + (+p.minute);
  return { open: !['Sat', 'Sun'].includes(p.weekday) && m >= 570 && m < 960, toClose: 960 - m };
}

async function yq(s) {
  return (await (await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${s}?interval=1m&range=1d`,
    { headers: { 'user-agent': 'Mozilla/5.0' } }
  )).json()).chart.result[0];
}

async function pull(db) {
  const t = now() - now() % 60, st = [];
  const ins = (s, p) => db.prepare('INSERT OR REPLACE INTO prices VALUES(?,?,?)').bind(t, s, p);
  await Promise.all(CRY.map(async ([s, p]) => {
    try {
      const j = await (await fetch(`https://api.coinbase.com/v2/prices/${p}/spot`)).json();
      st.push(ins(s, +j.data.amount));
    } catch (e) {}
  }));
  if (mkt().open) await Promise.all(STK.map(async s => {
    try {
      const m = (await yq(s)).meta;
      if (now() - m.regularMarketTime < 180) st.push(ins(s, m.regularMarketPrice));
    } catch (e) {}
  }));
  if (st.length) await db.batch(st);
}

async function backfill(db) {
  for (const s of Object.keys(SYMS)) {
    const l = await db.prepare('SELECT t FROM prices WHERE sym=? ORDER BY t DESC LIMIT 1').bind(s).first();
    if (l && now() - l.t < 600) continue;
    let rows = [];
    try {
      if (SYMS[s]) {
        const c = await (await fetch(
          `https://api.exchange.coinbase.com/products/${SYMS[s]}/candles?granularity=60`,
          { headers: { 'user-agent': 'coreum' } }
        )).json();
        rows = c.map(x => [x[0], x[4]]);
      } else {
        const r = await yq(s), cl = r.indicators.quote[0].close;
        rows = r.timestamp.map((t, i) => [t, cl[i]]).filter(x => x[1] != null);
      }
      // Only write candles NEWER than what we already have — otherwise closed
      // markets (weekends, holidays) re-write the same 1440 rows every minute
      // and burn the D1 daily write limit in minutes.
      const upto = l ? l.t : 0;
      rows = rows.filter(x => x[0] > upto);
      if (!rows.length) continue;
      for (let i = 0; i < rows.length; i += 80)
        await db.batch(rows.slice(i, i + 80).map(x =>
          db.prepare('INSERT OR REPLACE INTO prices VALUES(?,?,?)').bind(x[0], s, x[1])));
    } catch (e) {}
  }
}

async function anchor(env) {
  const db = env.DB;
  const h = await db.prepare('SELECT i,hash FROM ledger ORDER BY i DESC LIMIT 1').first();
  if (!h) return;
  const la = await db.prepare('SELECT ts,head_i FROM anchors ORDER BY id DESC LIMIT 1').first();
  if (la && (now() - la.ts < 86400 || la.head_i == h.i)) return;
  const dg = Uint8Array.from(h.hash.match(/../g).map(x => parseInt(x, 16)));
  try {
    const r = await fetch('https://alice.btc.calendar.opentimestamps.org/digest', {
      method: 'POST', body: dg,
      headers: { accept: 'application/vnd.opentimestamps.v1', 'user-agent': 'coreum' }
    });
    if (r.ok) {
      const f = new Uint8Array(await r.arrayBuffer());
      const hd = [...'\0OpenTimestamps\0\0Proof\0'].map(c => c.charCodeAt(0)).concat([191, 137, 226, 232, 132, 232, 146, 148, 1, 8]);
      const o = new Uint8Array(hd.length + 32 + f.length);
      o.set(hd); o.set(dg, hd.length); o.set(f, hd.length + 32);
      await db.prepare("INSERT INTO anchors(ts,head_i,head_hash,kind,proof) VALUES(?,?,?,'ots',?)")
        .bind(now(), h.i, h.hash, btoa(String.fromCharCode(...o))).run();
    }
  } catch (e) {}
  if (env.RPC_URL && env.ANCHOR_KEY && env.ANCHOR_ADDR) {
    try {
      const { JsonRpcProvider, Wallet, Contract } = await import('ethers');
      const w = new Wallet(env.ANCHOR_KEY, new JsonRpcProvider(env.RPC_URL));
      const tx = await new Contract(env.ANCHOR_ADDR, ['function anchor(bytes32 head,uint256 blocks)'], w)
        .anchor('0x' + h.hash, h.i + 1);
      await db.prepare("INSERT INTO anchors(ts,head_i,head_hash,kind,proof) VALUES(?,?,?,'evm',?)")
        .bind(now(), h.i, h.hash, tx.hash).run();
    } catch (e) {}
  }
}

function signal(st, ps) {
  const n = ps.length;
  if (n < 61) return null;
  let q = 0;
  for (let i = 1; i < n; i++) q += Math.log(ps[i] / ps[i - 1]) ** 2;
  const sd = Math.sqrt(q / (n - 1)) || 1e-4;
  const cl = x => Math.round(Math.max(52, Math.min(90, x)));
  const z = k => Math.log(ps[n - 1] / ps[n - 1 - k]) / (sd * Math.sqrt(k));
  if (st === 'momentum') {
    const v = z(15);
    return Math.abs(v) < .5 ? null : { dir: v > 0 ? 1 : -1, conf: cl(54 + Math.abs(v) * 8) };
  }
  if (st === 'meanrev') {
    const v = z(5);
    return Math.abs(v) < 1.5 ? null : { dir: v > 0 ? -1 : 1, conf: cl(54 + Math.abs(v) * 6) };
  }
  if (st === 'breakout') {
    const w = ps.slice(n - 31, n - 1), a = Math.max(...w), b = Math.min(...w);
    return ps[n - 1] > a ? { dir: 1, conf: 68 } : ps[n - 1] < b ? { dir: -1, conf: 68 } : null;
  }
  return null;
}

/**
 * AI note for a signal. Order: Raeto (OpenAI-compatible, RAETO_API_KEY
 * secret) → pollinations (free) → strategy template. Never throws.
 */
async function aiNote(env, sym, dir, conf, strat, px) {
  const p = `You are an AI trading analyst node in the Coreum network. ${sym} trades at ${px}. Your ${strat} strategy signals ${dir > 0 ? 'UP' : 'DOWN'} with ${conf}% confidence over the next hour. Write exactly one sentence, max 25 words, explaining the call. No greetings, no hashtags, no disclaimers.`;
  const clean = t => {
    const s = String(t || '').trim().replace(/\s+/g, ' ').slice(0, 280);
    return s.length > 20 ? s : null;
  };
  if (env.RAETO_API_KEY) {
    try {
      const r = await fetch('https://api.raeto.cc/v1/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.RAETO_API_KEY },
        body: JSON.stringify({
          model: env.LLM_MODEL || 'openai/gpt-4o-mini',
          max_tokens: 60,
          messages: [{ role: 'user', content: p }]
        }),
        signal: AbortSignal.timeout(9000)
      });
      if (r.ok) {
        const t = clean((await r.json())?.choices?.[0]?.message?.content);
        if (t) return t;
      } else console.error('raeto http ' + r.status);
    } catch (e) { console.error('raeto: ' + e.message); }
  }
  try {
    const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent(p), {
      signal: AbortSignal.timeout(8000)
    });
    if (r.ok) { const t = clean(await r.text()); if (t) return t; }
  } catch (e) {}
  return `CALL — ${sym} ${dir > 0 ? 'higher' : 'lower'}. ${LINE[strat]} Confidence ${conf}%.`;
}

async function place(db, a, sym, dir, conf, min, note, re) {
  const l = await last(db, sym);
  if (!l || now() - l.t > 300) return 'price feed for ' + sym + ' is not fresh';
  if (STK.includes(sym)) {
    const m = mkt();
    if (!m.open) return 'US market is closed';
    if (min > m.toClose) return 'deadline is after the close (' + m.toClose + ' min left)';
  }
  if (re && !(await db.prepare('SELECT 1 FROM preds WHERE id=?').bind(re).first()))
    return 'reply_to call not found';
  if (await db.prepare("SELECT 1 FROM preds WHERE agent=? AND sym=? AND st='open'").bind(a.id, sym).first())
    return 'already have an open call on ' + sym;
  const t = now(), dl = t + min * 60;
  const r = await db.prepare(
    'INSERT INTO preds(agent,sym,dir,conf,t0,p0,dl,note,reply_to) VALUES(?,?,?,?,?,?,?,?,?) RETURNING id'
  ).bind(a.id, sym, dir, conf, t, l.p, dl, note, re || null).first();
  const h = await append(db, 'pred', { pid: r.id, a: a.id, sym, dir, conf, t0: t, p0: l.p, dl, note, re: re || null });
  await db.prepare('UPDATE preds SET h=? WHERE id=?').bind(h, r.id).run();
  return { id: r.id, hash: h, p0: l.p, deadline: dl };
}

async function settleAll(db) {
  const rows = (await db.prepare("SELECT * FROM preds WHERE st='open' AND dl<=?").bind(now()).all()).results;
  for (const p of rows) {
    // price at the deadline — first candle at/after dl, so delayed settlement
    // (e.g. after an outage) still uses the price that was live at the deadline
    const l = await db.prepare('SELECT p,t FROM prices WHERE sym=? AND t>=? ORDER BY t LIMIT 1')
      .bind(p.sym, p.dl).first();
    if (!l) continue;
    const hit = p.dir * (l.p - p.p0) > 0 ? 1 : 0;
    const h = await append(db, 'settle', { pid: p.id, p1: l.p, hit });
    await db.prepare('UPDATE preds SET st=?,p1=?,sh=? WHERE id=?')
      .bind(hit ? 'hit' : 'miss', l.p, h, p.id).run();
  }
}

async function runBots(db, env) {
  if (!(await db.prepare('SELECT 1 FROM agents').first()))
    for (const s of SEED)
      await db.prepare(
        "INSERT INTO agents(id,name,handle,persona,kind,strat,focus,rate,created,cors_paid,cors_staked,cors_earned) VALUES(?,?,?,?,'hosted',?,?,?,?,0,0,0)"
      ).bind(crypto.randomUUID().slice(0, 8), s[0], s[1], s[5], s[2], s[3], s[4], now()).run();
  const m = mkt();
  for (const a of (await db.prepare("SELECT * FROM agents WHERE kind='hosted'").all()).results) {
    if (Math.random() > a.rate) continue;
    const f = a.focus.split(','), s = f[Math.random() * f.length | 0];
    if (STK.includes(s) && !m.open) continue;
    const g = signal(a.strat, await hist(db, s, 120));
    if (!g) continue;
    const hz = [15, 60].filter(x => !STK.includes(s) || x <= m.toClose);
    if (!hz.length) continue;
    const o = await db.prepare(
      "SELECT id FROM preds WHERE sym=? AND st='open' AND dir=? AND agent!=? ORDER BY id DESC LIMIT 1"
    ).bind(s, -g.dir, a.id).first();
    const mn = hz[Math.random() * hz.length | 0];
    const px = (await last(db, s))?.p;
    const note = await aiNote(env, s, g.dir, g.conf, a.strat, px);
    await place(db, a, s, g.dir, g.conf, mn, note, o && o.id);
  }
}

async function corsRewards(db) {
  try {
    const rows = (await db.prepare(
      "SELECT p.agent, COUNT(*) n, SUM(p.st='hit') h FROM preds p WHERE p.st!='open' AND p.agent NOT IN (SELECT agent FROM cors_rewards) GROUP BY p.agent"
    ).all()).results;
    for (const r of rows) {
      const a = await db.prepare('SELECT id FROM agents WHERE id=?').bind(r.agent).first();
      if (!a) continue;
      const reward = r.h * 0.1;
      if (reward > 0) {
        await db.prepare('INSERT INTO cors_rewards(agent,amount,ts) VALUES(?,?,?)')
          .bind(r.agent, reward, now()).run();
        await db.prepare('UPDATE agents SET cors_earned=cors_earned+? WHERE id=?')
          .bind(reward, r.agent).run();
        await append(db, 'cors_reward', { agent: r.agent, amount: reward, ts: now() });
      }
    }
  } catch (e) {}
}

async function buybackBurn(db) {
  try {
    const totalPaid = (await db.prepare('SELECT COALESCE(SUM(amount),0) s FROM cors_payments WHERE verified=1').first())?.s || 0;
    const totalBurned = (await db.prepare('SELECT COALESCE(SUM(amount),0) s FROM cors_burns').first())?.s || 0;
    const burnAmount = (totalPaid - totalBurned) * 0.05;
    if (burnAmount > 0.01) {
      await db.prepare('INSERT INTO cors_burns(amount,ts) VALUES(?,?)')
        .bind(burnAmount, now()).run();
      await append(db, 'cors_burn', { amount: burnAmount, ts: now() });
    }
  } catch (e) {}
}

// ---- daily digest → Telegram / X -------------------------------------------------
// At 00:03–00:30 UTC the completed day's digest is built once (idempotent,
// one row per date in daily_posts) and pushed to whichever channels have
// secrets configured. Without secrets the row is still written with
// "skipped: …" statuses — the record exists, delivery honestly doesn't.

const pctEnc = s => encodeURIComponent(s).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());

async function hmacSha1(key, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key),
    { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  return btoa(String.fromCharCode(...new Uint8Array(
    await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)))));
}

async function digestRange(db, from, to, title) {
  const rows = (await db.prepare(
    `SELECT p.sym,p.dir,p.conf,p.p0,p.p1,p.st,g.name aname FROM preds p
     JOIN agents g ON g.id=p.agent WHERE p.st!='open' AND p.dl>=? AND p.dl<?
     ORDER BY p.dl DESC LIMIT 100`
  ).bind(from, to).all()).results;
  const head = await db.prepare('SELECT i,hash FROM ledger ORDER BY i DESC LIMIT 1').first();
  const n = rows.length, h = rows.filter(r => r.st === 'hit').length;
  const acc = n ? ((h / n) * 100).toFixed(1) + '%' : '—';
  const sym = {};
  for (const r of rows) {
    sym[r.sym] = sym[r.sym] || [0, 0];
    sym[r.sym][0]++;
    if (r.st === 'hit') sym[r.sym][1]++;
  }
  const split = Object.entries(sym).sort((a, b) => b[1][0] - a[1][0])
    .map(([s, [a, b]]) => `${s} ${b}/${a}`).join(' · ');
  const ex = rows.slice(0, 5).map(r =>
    `  ${r.aname}: ${r.sym} ${r.dir === 1 ? '↑' : '↓'}${r.conf}% — ` +
    `${r.p0} → ${r.p1} ${r.st === 'hit' ? 'HIT' : 'MISS'}`);
  const text = [
    title,
    n ? `${n} calls settled · ${h} hit (${acc})` : 'No calls settled.',
    split || null,
    ex.length ? 'Latest calls:\n' + ex.join('\n') : null,
    head ? `chain head #${head.i} ${head.hash.slice(0, 16)}…` : null,
    'verify: https://www.coreum.xyz/ledger'
  ].filter(Boolean).join('\n');
  let short = [
    title,
    n ? `${n} settled · ${h} hit (${acc})` : 'No calls settled.',
    split || null,
    head ? `chain head #${head.i}` : null,
    'coreum.xyz/ledger'
  ].filter(Boolean).join('\n');
  if (short.length > 270) short = short.slice(0, 267) + '…';
  return { text, short };
}

async function dailyDigest(db, d) {
  const from = Date.parse(d + 'T00:00:00Z') / 1000;
  return digestRange(db, from, from + 86400, `Coreum daily — ${d} UTC`);
}

async function tgSend(env, text) {
  const tok = env.TG_BOT_TOKEN, chat = env.TG_CHAT_ID;
  if (!tok || !chat) return 'skipped: TG_BOT_TOKEN/TG_CHAT_ID not set';
  try {
    const r = await fetch(`https://api.telegram.org/bot${tok}/sendMessage`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chat, text, disable_web_page_preview: true })
    });
    const j = await r.json().catch(() => ({}));
    return r.ok && j.ok ? 'sent' : 'error: ' + (j.description || r.status);
  } catch (e) { return 'error: ' + e.message; }
}

async function xSend(env, text) {
  const ck = env.X_API_KEY, cs = env.X_API_SECRET, at = env.X_ACCESS_TOKEN, as = env.X_ACCESS_SECRET;
  if (!ck || !cs || !at || !as) return 'skipped: X API keys not set';
  try {
    const url = 'https://api.x.com/2/tweets';
    const oauth = {
      oauth_consumer_key: ck, oauth_nonce: crypto.randomUUID().replaceAll('-', ''),
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: String(Math.floor(Date.now() / 1000)),
      oauth_token: at, oauth_version: '1.0'
    };
    const paramStr = Object.entries(oauth).map(([k, v]) => `${pctEnc(k)}=${pctEnc(v)}`).sort().join('&');
    oauth.oauth_signature = await hmacSha1(`${pctEnc(cs)}&${pctEnc(as)}`,
      `POST&${pctEnc(url)}&${pctEnc(paramStr)}`);
    const hdr = 'OAuth ' + Object.entries(oauth)
      .map(([k, v]) => `${pctEnc(k)}="${pctEnc(v)}"`).sort().join(', ');
    const r = await fetch(url, {
      method: 'POST',
      headers: { authorization: hdr, 'content-type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const j = await r.json().catch(() => ({}));
    return r.ok ? 'sent' : 'error: ' + (j.detail || j.title || r.status);
  } catch (e) { return 'error: ' + e.message; }
}

async function dailyPost(env, force) {
  const db = env.DB;
  const d = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const dt = new Date(), mins = dt.getUTCHours() * 60 + dt.getUTCMinutes();
  if (!force && !(mins >= 3 && mins < 30)) return null;
  const ex = await db.prepare('SELECT * FROM daily_posts WHERE d=?').bind(d).first();
  if (ex) return ex;
  const { text, short } = await dailyDigest(db, d);
  const tg = await tgSend(env, text);
  const x = await xSend(env, short);
  try {
    await db.prepare('INSERT INTO daily_posts(d,text,short,created,tg,x) VALUES(?,?,?,?,?,?)')
      .bind(d, text, short, now(), tg, x).run();
  } catch (e) { console.error('daily_posts insert: ' + e.message); }
  return { d, text, short, tg, x };
}

async function weeklyPost(env, force) {
  const db = env.DB;
  const dt = new Date();
  const dow = dt.getUTCDay(), mins = dt.getUTCHours() * 60 + dt.getUTCMinutes();
  if (!force && !(dow === 1 && mins >= 30 && mins < 120)) return null;
  const to = Math.floor(Date.now() / 1000), from = to - 7 * 86400;
  const k = 'week-' + new Date(from * 1000).toISOString().slice(0, 10);
  const ex = await db.prepare('SELECT * FROM weekly_posts WHERE k=?').bind(k).first();
  if (ex) return ex;
  const title = `Coreum weekly — ${k.slice(5)} → ${new Date(to * 1000).toISOString().slice(0, 10)} UTC`;
  const { text, short } = await digestRange(db, from, to, title);
  const tg = await tgSend(env, text);
  const x = await xSend(env, short);
  try {
    await db.prepare('INSERT INTO weekly_posts(k,text,short,created,tg,x) VALUES(?,?,?,?,?,?)')
      .bind(k, text, short, now(), tg, x).run();
  } catch (e) { console.error('weekly_posts insert: ' + e.message); }
  return { k, text, short, tg, x };
}

// Hourly jobs that need the public RPC run on the site (the RPC turns away
// Cloudflare egress); this cron is the reliable clock that starts them —
// GitHub's scheduled workflows were starting hours late.
const SITE_URL = 'https://www.coreum.xyz';
const SITE_HOURLY = ['/api/radar/run', '/api/watch/run', '/api/pons/sync'];
async function siteHourly(env) {
  const db = env.DB, t = now();
  const last = Number((await db.prepare("SELECT v FROM chain_state WHERE k='site_hourly'").first())?.v || 0);
  if (t - last < 3600) return;
  await db.prepare("INSERT INTO chain_state(k,v) VALUES('site_hourly',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(String(t)).run();
  const admin = env.ADMIN_SECRET || env.SHARED_SECRET;
  for (const path of SITE_HOURLY) {
    try {
      const r = await fetch(SITE_URL + path, { method: 'POST', headers: { 'x-coreum-admin': admin }, signal: AbortSignal.timeout(90000) });
      console.log('hourly ' + path + ' ' + r.status + ' ' + (await r.text()).slice(0, 300));
    } catch (e) {
      console.error('hourly ' + path + ' failed: ' + (e.message || e));
    }
  }
}

async function tick(env) {
  const db = env.DB;
  for (const [phase, fn] of [
    ['backfill', () => backfill(db)], ['pull', () => pull(db)], ['settle', () => settleAll(db)], ['plays', () => settlePlays(db)], ['verify', () => V.sweep(env)],
    ['bots', () => runBots(db, env)], ['rewards', () => corsRewards(db)],
    ['burn', () => buybackBurn(db)], ['anchor', () => anchor(env)],
    ['daily', () => dailyPost(env)], ['weekly', () => weeklyPost(env)], ['site-hourly', () => siteHourly(env)]
  ]) {
    try { await fn(); } catch (e) { console.error('tick phase ' + phase + ' failed:', e.message || e); }
  }
  if (Math.random() < .01) {
    try { await db.prepare('DELETE FROM prices WHERE t<?').bind(now() - 259200).run(); } catch (e) {}
  }
}

// Per-isolate memo: D1 bills rows read, and the same aggregates are asked for by
// every visitor and by the minute cron, so compute them once per ttl instead.
const MEMO = new Map();
async function memo(key, ttl, fn) {
  const hit = MEMO.get(key);
  if (hit && hit.exp > Date.now()) return hit.v;
  const v = await fn();
  if (MEMO.size > 300) MEMO.clear();
  MEMO.set(key, { exp: Date.now() + ttl * 1000, v });
  return v;
}

// Public GET routes served from the memo (seconds); also sent as s-maxage so the
// CDN in front of the site gateway answers repeats without reaching the Worker.
const GET_TTL = {
  '/api/state': 15, '/api/feed': 15, '/api/swarm': 15, '/api/agents': 30, '/api/arena': 30,
  '/api/stats': 120, '/api/ledger': 15, '/api/anchors': 60, '/api/holders': 120, '/api/cors': 60,
  '/api/jobs': 3, '/api/network': 5, '/api/cores': 15, '/api/cohort': 30, '/api/export': 300,
  '/api/weekly_posts': 300, '/api/daily_posts': 300, '/api/token-checks': 10, '/api/token-verdict': 10, '/api/pons': 120, '/api/pons-deployer': 120, '/api/truth-board': 30, '/api/verdicts/latest': 60, '/api/radar': 30, '/api/watch': 20,
};

const board = (db) => memo('board', 60, () => boardRaw(db));
async function boardRaw(db) {
  const ag = (await db.prepare(
    'SELECT id,name,handle,persona,created,kind,strat,focus,rate,cors_paid,cors_staked,cors_earned,(SELECT COUNT(*) FROM follows f WHERE f.agent=agents.id) followers,EXISTS(SELECT 1 FROM holders h WHERE h.addr=LOWER(agents.wallet)) holder FROM agents WHERE kind!=\'refcore\''
  ).all()).results;
  const st = Object.fromEntries(
    (await db.prepare(
      "SELECT agent a,COUNT(*) n,SUM(st='hit') h,AVG((conf/100.0-(st='hit'))*(conf/100.0-(st='hit'))) br FROM preds WHERE st!='open' GROUP BY agent"
    ).all()).results.map(r => [r.a, r])
  );
  return ag.map(a => {
    const s = st[a.id] || { n: 0, h: 0, br: .25 };
    return {
      ...a,
      n: s.n, h: s.h || 0,
      acc: s.n ? s.h / s.n : 0,
      br: s.br,
      trust: Math.max(0, (100 * (1 - 2 * s.br) * s.n + 250) / (s.n + 5))
    };
  });
}

/* ---- Beat the AI: one-tap human calls vs the swarm ---- */
const PLAY_SYMS = ['BTC', 'ETH', 'SOL'];
const PLAY_MIN = 15;

async function swarm(db, s) {
  const b = Object.fromEntries((await board(db)).map(x => [x.id, x])),
    rows = (await db.prepare(
      "SELECT p.*,g.name aname FROM preds p JOIN agents g ON g.id=p.agent WHERE p.st='open' AND p.sym=?"
    ).bind(s).all()).results.map(r => ({
      ...r,
      w: Math.max(.02, b[r.agent].trust / 100) * r.conf / 100 * (b[r.agent].n >= 5 ? 1 : .3)
    })),
    tot = rows.reduce((x, r) => x + r.w, 0),
    up = rows.filter(r => r.dir > 0).reduce((x, r) => x + r.w, 0);
  return { pct: tot ? up / tot : null, rows: rows.sort((x, y) => y.w - x.w).map(r => ({ ...r, share: r.w / tot })) };
}

async function play(db, req, env, b) {
  const secret = String(b.secret || ''), sym = String(b.sym || ''),
    dir = b.dir === 'up' ? 1 : b.dir === 'down' ? -1 : 0,
    name = String(b.name || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 24);
  if (secret.length < 16 || !PLAY_SYMS.includes(sym) || !dir || name.length < 2)
    return { e: 'need name (2-24 chars), sym (' + PLAY_SYMS.join('/') + ') and dir (up|down)', s: 400 };
  const player = await sha('player|' + secret), ip = await sha('ip' + cip(req, env)), t = now();
  if ((await db.prepare('SELECT COUNT(*) c FROM plays WHERE player=? AND t0>?').bind(player, t - 86400).first()).c >= 40)
    return { e: 'daily limit: 40 calls', s: 429 };
  if ((await db.prepare('SELECT COUNT(*) c FROM plays WHERE ip_hash=? AND t0>?').bind(ip, t - 86400).first()).c >= 120)
    return { e: 'too many calls from this network today', s: 429 };
  if (await db.prepare("SELECT 1 FROM plays WHERE player=? AND sym=? AND st='open'").bind(player, sym).first())
    return { e: 'you already have an open ' + sym + ' call', s: 400 };
  const l = await last(db, sym);
  if (!l || t - l.t > 300) return { e: 'price feed for ' + sym + ' is not fresh', s: 503 };
  const sw = await swarm(db, sym), ai = sw.pct == null ? 0 : sw.pct >= .5 ? 1 : -1, dl = t + PLAY_MIN * 60;
  const r = await db.prepare(
    'INSERT INTO plays(player,name,sym,dir,t0,p0,dl,ai,ai_pct,ip_hash) VALUES(?,?,?,?,?,?,?,?,?,?) RETURNING id'
  ).bind(player, name, sym, dir, t, l.p, dl, ai, sw.pct, ip).first();
  const h = await append(db, 'play', { id: r.id, player, name, sym, dir, t0: t, p0: l.p, dl, ai, ai_pct: sw.pct });
  await db.prepare('UPDATE plays SET h=? WHERE id=?').bind(h, r.id).run();
  return { id: r.id, player, sym, dir, t0: t, p0: l.p, dl, ai, ai_pct: sw.pct, h, st: 'open' };
}

async function settlePlays(db) {
  const rows = (await db.prepare("SELECT * FROM plays WHERE st='open' AND dl<=?").bind(now()).all()).results;
  for (const p of rows) {
    const l = await db.prepare('SELECT p,t FROM prices WHERE sym=? AND t>=? ORDER BY t LIMIT 1')
      .bind(p.sym, p.dl).first();
    if (!l) continue;
    // a flat price is a miss, same rule as node calls
    const hit = p.dir * (l.p - p.p0) > 0 ? 1 : 0;
    const h = await append(db, 'play_settle', { id: p.id, p1: l.p, hit });
    await db.prepare('UPDATE plays SET st=?,p1=?,sh=? WHERE id=?')
      .bind(hit ? 'hit' : 'miss', l.p, h, p.id).run();
  }
}

const PLAY_COLS = 'id,player,name,sym,dir,t0,p0,dl,ai,ai_pct,st,p1,h,sh';

async function arena(db) {
  const since = now() - 7 * 86400;
  const hum = await db.prepare(
    "SELECT COUNT(*) n,COALESCE(SUM(st='hit'),0) h,COUNT(DISTINCT player) players FROM plays WHERE st!='open' AND t0>?"
  ).bind(since).first();
  const bot = await db.prepare(
    "SELECT COUNT(*) n,COALESCE(SUM(st='hit'),0) h FROM preds WHERE st!='open' AND t0>?"
  ).bind(since).first();
  // human beat the swarm = right where the swarm pointed the other way
  const beat = await db.prepare(
    "SELECT COUNT(*) c FROM plays WHERE st='hit' AND ai=-dir AND t0>?"
  ).bind(since).first();
  const top = (await db.prepare(
    "SELECT player,MAX(name) name,COUNT(*) n,SUM(st='hit') h,SUM(st='hit' AND ai=-dir) beat FROM plays WHERE st!='open' AND t0>? GROUP BY player HAVING n>=3 ORDER BY (h+1.0)/(n+2) DESC,n DESC LIMIT 10"
  ).bind(since).all()).results;
  const recent = (await db.prepare(`SELECT ${PLAY_COLS} FROM plays ORDER BY id DESC LIMIT 15`).all()).results;
  const open = (await db.prepare("SELECT COUNT(*) c FROM plays WHERE st='open'").first()).c;
  return {
    window: '7d',
    humans: { n: hum.n, h: hum.h, acc: hum.n ? hum.h / hum.n : null, players: hum.players, beat: beat.c },
    ai: { n: bot.n, h: bot.h, acc: bot.n ? bot.h / bot.n : null },
    open, top, recent
  };
}

const worker = {
  async scheduled(e, env, ctx) { ctx.waitUntil(tick(env)); },

  async fetch(req, env, ctx) {
    const u = new URL(req.url), ttl = req.method === 'GET' && GET_TTL[u.pathname];
    if (!ttl) return worker.handle(req, env, ctx);
    const key = 'get:' + u.pathname + u.search;
    const c = await memo(key, ttl, async () => {
      const r = await worker.handle(req, env, ctx);
      return { status: r.status, type: r.headers.get('content-type'), body: await r.text() };
    }).catch((e) => ({ status: 500, type: 'application/json', body: JSON.stringify({ error: String(e.message || e) }) }));
    if (c.status !== 200) MEMO.delete(key); // never pin an error
    return new Response(c.body, {
      status: c.status,
      headers: {
        'content-type': c.type || 'application/json',
        'access-control-allow-origin': '*',
        ...(c.status === 200 ? { 'cache-control': `public, max-age=0, s-maxage=${ttl}, stale-while-revalidate=${ttl * 4}` } : {}),
      },
    });
  },

  async handle(req, env, ctx) {
    const u = new URL(req.url), db = env.DB, p = u.pathname, q = u.searchParams;
    if (!p.startsWith('/api/')) return env.ASSETS.fetch(req);
    try {
      if (p === '/api/state') {
        const pr = {};
        for (const s of Object.keys(SYMS)) pr[s] = await hist(db, s, 30);
        return J({
          t: now(), open: mkt().open, prices: pr,
          agents: await board(db),
          head: await db.prepare('SELECT i,hash FROM ledger ORDER BY i DESC LIMIT 1').first()
        });
      }
      if (p === '/api/feed') {
        const a = q.get('agent'), n = Math.min(+q.get('limit') || 30, 100);
        return J((await db.prepare(
          `SELECT p.*,g.name aname,g.handle ahandle,(SELECT COUNT(*) FROM likes l WHERE l.pid=p.id)+5*(SELECT COUNT(*) FROM holder_votes hv WHERE hv.pid=p.id) likes,rg.name rname FROM preds p JOIN agents g ON g.id=p.agent LEFT JOIN preds r ON r.id=p.reply_to LEFT JOIN agents rg ON rg.id=r.agent ${a ? 'WHERE p.agent=?' : ''} ORDER BY p.id DESC LIMIT ?`
        ).bind(...(a ? [a, n] : [n])).all()).results);
      }
      if (p === '/api/swarm') {
        const sy = q.get('sym');
        return J({ sym: sy, ...(await swarm(db, sy)) });
      }
      if (p === '/api/play' && req.method === 'POST') {
        const r = await play(db, req, env, await req.json());
        return r.e ? J({ error: r.e }, r.s) : J(r);
      }
      if (p === '/api/play' && req.method === 'GET') {
        const r = await db.prepare(`SELECT ${PLAY_COLS} FROM plays WHERE id=?`).bind(+q.get('id') || 0).first();
        return r ? J(r) : J({ error: 'not found' }, 404);
      }
      if (p === '/api/plays' && req.method === 'POST') {
        // own history: the browser proves the player by its secret
        const pl = await sha('player|' + String((await req.json()).secret || ''));
        return J((await db.prepare(`SELECT ${PLAY_COLS} FROM plays WHERE player=? ORDER BY id DESC LIMIT 30`)
          .bind(pl).all()).results);
      }
      if (p === '/api/arena') return J(await arena(db));
      // ---- verification network ----
      // Ask Coreum chat: only through the site, which passes the visitor's IP and holder wallet
      if (p === '/api/chat' && req.method === 'POST') {
        if (!env.SHARED_SECRET || req.headers.get('x-coreum-secret') !== env.SHARED_SECRET) return J({ error: 'forbidden' }, 403);
        const holder = req.headers.get('x-coreum-holder');
        const isH = holder && (await CORS.isHolder(env, holder));
        const ok = await CHAT.admit(env, await req.json(), isH ? 'holder:' + holder.toLowerCase() : 'ip:' + cip(req, env), isH ? CHAT_HOLDER_PER_DAY : undefined);
        if (ok.e) return J({ error: ok.e }, ok.s);
        const { readable, writable } = new TransformStream();
        const w = writable.getWriter(), enc = new TextEncoder();
        const send = (ev) => w.write(enc.encode('data: ' + JSON.stringify(ev) + '\n\n'));
        ctx.waitUntil(CHAT.run(env, ok.hist, ok.left, send).finally(() => w.close()));
        return new Response(readable, { headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store' } });
      }
      if (p === '/api/ask' && req.method === 'POST') {
        const b = await req.json();
        const k = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
        const a = k && await db.prepare('SELECT id FROM agents WHERE key_hash=?').bind(await sha(k)).first();
        // only our own site (which fetched the post itself) may attach an X post
        const fromSite = env.SHARED_SECRET &&
          req.headers.get('x-coreum-secret') === env.SHARED_SECRET;
        const s = fromSite && b.src && typeof b.src === 'object' ? b.src : null;
        const src = !s ? null
          : s.kind === 'token'
            ? /^0x[0-9a-f]{40}$/i.test(String(s.address || '')) && {
                kind: 'token', address: String(s.address).toLowerCase(),
                name: String(s.name || '').slice(0, 60), symbol: String(s.symbol || '').slice(0, 20),
                image: String(s.image || '').slice(0, 300), url: String(s.url || '').slice(0, 200),
                ...(s.via === 'radar' || s.via === 'watch' ? { via: s.via } : {}),
                // facts are flat numbers / short strings; anything else is dropped
                facts: Object.fromEntries(Object.entries(s.facts && typeof s.facts === 'object' ? s.facts : {})
                  .slice(0, 30)
                  .filter(([, v]) => v === null || typeof v === 'boolean' || typeof v === 'number' || (typeof v === 'string' && v.length <= 60))),
              }
            : {
                url: String(s.url || '').slice(0, 200), id: String(s.id || '').slice(0, 30),
                author: String(s.author || '').slice(0, 80), handle: String(s.handle || '').slice(0, 40),
                avatar: String(s.avatar || '').slice(0, 300), text: String(s.text || '').slice(0, 600),
                created: String(s.created || '').slice(0, 40),
              };
        // Pons Radar asks through the site with the admin key: its own quota, never a visitor's
        const admin = env.ADMIN_SECRET || env.SHARED_SECRET;
        const radar = fromSite && b.radar === true && admin && req.headers.get('x-coreum-admin') === admin;
        // $CORS: an API key bought with a burn, a burned check past the limit, or the holder tier
        const key = !a && k ? await CORS.apiKey(env, k) : null;
        const paid = fromSite && req.headers.get('x-coreum-paid');
        const holder = fromSite && req.headers.get('x-coreum-holder');
        let r;
        if (radar) r = await V.ask(env, ctx, b.q, 'radar', src && { ...src, via: src.via === 'watch' ? 'watch' : 'radar' }, 200);
        else if (a) r = await V.ask(env, ctx, b.q, 'agent:' + a.id, src);
        else if (k && !key) return J({ error: 'unknown or expired API key' }, 401);
        else if (key) r = await V.ask(env, ctx, b.q, 'key:' + key.id, src, key.quota);
        else if (paid && (await CORS.burnReady(env, paid, 'check'))) {
          r = await V.ask(env, ctx, b.q, 'burn:' + paid, src, 1);
          if (!r.e) await CORS.useBurn(env, paid, 'check');
        } else if (holder && (await CORS.isHolder(env, holder))) r = await V.ask(env, ctx, b.q, 'holder:' + holder.toLowerCase(), src, CORS_HOLDER_PER_DAY);
        else r = await V.ask(env, ctx, b.q, await sha('ip' + cip(req, env)), src);
        return r.e ? J({ error: r.e }, r.s) : J(r);
      }
      if (p === '/api/job') {
        const r = await V.view(env, +q.get('id') || 0);
        return r ? J(r) : J({ error: 'not found' }, 404);
      }
      if (p === '/api/jobs') return J(await V.recent(env, Math.min(+q.get('limit') || 20, 100)));
      // ---- $CORS in the network (site only: the site reads the chain, this keeps the records) ----
      if (p === '/api/cors-utility') return J(await CORS.status(env));
      if (p === '/api/holder/record' || p === '/api/burn/record' || p === '/api/apikey/create' || p === '/api/holder/status') {
        if (!env.SHARED_SECRET || req.headers.get('x-coreum-secret') !== env.SHARED_SECRET) return J({ error: 'forbidden' }, 403);
        if (p === '/api/holder/status') return J({ holder: await CORS.isHolder(env, q.get('addr')) });
        const body = await req.json();
        const r = p === '/api/holder/record' ? await CORS.recordHolder(env, body) : p === '/api/burn/record' ? await CORS.recordBurn(env, body) : await CORS.createKey(env, body);
        return r.e ? J({ error: r.e }, r.s) : J(r);
      }
      // ---- deployer history store (site only: the site scans the chain, this keeps the result) ----
      if (p === '/api/deployer') {
        if (!env.SHARED_SECRET || req.headers.get('x-coreum-secret') !== env.SHARED_SECRET) return J({ error: 'forbidden' }, 403);
        const r = req.method === 'POST' ? await D.save(env, await req.json()) : await D.get(env, q.get('address'));
        return r.e ? J({ error: r.e }, r.s) : J(r);
      }
      // ---- Pons census: public numbers; the hourly sync writes with the admin key ----
      if (p === '/api/pons') return J(await PONS.summary(env));
      if (p === '/api/pons-token') return J(await PONS.token(env, q.get('address')));
      if (p === '/api/pons-deployer') return J(await PONS.deployer(env, q.get('address')));
      if (p.startsWith('/api/pons/')) {
        const admin = env.ADMIN_SECRET || env.SHARED_SECRET;
        if (!admin || req.headers.get('x-coreum-admin') !== admin) return J({ error: 'forbidden' }, 403);
        if (p === '/api/pons/state') return J(await PONS.state(env));
        if (p === '/api/pons/ingest' && req.method === 'POST') return J(await PONS.ingest(env, await req.json()));
        if (p === '/api/pons/sample') return J(await PONS.sample(env, +q.get('n') || 2000));
        if (p === '/api/pons/recompute' && req.method === 'POST') return J(await PONS.recompute(env));
        return J({ error: 'not found' }, 404);
      }
      // ---- watchlist ----
      if (p === '/api/watch' && req.method === 'POST') {
        // only our site adds tokens (it fetched their facts); one watch per visitor
        if (!env.SHARED_SECRET || req.headers.get('x-coreum-secret') !== env.SHARED_SECRET) return J({ error: 'forbidden' }, 403);
        const r = await W.add(env, await req.json(), await sha('ip' + cip(req, env)));
        return r.e ? J({ error: r.e }, r.s) : J(r);
      }
      if (p === '/api/watch/status') return J(await W.status(env, q.get('address'), await sha('ip' + cip(req, env))));
      if (p === '/api/watch' && req.method === 'GET') return J(await W.list(env));
      if (p === '/api/watch/all' || p === '/api/watch/update') {
        const admin = env.ADMIN_SECRET || env.SHARED_SECRET;
        if (!admin || req.headers.get('x-coreum-admin') !== admin) return J({ error: 'forbidden' }, 403);
        if (p === '/api/watch/all') return J(await W.all(env));
        const r = await W.update(env, await req.json());
        return r.e ? J({ error: r.e }, r.s) : J(r);
      }
      if (p === '/api/radar') return J(await V.radar(env));
      if (p === '/api/radar/known') {
        const admin = env.ADMIN_SECRET || env.SHARED_SECRET;
        if (!admin || req.headers.get('x-coreum-admin') !== admin) return J({ error: 'forbidden' }, 403);
        return J(await V.radarKnown(env));
      }
      if (p === '/api/token-checks') return J(await V.tokenChecks(env, Math.min(+q.get('limit') || 30, 100)));
      if (p === '/api/token-verdict') {
        const r = await V.tokenVerdict(env, q.get('address'));
        return r.e ? J({ error: r.e }, r.s) : J(r);
      }
      if (p === '/api/truth-board') return J(await V.truthBoard(env, (q.get('handle') || '').replace(/^@/, '').slice(0, 40)));
      if (p === '/api/cores') return J(await V.cores(env));
      if (p === '/api/cohort') return J(await V.cohort(env));
      if (p === '/api/network') return J(await V.stats(env));
      if (p === '/api/burns') {
        // The public RPC turns away Cloudflare egress, so burns are read from the
        // chain by the site (web/app/api/burns) — send callers there.
        return Response.redirect('https://www.coreum.xyz/api/burns', 302);
      }
      if (p.startsWith('/api/core/')) {
        const k = (req.headers.get('authorization') || '').replace(/^Bearer /, '');
        const core = k && await db.prepare('SELECT * FROM agents WHERE key_hash=?').bind(await sha(k)).first();
        if (!core) return J({ error: 'invalid core key' }, 401);
        if (p === '/api/core/work') return J(await V.work(env, core));
        if (p === '/api/core/commit' && req.method === 'POST') {
          const r = await V.commit(env, core, await req.json());
          return r.e ? J({ error: r.e }, r.s) : J(r);
        }
        if (p === '/api/core/reveal' && req.method === 'POST') {
          const r = await V.reveal(env, core, await req.json());
          return r.e ? J({ error: r.e }, r.s) : J(r);
        }
      }
      if (p === '/api/ledger')
        return J((await db.prepare('SELECT * FROM ledger ORDER BY i DESC LIMIT ?')
          .bind(Math.min(+q.get('limit') || 25, 200)).all()).results);
      if (p === '/api/export')
        return J((await db.prepare('SELECT i,type,prev,data,hash FROM ledger ORDER BY i LIMIT 50000').all()).results);
      if (p === '/api/agents' && req.method === 'GET') return J(await board(db));
      if (p === '/api/follow' && req.method === 'POST') {
        const b = await req.json(),
          a = await db.prepare('SELECT id FROM agents WHERE handle=?').bind(String(b.handle || '')).first(),
          cid = String(b.cid || '').slice(0, 64);
        if (!a || !cid) return J({ error: 'bad request' }, 400);
        await (b.on
          ? db.prepare('INSERT OR IGNORE INTO follows VALUES(?,?)')
          : db.prepare('DELETE FROM follows WHERE cid=? AND agent=?')
        ).bind(cid, a.id).run();
        return J({ ok: 1 });
      }
      if (p === '/api/like' && req.method === 'POST') {
        const b = await req.json();
        await db.prepare('INSERT OR IGNORE INTO likes VALUES(?,?)')
          .bind(await sha('ip' + cip(req, env)), +b.pid).run();
        return J({ ok: 1 });
      }
      if (p === '/api/agents' && req.method === 'POST') {
        const b = await req.json(),
          name = String(b.name || '').trim().slice(0, 40),
          strat = b.strat;
        if (!name || !['momentum', 'meanrev', 'breakout', 'external'].includes(strat))
          return J({ error: 'bad name or strategy' }, 400);
        let wallet = String(b.wallet || '').trim();
        if (wallet && !/^0x[a-fA-F0-9]{40}$/.test(wallet))
          return J({ error: 'invalid wallet address' }, 400);
        const tx = String(b.tx || '').trim();
        const ip = await sha('ip' + cip(req, env));
        if ((await db.prepare('SELECT COUNT(*) c FROM agents WHERE ip_hash=? AND created>?')
          .bind(ip, now() - 86400).first()).c >= 3)
          return J({ error: 'limit: 3 agents per day' }, 429);
        // A verified core burned $CORS; the site read that burn on chain. No tx: an unverified core.
        let corsPaid = 0;
        if (tx) {
          // recorded by the site after it read the receipt on chain (POST /api/cors/burn, purpose "core")
          const burn = await CORS.useBurn(env, tx, 'core');
          if (!burn) return J({ error: 'that burn is not recorded or was already used — record it at coreum.xyz/cors first' }, 402);
          corsPaid = Number(BigInt(burn.amount) / 10n ** 18n);
          wallet = burn.addr;
        }
        const focus = String(b.focus || '').split(',').filter(x => x in SYMS).join(',') || ALL,
          id = crypto.randomUUID().slice(0, 8),
          key = 'ck_' + crypto.randomUUID().replaceAll('-', '');
        let handle = String(b.handle || name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 30) || id;
        if (await db.prepare('SELECT 1 FROM agents WHERE handle=?').bind(handle).first())
          handle += '-' + id.slice(0, 3);
        try {
          await db.prepare(
            'INSERT INTO agents(id,name,handle,persona,kind,strat,focus,rate,key_hash,ip_hash,created,cors_paid,wallet,cors_staked,cors_earned) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,0,0)'
          ).bind(
            id, name, handle,
            String(b.persona || '').slice(0, 600),
            strat === 'external' ? 'external' : 'hosted',
            strat, focus,
            Math.min(Math.max(+b.rate || .1, .03), .5),
            await sha(key), ip, now(), corsPaid, wallet || null
          ).run();
        } catch (e) {
          if (/UNIQUE/.test(e.message)) return J({ error: 'name already taken' }, 409);
          console.error('agent insert failed: ' + e.message);
          return J({ error: 'could not create the node' }, 500);
        }
        const verified = corsPaid > 0 ? 1 : 0;
        if (verified) {
          try {
            await db.prepare('INSERT INTO cors_payments(agent,wallet,amount,tx,verified,ts) VALUES(?,?,?,?,1,?)')
              .bind(id, wallet || 'none', corsPaid, tx, now()).run();
          } catch (e) {}
        }
        await append(db, 'agent_deploy', {
          agent: id, handle, wallet: wallet || null,
          cors_paid: corsPaid, tx: tx || null, verified
        });
        return J({ id, key, handle, cors_paid: corsPaid, verified });
      }
      if (p === '/api/predict' && req.method === 'POST') {
        const k = (req.headers.get('authorization') || '').replace(/^Bearer /, ''),
          a = k && await db.prepare('SELECT * FROM agents WHERE key_hash=?').bind(await sha(k)).first();
        if (!a) return J({ error: 'invalid API key' }, 401);
        const b = await req.json(),
          dir = b.dir === 'up' || b.dir === 1 ? 1 : b.dir === 'down' || b.dir === -1 ? -1 : 0,
          conf = Math.round(+b.conf), min = +b.minutes;
        if (!(b.sym in SYMS) || !dir || !(conf >= 51 && conf <= 99) || !HZ.includes(min))
          return J({ error: 'need sym (' + ALL + '), dir (up|down), conf 51-99, minutes in ' + HZ.join('/') }, 400);
        if ((await db.prepare('SELECT COUNT(*) c FROM preds WHERE agent=? AND t0>?')
          .bind(a.id, now() - 86400).first()).c >= 100)
          return J({ error: 'daily limit reached' }, 429);
        const r = await place(db, a, b.sym, dir, conf, min,
          b.note ? String(b.note).slice(0, 280) : null, +b.reply_to || null);
        return typeof r === 'string' ? J({ error: r }, 400) : J(r);
      }
      if (p === '/api/me' && req.method === 'POST') {
        const b = await req.json(),
          a = await db.prepare('SELECT id,name FROM agents WHERE key_hash=?')
            .bind(await sha(String(b.key || ''))).first();
        return a ? J(a) : J({ error: 'unknown key' }, 404);
      }
      if (p === '/api/verdicts/pending') {
        // Finished verdicts after a job id, in the shape CoreumVerdicts.seal() takes.
        const after = Math.max(0, +q.get('after') || 0), n = Math.min(Math.max(+q.get('limit') || 50, 1), 100);
        const rows = (await db.prepare(
          "SELECT j.id,j.q,j.verdict,j.agree,j.n,j.h,(SELECT i FROM ledger WHERE hash=j.h) i FROM jobs j WHERE j.phase='done' AND j.id>? ORDER BY j.id LIMIT ?"
        ).bind(after, n).all()).results;
        const code = { YES: 1, NO: 2, UNSURE: 3 };
        return J(await Promise.all(rows.filter(r => r.h && r.i != null).map(async r => ({
          jobId: r.id, questionHash: '0x' + await sha(r.q), ledgerHash: '0x' + r.h, ledgerBlock: r.i,
          verdict: code[r.verdict], agreePct: Math.round((r.agree || 0) * 100), cores: r.n,
        }))));
      }
      if (p === '/api/verdicts/latest') {
        // the newest CoreumVerdicts seal tx and how many jobs it has covered so far
        const last = await db.prepare('SELECT id,chain_tx FROM jobs WHERE chain_tx IS NOT NULL ORDER BY id DESC LIMIT 1').first();
        const n = await db.prepare('SELECT COUNT(DISTINCT chain_tx) txs FROM jobs WHERE chain_tx IS NOT NULL').first();
        return J({ tx: last?.chain_tx || null, jobId: last?.id || null, txs: n?.txs || 0 });
      }
      if (p === '/api/verdicts/sealed' && req.method === 'POST') {
        // Recorded by the hourly action once its CoreumVerdicts.seal() tx confirms.
        const admin = env.ADMIN_SECRET || env.SHARED_SECRET;
        if (!admin || req.headers.get('x-coreum-admin') !== admin) return J({ error: 'forbidden' }, 403);
        const b = await req.json(), tx = String(b.tx || '');
        if (!/^0x[0-9a-f]{64}$/i.test(tx)) return J({ error: 'bad tx hash' }, 400);
        const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Number.isInteger).slice(0, 100);
        for (const id of ids) await db.prepare('UPDATE jobs SET chain_tx=? WHERE id=? AND chain_tx IS NULL').bind(tx, id).run();
        return J({ ok: 1, n: ids.length });
      }
      if (p === '/api/anchor/evm' && req.method === 'POST') {
        // Recorded by the hourly GitHub Action after its Robinhood Chain tx confirms.
        // Admin header only (the site's public /api proxy never sets it), and the hash
        // must match our ledger.
        // ADMIN_SECRET is separate from SHARED_SECRET (which only vouches for client IPs).
        const admin = env.ADMIN_SECRET || env.SHARED_SECRET;
        if (!admin || req.headers.get('x-coreum-admin') !== admin)
          return J({ error: 'forbidden' }, 403);
        const b = await req.json();
        const i = +b.head_i, tx = String(b.tx || '');
        if (!/^0x[0-9a-f]{64}$/i.test(tx)) return J({ error: 'bad tx hash' }, 400);
        const row = await db.prepare('SELECT hash FROM ledger WHERE i=?').bind(i).first();
        if (!row || row.hash !== String(b.head_hash)) return J({ error: 'head does not match the ledger' }, 409);
        if (!(await db.prepare("SELECT 1 FROM anchors WHERE kind='evm' AND proof=?").bind(tx).first()))
          await db.prepare("INSERT INTO anchors(ts,head_i,head_hash,kind,proof) VALUES(?,?,?,'evm',?)")
            .bind(now(), i, row.hash, tx).run();
        return J({ ok: 1 });
      }
      if (p === '/api/anchors')
        return J((await db.prepare(
          "SELECT id,ts,head_i,head_hash,kind,CASE WHEN kind='evm' THEN proof END tx FROM anchors ORDER BY id DESC LIMIT 20"
        ).all()).results);
      if (p === '/api/ots') {
        const r = await db.prepare("SELECT proof FROM anchors WHERE id=? AND kind='ots'")
          .bind(+q.get('id')).first();
        if (!r) return J({ error: 'not found' }, 404);
        return new Response(
          Uint8Array.from(atob(r.proof), c => c.charCodeAt(0)),
          { headers: { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="coreum-' + q.get('id') + '.ots"' } }
        );
      }
      if (p === '/api/stats') {
        // Public track record: everything the feed claims, aggregated. Misses
        // are counted as loudly as hits — this is the honesty surface. All
        // queries join agents so calls of deleted (spam) agents never count,
        // matching exactly what /api/feed and the digest show.
        const [ov, open, strat, sym, byConf, daily, recent] = await Promise.all([
          db.prepare(
            `SELECT COUNT(*) n,COALESCE(SUM(p.st='hit'),0) h,AVG(1.0*(p.st='hit')) acc,
               AVG((p.conf/100.0-(p.st='hit'))*(p.conf/100.0-(p.st='hit'))) br
             FROM preds p JOIN agents g ON g.id=p.agent WHERE p.st!='open'`
          ).first(),
          db.prepare(
            "SELECT COUNT(*) c FROM preds p JOIN agents g ON g.id=p.agent WHERE p.st='open'"
          ).first(),
          db.prepare(
            `SELECT g.strat strat,COUNT(*) n,SUM(p.st='hit') h,AVG(1.0*(p.st='hit')) acc,
               AVG((p.conf/100.0-(p.st='hit'))*(p.conf/100.0-(p.st='hit'))) br
             FROM preds p JOIN agents g ON g.id=p.agent WHERE p.st!='open'
             GROUP BY g.strat ORDER BY n DESC`
          ).all(),
          db.prepare(
            `SELECT p.sym sym,COUNT(*) n,SUM(p.st='hit') h,AVG(1.0*(p.st='hit')) acc
             FROM preds p JOIN agents g ON g.id=p.agent WHERE p.st!='open'
             GROUP BY p.sym ORDER BY n DESC`
          ).all(),
          db.prepare(
            `SELECT CASE WHEN p.conf<=60 THEN '51-60' WHEN p.conf<=70 THEN '61-70'
               WHEN p.conf<=80 THEN '71-80' ELSE '81-99' END b,
               COUNT(*) n,SUM(p.st='hit') h,AVG(1.0*(p.st='hit')) acc,
               AVG(p.conf) conf
             FROM preds p JOIN agents g ON g.id=p.agent WHERE p.st!='open'
             GROUP BY b ORDER BY b`
          ).all(),
          db.prepare(
            `SELECT date(p.dl,'unixepoch') d,COUNT(*) n,SUM(p.st='hit') h
             FROM preds p JOIN agents g ON g.id=p.agent
             WHERE p.st!='open' AND p.dl>? GROUP BY d ORDER BY d`
          ).bind(now() - 30 * 86400).all(),
          db.prepare(
            `SELECT p.id,p.sym,p.dir,p.conf,p.st,p.p0,p.p1,p.dl,p.sh FROM preds p
             JOIN agents g ON g.id=p.agent WHERE p.st!='open'
             ORDER BY p.dl DESC LIMIT 10`
          ).all()
        ]);
        return J({
          total: ov, open: open?.c || 0,
          byStrat: strat.results, bySym: sym.results, byConf: byConf.results,
          daily: daily.results, recent: recent.results,
          t: now()
        });
      }
      if (p === '/api/answer') {
        // A verifiable answer: the swarm consensus over a price snapshot,
        // committed to the ledger before anyone can act on it. Repeated
        // requests within 5 minutes return the same commitment (rate limit
        // is structural: at most one ledger write per symbol per 5 min).
        const s = String(q.get('sym') || '').toUpperCase();
        if (!(s in SYMS)) return J({ error: 'need sym: ' + ALL }, 400);
        const t = now();
        const prev = await db.prepare('SELECT * FROM answers WHERE sym=?').bind(s).first();
        if (prev && t - prev.ts < 300)
          return J({
            sym: s, ts: prev.ts, price: prev.price, price_t: prev.price_t,
            pct: prev.pct, calls: JSON.parse(prev.calls || '[]'),
            i: prev.i, hash: prev.hash, fresh: false,
            answer: prev.pct == null ? null : prev.pct >= .5 ? 'up' : 'down'
          });
        const pr = await last(db, s);
        const b = Object.fromEntries((await board(db)).map(x => [x.id, x]));
        const rows = (await db.prepare(
          "SELECT p.* FROM preds p JOIN agents g ON g.id=p.agent WHERE p.st='open' AND p.sym=?"
        ).bind(s).all()).results.map(r => ({
          ...r,
          w: Math.max(.02, b[r.agent].trust / 100) * r.conf / 100 * (b[r.agent].n >= 5 ? 1 : .3)
        }));
        const tot = rows.reduce((x, r) => x + r.w, 0);
        const pct = tot ? rows.filter(r => r.dir > 0).reduce((x, r) => x + r.w, 0) / tot : null;
        const data = {
          sym: s, price: pr ? pr.p : null, price_t: pr ? pr.t : null, ts: t,
          calls: rows.map(r => r.id), pct
        };
        const hash = await append(db, 'answer', data);
        const head = await db.prepare('SELECT i FROM ledger ORDER BY i DESC LIMIT 1').first();
        await db.prepare(
          'INSERT INTO answers(sym,ts,price,price_t,pct,calls,i,hash) VALUES(?,?,?,?,?,?,?,?) ' +
          'ON CONFLICT(sym) DO UPDATE SET ts=excluded.ts,price=excluded.price,price_t=excluded.price_t,pct=excluded.pct,calls=excluded.calls,i=excluded.i,hash=excluded.hash'
        ).bind(s, t, data.price, data.price_t, pct, JSON.stringify(data.calls), head.i, hash).run();
        return J({
          sym: s, ts: t, price: data.price, price_t: data.price_t, pct,
          calls: data.calls, i: head.i, hash, fresh: true,
          answer: pct == null ? null : pct >= .5 ? 'up' : 'down'
        });
      }
      if (p === '/api/holder/verify' && req.method === 'POST') {
        // the public RPC turns away Cloudflare Workers, so the site reads the balance now
        return J({ error: 'moved: holders verify on coreum.xyz/cors (POST /api/cors/holder)' }, 410);
      }
      if (p === '/api/holder/like' && req.method === 'POST') {
        // A holder's like weighs 5× (one verified address = one vote per post).
        const b = await req.json();
        const addr = String(b.addr || '').toLowerCase(), pid = +b.pid;
        if (!/^0x[a-f0-9]{40}$/.test(addr) || !(pid > 0)) return J({ error: 'bad request' }, 400);
        let who = '';
        try {
          who = verifyMessage('Coreum holder vote\npost: ' + pid + '\naddr: ' + addr, String(b.sig || '')).toLowerCase();
        } catch (e) { return J({ error: 'bad signature' }, 400); }
        if (who !== addr) return J({ error: 'signature does not match address' }, 403);
        if (!(await db.prepare('SELECT 1 FROM holders WHERE addr=?').bind(addr).first()))
          return J({ error: 'verify holder first (POST /api/holder/verify)' }, 403);
        await db.prepare('INSERT OR IGNORE INTO holder_votes(pid,addr,ts) VALUES(?,?,?)').bind(pid, addr, now()).run();
        return J({ ok: 1, weight: 5 });
      }
      if (p === '/api/holders')
        return J((await db.prepare(
          'SELECT addr,amount,ts FROM holders ORDER BY CAST(amount AS INTEGER) DESC LIMIT 100'
        ).all()).results);
      if (p === '/api/weekly_posts') {
        if (req.method === 'POST') {
          const row = await weeklyPost(env, true);
          return J(row || { error: 'not available' }, row ? 200 : 500);
        }
        return J((await db.prepare(
          'SELECT k,text,short,tg,x,created FROM weekly_posts ORDER BY k DESC LIMIT ?'
        ).bind(Math.min(+q.get('limit') || 4, 12)).all()).results);
      }
      if (p === '/api/daily_posts') {
        if (req.method === 'POST') {
          const row = await dailyPost(env, true);
          return J(row || { error: 'not available' }, row ? 200 : 500);
        }
        return J((await db.prepare(
          'SELECT d,text,short,tg,x,created FROM daily_posts ORDER BY d DESC LIMIT ?'
        ).bind(Math.min(+q.get('limit') || 7, 30)).all()).results);
      }
      if (p === '/api/cors') {
        const [paid, burned, rewards, pending, recent] = await Promise.all([
          db.prepare('SELECT COALESCE(SUM(amount),0) s, COUNT(*) c FROM cors_payments WHERE verified=1').first(),
          db.prepare('SELECT COALESCE(SUM(amount),0) s, COUNT(*) c FROM cors_burns').first(),
          db.prepare('SELECT COALESCE(SUM(amount),0) s, COUNT(*) c FROM cors_rewards').first(),
          db.prepare('SELECT COUNT(*) c FROM cors_payments WHERE verified=0').first(),
          db.prepare('SELECT amount,tx,ts FROM cors_burns WHERE tx IS NOT NULL ORDER BY id DESC LIMIT 20').all()
        ]);
        return J({
          address: CORS_ADDR,
          burnAddress: BURN_ADDR,
          totalPaid: paid?.s || 0, payments: paid?.c || 0,
          pending: pending?.c || 0,
          totalBurned: burned?.s || 0, burns: burned?.c || 0,
          totalRewards: rewards?.s || 0, rewardCount: rewards?.c || 0,
          recentBurns: recent?.results || [],
          agents: (await db.prepare('SELECT id,name,handle,cors_paid,cors_staked,cors_earned FROM agents ORDER BY cors_earned DESC').all()).results
        });
      }
      return J({ error: 'not found' }, 404);
    } catch (e) {
      return J({ error: String(e.message || e) }, 500);
    }
  }
};

export default worker;
