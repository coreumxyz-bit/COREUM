// Watchlist: tokens the network keeps an eye on. The site adds them (with the
// facts it fetched) and, every hour, sends fresh snapshots plus whatever changed.
const MAX_TOKENS = 300;

export function makeWatch({ sha, now }) {
  async function add(env, b, who) {
    const db = env.DB, a = String(b.address || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(a)) return { e: 'bad token address', s: 400 };
    const have = await db.prepare('SELECT address FROM watches WHERE address=?').bind(a).first();
    if (!have) {
      const n = (await db.prepare('SELECT COUNT(*) c FROM watches').first()).c;
      if (n >= MAX_TOKENS) return { e: 'the watchlist is full for now', s: 429 };
      await db.prepare('INSERT INTO watches(address,name,symbol,image,added,watchers,snap,snap_at,last_job) VALUES(?,?,?,?,?,0,?,?,?)')
        .bind(a, String(b.name || '').slice(0, 60), String(b.symbol || '').slice(0, 20), String(b.image || '').slice(0, 300), now(),
          b.facts ? JSON.stringify(b.facts).slice(0, 2000) : null, b.facts ? now() : null, Number(b.job) || null).run();
    }
    await db.prepare('INSERT OR IGNORE INTO watch_ips(address,who) VALUES(?,?)').bind(a, who).run();
    const c = (await db.prepare('SELECT COUNT(*) c FROM watch_ips WHERE address=?').bind(a).first()).c;
    await db.prepare('UPDATE watches SET watchers=? WHERE address=?').bind(c, a).run();
    return { watching: true, watchers: c };
  }

  async function status(env, address, who) {
    const a = String(address || '').toLowerCase();
    const w = await env.DB.prepare('SELECT watchers FROM watches WHERE address=?').bind(a).first();
    const me = w && (await env.DB.prepare('SELECT 1 FROM watch_ips WHERE address=? AND who=?').bind(a, who).first());
    return { watching: !!me, watchers: w ? w.watchers : 0 };
  }

  async function list(env) {
    const db = env.DB;
    const tokens = (await db.prepare(
      'SELECT address,name,symbol,image,added,watchers,snap,snap_at,last_job FROM watches ORDER BY watchers DESC, added DESC LIMIT 200'
    ).all()).results.map((t) => ({ ...t, snap: t.snap ? JSON.parse(t.snap) : null }));
    const alerts = (await db.prepare(
      'SELECT a.id,a.address,a.ts,a.kind,a.severity,a.detail,a.job,w.symbol,w.name,w.image FROM watch_alerts a LEFT JOIN watches w ON w.address=a.address ORDER BY a.id DESC LIMIT 60'
    ).all()).results;
    return { tokens, alerts };
  }

  // admin: everything the hourly run needs, oldest snapshot first
  async function all(env) {
    return (await env.DB.prepare('SELECT address,symbol,snap,snap_at,last_job FROM watches ORDER BY COALESCE(snap_at,0) LIMIT 300').all())
      .results.map((t) => ({ ...t, snap: t.snap ? JSON.parse(t.snap) : null }));
  }

  // admin: store a fresh snapshot and the alerts it produced
  async function update(env, b) {
    const db = env.DB, a = String(b.address || '').toLowerCase(), t = now();
    if (!/^0x[0-9a-f]{40}$/.test(a)) return { e: 'bad token address', s: 400 };
    if (b.snap) await db.prepare('UPDATE watches SET snap=?, snap_at=? WHERE address=?').bind(JSON.stringify(b.snap).slice(0, 2000), t, a).run();
    if (b.last_job) await db.prepare('UPDATE watches SET last_job=? WHERE address=?').bind(Number(b.last_job), a).run();
    const alerts = (Array.isArray(b.alerts) ? b.alerts : []).slice(0, 10);
    for (const x of alerts) {
      await db.prepare('INSERT INTO watch_alerts(address,ts,kind,severity,detail,job) VALUES(?,?,?,?,?,?)')
        .bind(a, t, String(x.kind || '').slice(0, 30), ['danger', 'warn', 'good'].includes(x.severity) ? x.severity : 'warn',
          String(x.detail || '').slice(0, 200), Number(x.job) || null).run();
    }
    return { ok: 1, alerts: alerts.length };
  }

  return { add, status, list, all, update };
}
