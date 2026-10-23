// Deployer history store: every token a wallet launched through the Pons
// launchpad, found on chain by the site (the public RPC turns away Cloudflare
// Workers) and kept here with the last block scanned, so later checks only
// read new blocks.

export function makeDeployer({ now }) {
  async function get(env, address) {
    const dev = String(address || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(dev)) return { e: 'bad address', s: 400 };
    const row = await env.DB.prepare('SELECT scanned_to, tokens, updated, contract FROM deployers WHERE address=?').bind(dev).first();
    if (!row) return { address: dev, found: false };
    return { address: dev, found: true, contract: !!row.contract, scanned_to: row.scanned_to, updated: row.updated, tokens: JSON.parse(row.tokens) };
  }

  async function save(env, b) {
    const dev = String(b.address || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(dev)) return { e: 'bad address', s: 400 };
    const tokens = (Array.isArray(b.tokens) ? b.tokens : [])
      .filter((t) => /^0x[0-9a-f]{40}$/.test(String(t?.a)) && Number.isInteger(t?.b))
      .slice(0, 20000)
      .map((t) => ({ a: t.a, b: t.b }));
    await env.DB.prepare(
      'INSERT INTO deployers (address, scanned_to, tokens, updated, contract) VALUES (?,?,?,?,?) ' +
      'ON CONFLICT(address) DO UPDATE SET scanned_to=excluded.scanned_to, tokens=excluded.tokens, updated=excluded.updated, contract=excluded.contract'
    ).bind(dev, Number(b.scanned_to) || 0, JSON.stringify(tokens), now(), b.contract ? 1 : 0).run();
    return { ok: true };
  }

  return { get, save };
}
