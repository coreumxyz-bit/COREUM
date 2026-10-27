// What happened to a token after the network checked it: 24 hours and 7 days
// later. The site reads value and liquidity from GeckoTerminal (the public RPC
// turns away Workers) and reports here. These labelled outcomes are the training
// data for a rug-risk model, and the honest scorecard of the grades.
const HORIZONS = { '24h': 86400, '7d': 7 * 86400 };

export function makeOutcomes({ now }) {
  /** Checked tokens whose 24h or 7d mark has passed and has no outcome yet. Baseline = the first check. */
  async function due(env, limit = 60) {
    const t = now();
    const rows = (await env.DB.prepare(
      `SELECT lower(json_extract(src,'$.address')) addr, MIN(done_at) at,
         (SELECT j2.id FROM jobs j2 WHERE lower(json_extract(j2.src,'$.address'))=lower(json_extract(j.src,'$.address')) AND j2.phase='done' ORDER BY j2.done_at LIMIT 1) job
       FROM jobs j WHERE phase='done' AND json_extract(src,'$.kind')='token' AND done_at < ?
       GROUP BY lower(json_extract(src,'$.address'))`
    ).bind(t - HORIZONS['24h']).all()).results;
    const have = new Set((await env.DB.prepare('SELECT address||horizon k FROM outcomes').all()).results.map((r) => r.k));
    const out = [];
    for (const r of rows) {
      for (const [h, secs] of Object.entries(HORIZONS)) {
        if (t - r.at < secs || have.has(r.addr + h)) continue;
        out.push({ address: r.addr, job: r.job, horizon: h, checked_at: r.at });
      }
    }
    out.sort((a, b) => a.checked_at - b.checked_at); // oldest first, so the backlog drains in order
    const pick = out.slice(0, limit);
    // the baseline facts and verdict of each first check
    for (const o of pick) {
      const j = await env.DB.prepare('SELECT verdict, agree, src FROM jobs WHERE id=?').bind(o.job).first();
      const f = JSON.parse(j?.src || '{}').facts || {};
      Object.assign(o, { verdict: j?.verdict, agree: j?.agree, symbol: JSON.parse(j?.src || '{}').symbol, fdv0: f.fdv ?? null, liq0: f.liquidity ?? null, grad0: f.graduated ?? null, facts: f });
    }
    return pick;
  }

  async function record(env, list) {
    let n = 0;
    for (const o of Array.isArray(list) ? list.slice(0, 200) : []) {
      if (!/^0x[0-9a-f]{40}$/.test(String(o.address || '')) || !(o.horizon in HORIZONS)) continue;
      await env.DB.prepare(
        `INSERT INTO outcomes(address,horizon,job,ts,verdict,agree,fdv0,fdv1,liq0,liq1,grad0,grad1,change_pct,label,facts)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(address,horizon) DO NOTHING`
      ).bind(o.address, o.horizon, o.job ?? null, now(), o.verdict ?? null, o.agree ?? null, o.fdv0 ?? null, o.fdv1 ?? null, o.liq0 ?? null, o.liq1 ?? null,
        o.grad0 == null ? null : o.grad0 ? 1 : 0, o.grad1 == null ? null : o.grad1 ? 1 : 0, o.change_pct ?? null, String(o.label || 'no_data'), JSON.stringify(o.facts || {})).run();
      n++;
    }
    return { ok: true, recorded: n };
  }

  /** The scorecard: what became of tokens by the network's verdict. */
  async function stats(env) {
    const rows = (await env.DB.prepare('SELECT horizon, verdict, label, COUNT(*) n FROM outcomes GROUP BY horizon, verdict, label').all()).results;
    const total = (await env.DB.prepare('SELECT COUNT(*) n FROM outcomes').first()).n;
    return { total, rows };
  }

  return { due, record, stats };
}
