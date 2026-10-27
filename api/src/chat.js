// Ask Coreum: a chat assistant for Robinhood Chain tokens. It answers from the
// network's own data through tools (checks, deployer history, radar, ticker
// search) and never invents facts. A fresh check is started by the site under
// the visitor's own limits; this only says which addresses need one.
const SITE = 'https://www.coreum.xyz';
const CHAT_PER_DAY = 30;
export const CHAT_HOLDER_PER_DAY = 150;
const MAX_ROUNDS = 4;

const SYSTEM = `You are Ask Coreum, the assistant on coreum.xyz.
Coreum is a DePIN network of AI cores on Robinhood Chain (an Ethereum L2, chain id 4663). Six cores (Llama, Mistral, Qwen, Gemma, GPT-OSS, DeepSeek) check tokens with commit-reveal; the majority verdict is sealed in a public hash-chained ledger and on chain. Grades A to F come from on-chain facts: owner, honeypot, holders, deployer history, snipers, liquidity, dumps.
$CORS is the network token (0x3a2ec7aeb4b3c3d6ae9ff6f390bc9da05a8cb945, launched on Pons). Hold 1,000,000 for 200 checks a day instead of 50; burn 100,000 for one more check; burn 1,000,000 for an API key (500 checks a day, 30 days); burn 100,000 for a verified core. A grade is never for sale.
Pages: /token (Token Check), /swap (Safe Swap), /grades, /watch, /stocks, /pons (Pons census), /radar, /cores, /nodes (run a core), /cohort (first 50 cores), /cors, /developers (API, MCP, badge), /ledger, /evidence.

Rules:
- For anything about a specific token or wallet, call a tool. Never guess facts, grades or prices.
- A ticker can belong to several tokens. Use find_ticker and say clearly which one is the real or biggest, and that the others share the name.
- If a token has no check or an old one, call token_check with fresh=true: the site starts a check for the user and shows the link below your answer. Tell them it takes about a minute.
- Always give the proof link (coreum.xyz/v/ID) when a check exists.
- You are a risk screen, not a financial adviser: never tell anyone to buy or sell, never predict prices.
- Answer in the user's language. Be short: a few lines, plain text, no tables, no markdown headers. Full links like https://www.coreum.xyz/v/359.`;

const TOOLS = [
  { name: 'token_check', description: "Coreum's latest check of a token on Robinhood Chain by contract address: grade, verdict, red flags, facts, proof link.",
    parameters: { type: 'object', properties: { address: { type: 'string', description: '0x… token contract address' }, fresh: { type: 'boolean', description: 'true to have a new check started for the user' } }, required: ['address'] } },
  { name: 'find_ticker', description: 'Find tokens on Robinhood Chain by ticker or name. Returns every contract using it, with size, so copycats can be told apart.',
    parameters: { type: 'object', properties: { ticker: { type: 'string' } }, required: ['ticker'] } },
  { name: 'deployer', description: "A wallet's launch history on Pons: how many tokens it launched, graduated, died. Works for a token address too (uses its creator).",
    parameters: { type: 'object', properties: { address: { type: 'string' } }, required: ['address'] } },
  { name: 'radar', description: 'Recent token checks on Robinhood Chain (last 7 days) and the 24h tally of verdicts.', parameters: { type: 'object', properties: {} } },
  { name: 'network', description: 'Coreum network stats: jobs, agreement, cores online.', parameters: { type: 'object', properties: {} } },
];

const isAddr = (a) => /^0x[0-9a-fA-F]{40}$/.test(String(a || '').trim());
const getJ = async (url) => {
  const r = await fetch(url, { headers: { accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  return r.json();
};

export function makeChat({ V, now, sha }) {
  async function runTool(env, name, args, checks) {
    if (name === 'token_check') {
      const a = String(args.address || '').trim().toLowerCase();
      if (!isAddr(a)) return { error: 'not a contract address; use find_ticker for a name' };
      const c = await getJ(`${SITE}/api/v1/token/${a}`);
      const stale = c.status === 'not_checked' || (c.age_hours ?? 0) > 6;
      if ((args.fresh || stale) && !checks.includes(a) && checks.length < 2) checks.push(a);
      const { badge, image, disclaimer, ...rest } = c;
      return { ...rest, fresh_check: checks.includes(a) ? 'a new check is being started for the user; the link appears under your answer' : undefined };
    }
    if (name === 'find_ticker') {
      const q = String(args.ticker || '').replace(/^\$/, '').trim().slice(0, 30);
      if (!q) return { error: 'empty ticker' };
      const j = await getJ(`https://api.geckoterminal.com/api/v2/search/pools?query=${encodeURIComponent(q)}`);
      const by = {};
      for (const p of j.data || []) {
        const tok = p.relationships?.base_token?.data?.id || '';
        if (!tok.startsWith('robinhood_')) continue;
        const addr = tok.slice('robinhood_'.length).toLowerCase();
        const t = (by[addr] ||= { address: addr, pair: p.attributes?.name, fdv_usd: 0, liquidity_usd: 0, pools: 0 });
        t.pools++;
        t.fdv_usd = Math.max(t.fdv_usd, Math.round(+p.attributes?.fdv_usd || 0));
        t.liquidity_usd += Math.round(+p.attributes?.reserve_in_usd || 0);
      }
      const list = Object.values(by).sort((x, y) => y.liquidity_usd - x.liquidity_usd).slice(0, 8);
      for (const t of list) {
        t.on_pons = !!(await env.DB.prepare('SELECT 1 FROM pons_tokens WHERE token=?').bind(t.address).first());
      }
      return { query: q, tokens: list, note: list.length > 1 ? 'several contracts share this name; the one with the most liquidity and pools is usually the real one, but check the project site' : undefined };
    }
    if (name === 'deployer') {
      let a = String(args.address || '').trim().toLowerCase();
      if (!isAddr(a)) return { error: 'not an address' };
      const t = await env.DB.prepare('SELECT creator FROM pons_tokens WHERE token=?').bind(a).first();
      if (t?.creator) a = t.creator.toLowerCase();
      const d = await getJ(`${SITE}/api/v1/deployer/${a}`);
      if (Array.isArray(d.tokens)) d.tokens = d.tokens.slice(0, 8);
      return { ...d, page: `${SITE}/deployer/${a}` };
    }
    if (name === 'radar') {
      const r = await V.radar(env);
      return {
        tally_24h: r.tally,
        recent: r.checks.slice(0, 15).map((c) => ({ symbol: c.src?.symbol, address: c.src?.address, verdict: c.verdict, agree: c.agree, proof: `${SITE}/v/${c.id}` })),
      };
    }
    if (name === 'network') return V.stats(env);
    return { error: 'unknown tool' };
  }

  // one model turn: DeepSeek when the key is set, Workers AI otherwise
  async function complete(env, messages) {
    if (env.DEEPSEEK_API_KEY) {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.DEEPSEEK_API_KEY },
        body: JSON.stringify({ model: 'deepseek-chat', messages, tools: TOOLS.map((f) => ({ type: 'function', function: f })), max_tokens: 600, temperature: 0.3 }),
        signal: AbortSignal.timeout(30000),
      });
      if (!r.ok) throw new Error('the model is busy, try again in a minute');
      const m = (await r.json())?.choices?.[0]?.message || {};
      return { content: m.content || '', calls: (m.tool_calls || []).map((c) => ({ id: c.id, name: c.function?.name, args: c.function?.arguments })), raw: m };
    }
    const out = await env.AI.run('@cf/meta/llama-3.3-70b-instruct-fp8-fast', { messages, tools: TOOLS, max_tokens: 600 });
    const calls = (out.tool_calls || []).map((c, i) => ({ id: 'c' + i, name: c.name, args: c.arguments }));
    return { content: out.response || '', calls, raw: { role: 'assistant', content: out.response || '', tool_calls: calls.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.args || {}) } })) } };
  }

  async function chat(env, body, asker, perDay = CHAT_PER_DAY) {
    const day = new Date(now() * 1000).toISOString().slice(0, 10);
    const key = await sha('chat' + asker);
    const used = (await env.DB.prepare('SELECT n FROM chat_use WHERE asker=? AND day=?').bind(key, day).first())?.n || 0;
    if (used >= perDay) return { e: `daily limit: ${perDay} messages. Holders of 1M $CORS get ${CHAT_HOLDER_PER_DAY}: coreum.xyz/cors`, s: 429 };
    const hist = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 1500) }));
    if (!hist.length || hist[hist.length - 1].role !== 'user' || !hist[hist.length - 1].content.trim()) return { e: 'send a message', s: 400 };
    await env.DB.prepare('INSERT INTO chat_use(asker,day,n) VALUES(?,?,1) ON CONFLICT(asker,day) DO UPDATE SET n=n+1').bind(key, day).run();

    const messages = [{ role: 'system', content: SYSTEM }, ...hist];
    const checks = [];
    for (let round = 0; round <= MAX_ROUNDS; round++) {
      const m = await complete(env, messages);
      if (!m.calls.length || round === MAX_ROUNDS) return { reply: m.content.trim() || 'I could not find an answer to that.', checks, left: perDay - used - 1 };
      messages.push(m.raw);
      for (const c of m.calls) {
        let args = c.args;
        try { if (typeof args === 'string') args = JSON.parse(args || '{}'); } catch { args = {}; }
        let result;
        try { result = await runTool(env, c.name, args || {}, checks); } catch (e) { result = { error: String(e?.message || e) }; }
        messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result).slice(0, 6000) });
      }
    }
  }

  return { chat };
}
