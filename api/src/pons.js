// Pons census store. api/scripts/pons-sync.mjs reads the Pons factory's events
// from the chain every hour and sends them here; this keeps every launch, works
// out the numbers and serves them to coreum.xyz/pons.

const BUSY = 20; // launches that make a creator "serial"

export function makePons({ now }) {
  const meta = async (db, k) => (await db.prepare('SELECT v FROM pons_meta WHERE k=?').bind(k).first())?.v;
  const setMeta = (db, k, v) =>
    db.prepare('INSERT INTO pons_meta (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v=excluded.v').bind(k, String(v)).run();
  const addr = (a) => /^0x[0-9a-f]{40}$/.test(String(a)) ? String(a) : null;

  async function state(env) {
    const db = env.DB;
    const busy = (await db.prepare(
      `SELECT t.creator a FROM pons_tokens t LEFT JOIN pons_creators c ON c.address = t.creator
       WHERE c.address IS NULL GROUP BY t.creator HAVING COUNT(*) >= ${BUSY} LIMIT 2000`
    ).all()).results.map((r) => r.a);
    return {
      scanned_to: Number(await meta(db, 'scanned_to')) || 0,
      sample_at: JSON.parse((await meta(db, 'sample')) || '{}').at || 0,
      unchecked_busy_creators: busy,
    };
  }

  // {launches: [{t, c, d, b, ts}], graduations: [{t, ts}], scanned_to?, creators?: {addr: bool}, sample?}
  async function ingest(env, b) {
    const db = env.DB;
    const L = (Array.isArray(b.launches) ? b.launches : []).slice(0, 5000)
      .filter((x) => addr(x.t) && addr(x.c) && addr(x.d) && Number.isInteger(x.b) && Number.isInteger(x.ts));
    const stmts = [];
    for (let i = 0; i < L.length; i += 16) { // 16 rows × 6 values stays under D1's 100 bound parameters
      const part = L.slice(i, i + 16);
      stmts.push(db.prepare('INSERT OR IGNORE INTO pons_tokens (token, curve, creator, block, day, ts) VALUES ' + part.map(() => '(?,?,?,?,?,?)').join(','))
        .bind(...part.flatMap((x) => [x.t, x.c, x.d, x.b, new Date(x.ts * 1000).toISOString().slice(0, 10), x.ts])));
    }
    for (const g of (Array.isArray(b.graduations) ? b.graduations : []).slice(0, 5000))
      if (addr(g.t) && Number.isInteger(g.ts)) stmts.push(db.prepare('UPDATE pons_tokens SET grad_ts=? WHERE token=? AND grad_ts IS NULL').bind(g.ts, g.t));
    for (const [a, c] of Object.entries(b.creators && typeof b.creators === 'object' ? b.creators : {}).slice(0, 2000))
      if (addr(a)) stmts.push(db.prepare('INSERT OR REPLACE INTO pons_creators (address, contract) VALUES (?, ?)').bind(a, c ? 1 : 0));
    for (let i = 0; i < stmts.length; i += 400) await db.batch(stmts.slice(i, i + 400));
    if (b.sample && typeof b.sample === 'object') await setMeta(db, 'sample', JSON.stringify(b.sample));
    if (Number.isInteger(b.scanned_to)) await setMeta(db, 'scanned_to', b.scanned_to);
    return { ok: true, launches: L.length };
  }

  // random launches older than two days, for the daily curve-balance sample
  async function sample(env, n) {
    return (await env.DB.prepare(
      'SELECT token t, curve c, grad_ts IS NOT NULL g FROM pons_tokens WHERE ts < ? ORDER BY random() LIMIT ?'
    ).bind(now() - 2 * 86400, Math.min(Math.max(n | 0, 1), 5000)).all()).results;
  }

  // the numbers the page shows; run after each hourly sync
  async function recompute(env) {
    const db = env.DB;
    const tot = await db.prepare('SELECT COUNT(*) n, COUNT(grad_ts) g, COUNT(DISTINCT creator) c, MIN(ts) first, MAX(ts) last FROM pons_tokens').first();
    const days = (await db.prepare(
      'SELECT day, COUNT(*) n, COUNT(grad_ts) g, COUNT(DISTINCT creator) c FROM pons_tokens GROUP BY day ORDER BY day DESC'
    ).all()).results;
    const busy = (await db.prepare(
      `SELECT t.creator a, COUNT(*) n, c.contract k FROM pons_tokens t LEFT JOIN pons_creators c ON c.address = t.creator
       GROUP BY t.creator HAVING n >= ${BUSY}`
    ).all()).results;
    const once = (await db.prepare('SELECT COUNT(*) n FROM (SELECT creator FROM pons_tokens GROUP BY creator HAVING COUNT(*) = 1)').first()).n;
    const median = await db.prepare(
      'SELECT grad_ts - ts s FROM pons_tokens WHERE grad_ts IS NOT NULL ORDER BY s LIMIT 1 OFFSET (SELECT COUNT(grad_ts) / 2 FROM pons_tokens)'
    ).first();
    const wallets = busy.filter((r) => r.k === 0), launchers = busy.filter((r) => r.k === 1);
    const summary = {
      updated: now(),
      scanned_to: Number(await meta(db, 'scanned_to')) || 0,
      launches: tot.n,
      graduated: tot.g,
      creators: tot.c,
      creators_one_launch: once,
      first_launch: tot.first,
      last_launch: tot.last,
      graduation_median_s: median?.s ?? null,
      serial_wallets: wallets.length,
      serial_wallet_launches: wallets.reduce((s, r) => s + r.n, 0),
      top_wallet_launches: Math.max(0, ...wallets.map((r) => r.n)),
      shared_launchers: launchers.length,
      shared_launcher_launches: launchers.reduce((s, r) => s + r.n, 0),
      busy_unchecked: busy.filter((r) => r.k == null).length,
      sample: JSON.parse((await meta(db, 'sample')) || 'null'),
      days,
    };
    await setMeta(db, 'summary', JSON.stringify(summary));
    return { ok: true, launches: tot.n };
  }

  // one launch: its curve, creator and block (null when not a Pons token, or not synced yet)
  async function token(env, address) {
    const a = addr(String(address || '').toLowerCase());
    return a ? (await env.DB.prepare('SELECT token, curve, creator, block FROM pons_tokens WHERE token=?').bind(a).first()) || { token: a, found: false } : { error: 'bad address' };
  }

  // a deployer's passport: every Pons launch from one wallet (newest first)
  async function deployer(env, address) {
    const a = addr(String(address || '').toLowerCase());
    if (!a) return { error: 'bad address' };
    const db = env.DB;
    const t = await db.prepare('SELECT COUNT(*) n, COUNT(grad_ts) g, MIN(ts) first, MAX(ts) last FROM pons_tokens WHERE creator=?').bind(a).first();
    const tokens = (await db.prepare('SELECT token, ts, grad_ts FROM pons_tokens WHERE creator=? ORDER BY block DESC LIMIT 50').bind(a).all()).results;
    const c = await db.prepare('SELECT contract FROM pons_creators WHERE address=?').bind(a).first();
    return {
      address: a,
      launches: t.n,
      graduated: t.g,
      first_launch: t.first,
      last_launch: t.last,
      contract: c ? !!c.contract : null, // null: not checked (fewer than 20 launches)
      synced_to: Number(await meta(db, 'scanned_to')) || 0,
      tokens,
    };
  }

  async function summary(env) {
    return JSON.parse((await meta(env.DB, 'summary')) || 'null') || { launches: 0, days: [] };
  }

  return { state, ingest, sample, recompute, summary, token, deployer };
}
