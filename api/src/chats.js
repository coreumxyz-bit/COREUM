// Ask Coreum history for signed-in wallets. The site verifies the session and
// passes the wallet; this keeps the conversations so they follow the wallet to
// any device. Only the site (with the shared secret) reaches these routes.
import { verifyMessage } from 'ethers';

const MAX_CHATS = 100;      // per wallet; the oldest go first
const MAX_BYTES = 300_000;  // one conversation

export function makeChats({ now }) {
  const addrOk = (a) => /^0x[0-9a-f]{40}$/.test(String(a || ''));

  /** Sign-in: the signed message must come from the wallet it names. */
  function verify(b) {
    const addr = String(b.addr || '').toLowerCase();
    if (!addrOk(addr) || !String(b.msg || '').includes(addr)) return { e: 'bad sign-in message', s: 400 };
    let who = '';
    try { who = verifyMessage(String(b.msg), String(b.sig || '')).toLowerCase(); } catch { return { e: 'bad signature', s: 400 }; }
    return who === addr ? { ok: true, addr } : { e: 'the signature is from another wallet', s: 403 };
  }

  async function list(env, addr) {
    if (!addrOk(addr)) return [];
    return (await env.DB.prepare('SELECT id, title, ts FROM chats WHERE addr=? ORDER BY ts DESC LIMIT ?').bind(addr, MAX_CHATS).all()).results;
  }

  async function one(env, addr, id) {
    const r = await env.DB.prepare('SELECT id, title, ts, msgs FROM chats WHERE addr=? AND id=?').bind(addr, String(id || '')).first();
    return r ? { ...r, msgs: JSON.parse(r.msgs) } : null;
  }

  async function save(env, b) {
    const addr = String(b.addr || '').toLowerCase(), id = String(b.id || '').slice(0, 40);
    if (!addrOk(addr) || !/^[a-z0-9]{4,40}$/.test(id)) return { e: 'bad chat', s: 400 };
    const msgs = (Array.isArray(b.msgs) ? b.msgs : [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant'))
      .map((m) => ({ role: m.role, content: String(m.content || '').slice(0, 8000), ...(Array.isArray(m.started) ? { started: m.started.slice(0, 3) } : {}), ...(m.error ? { error: String(m.error).slice(0, 300) } : {}) }));
    const json = JSON.stringify(msgs);
    if (json.length > MAX_BYTES) return { e: 'this conversation is too long to save, start a new chat', s: 413 };
    const ts = Math.min(Number(b.ts) || now() * 1000, now() * 1000 + 60_000);
    await env.DB.prepare('INSERT INTO chats(addr,id,title,ts,msgs) VALUES(?,?,?,?,?) ON CONFLICT(addr,id) DO UPDATE SET title=excluded.title, ts=excluded.ts, msgs=excluded.msgs')
      .bind(addr, id, String(b.title || 'Chat').slice(0, 80), ts, json).run();
    await env.DB.prepare('DELETE FROM chats WHERE addr=? AND id NOT IN (SELECT id FROM chats WHERE addr=? ORDER BY ts DESC LIMIT ?)').bind(addr, addr, MAX_CHATS).run();
    return { ok: true };
  }

  async function remove(env, addr, id) {
    await env.DB.prepare('DELETE FROM chats WHERE addr=? AND id=?').bind(String(addr || '').toLowerCase(), String(id || '')).run();
    return { ok: true };
  }

  return { verify, list, one, save, remove };
}
