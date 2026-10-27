// What $CORS does inside the network. The site reads the chain (balances, burn
// receipts — the public RPC turns away Cloudflare Workers) and reports here with
// the site secret; this keeps the records and applies the limits. A grade is
// never for sale: $CORS changes how many checks you get, never what they say.
import { verifyMessage } from 'ethers';

export const HOLDER_MIN = 1_000_000n;  // CORS held for the holder tier
export const HOLDER_PER_DAY = 200;     // checks a day for holders (50 for everyone else)
export const CHECK_BURN = 100_000n;    // CORS burned for one check past the daily limit
export const KEY_BURN = 1_000_000n;    // CORS burned for an API key
export const KEY_QUOTA = 500;          // checks a day on that key
export const KEY_DAYS = 30;
export const CORE_BURN = 100_000n;     // CORS burned for a verified core operator
const HOLDER_FRESH = 7 * 86400;        // a holder proof is re-checked weekly
const WEI = 10n ** 18n;
const NEED = { check: CHECK_BURN, apikey: KEY_BURN, core: CORE_BURN };

export const HOLDER_MSG = (addr) => 'Coreum holder check\n' + addr.toLowerCase();

export function makeCors({ sha, now }) {
  const addrOk = (a) => /^0x[0-9a-f]{40}$/.test(String(a || '').toLowerCase());

  // the site read the balance on chain; the signature proves the wallet is the asker's
  async function recordHolder(env, b) {
    const addr = String(b.addr || '').toLowerCase();
    if (!addrOk(addr)) return { e: 'bad address', s: 400 };
    if (!b.signed_in) {
      let who = '';
      try { who = verifyMessage(HOLDER_MSG(addr), String(b.sig || '')).toLowerCase(); }
      catch { return { e: 'bad signature', s: 400 }; }
      if (who !== addr) return { e: 'signature does not match the address', s: 403 };
    }
    const amount = BigInt(String(b.amount || '0'));
    if (amount < HOLDER_MIN * WEI) return { ok: false, amount: String(amount / WEI), need: String(HOLDER_MIN) };
    await env.DB.prepare('INSERT INTO holders(addr,amount,ts) VALUES(?,?,?) ON CONFLICT(addr) DO UPDATE SET amount=excluded.amount,ts=excluded.ts')
      .bind(addr, String(amount), now()).run();
    return { ok: true, amount: String(amount / WEI), per_day: HOLDER_PER_DAY };
  }

  async function isHolder(env, addr) {
    const a = String(addr || '').toLowerCase();
    if (!addrOk(a)) return false;
    const r = await env.DB.prepare('SELECT amount, ts FROM holders WHERE addr=?').bind(a).first();
    return !!r && now() - r.ts < HOLDER_FRESH && BigInt(r.amount || '0') >= HOLDER_MIN * WEI;
  }

  // a burn the site verified on chain; each tx counts once, for one purpose
  async function recordBurn(env, b) {
    const tx = String(b.tx || '').toLowerCase(), addr = String(b.addr || '').toLowerCase(), purpose = String(b.purpose || '');
    if (!/^0x[0-9a-f]{64}$/.test(tx) || !addrOk(addr) || !(purpose in NEED)) return { e: 'bad burn', s: 400 };
    const amount = BigInt(String(b.amount || '0'));
    if (amount < NEED[purpose] * WEI) return { e: `burn at least ${NEED[purpose]} CORS for this`, s: 402 };
    const prev = await env.DB.prepare('SELECT purpose, used FROM paid_burns WHERE tx=?').bind(tx).first();
    if (prev) return prev.purpose === purpose && !prev.used ? { ok: true } : { e: 'this burn was already used', s: 409 };
    await env.DB.prepare('INSERT INTO paid_burns(tx,addr,amount,purpose,ts,used) VALUES(?,?,?,?,?,0)').bind(tx, addr, String(amount), purpose, now()).run();
    return { ok: true };
  }

  /** Spend a recorded burn once; returns its wallet and amount, or null. */
  async function useBurn(env, tx, purpose) {
    const t = String(tx || '').toLowerCase();
    const r = await env.DB.prepare('UPDATE paid_burns SET used=1 WHERE tx=? AND purpose=? AND used=0 RETURNING addr, amount').bind(t, purpose).first();
    return r || null;
  }
  const burnReady = async (env, tx, purpose) =>
    !!(await env.DB.prepare('SELECT 1 FROM paid_burns WHERE tx=? AND purpose=? AND used=0').bind(String(tx || '').toLowerCase(), purpose).first());

  async function createKey(env, b) {
    const burn = await useBurn(env, b.tx, 'apikey');
    if (!burn) return { e: 'no unused API-key burn for that tx', s: 402 };
    const key = 'cak_' + crypto.randomUUID().replaceAll('-', '');
    const expires = now() + KEY_DAYS * 86400;
    await env.DB.prepare('INSERT INTO api_keys(key_hash,addr,quota,expires,created,tx) VALUES(?,?,?,?,?,?)')
      .bind(await sha(key), burn.addr, KEY_QUOTA, expires, now(), String(b.tx).toLowerCase()).run();
    return { key, quota: KEY_QUOTA, expires };
  }

  async function apiKey(env, key) {
    if (!/^cak_[0-9a-f]{32}$/.test(key || '')) return null;
    const h = await sha(key);
    const r = await env.DB.prepare('SELECT quota, expires FROM api_keys WHERE key_hash=?').bind(h).first();
    return r && r.expires > now() ? { id: h.slice(0, 16), quota: r.quota } : null;
  }

  async function status(env) {
    const [holders, burns, keys] = await Promise.all([
      env.DB.prepare('SELECT COUNT(*) n FROM holders WHERE ts>?').bind(now() - HOLDER_FRESH).first(),
      env.DB.prepare('SELECT purpose, COUNT(*) n FROM paid_burns GROUP BY purpose').all(),
      env.DB.prepare('SELECT COUNT(*) n FROM api_keys WHERE expires>?').bind(now()).first(),
    ]);
    return {
      holder_min: String(HOLDER_MIN), holder_per_day: HOLDER_PER_DAY, check_burn: String(CHECK_BURN),
      key_burn: String(KEY_BURN), key_quota: KEY_QUOTA, key_days: KEY_DAYS, core_burn: String(CORE_BURN),
      holders: holders.n, burns: Object.fromEntries(burns.results.map((r) => [r.purpose, r.n])), live_keys: keys.n,
    };
  }

  return { recordHolder, isHolder, recordBurn, useBurn, burnReady, createKey, apiKey, status };
}
