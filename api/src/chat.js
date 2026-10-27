// Ask Coreum: a chat assistant for Robinhood Chain tokens. It answers from the
// network's own data through tools (checks, deployer history, radar, ticker
// search) and never invents facts. A fresh check is started by the site under
// the visitor's own limits; this only says which addresses need one.
const SITE = 'https://www.coreum.xyz';
const CHAT_PER_DAY = 30;
export const CHAT_HOLDER_PER_DAY = 150;
const MAX_ROUNDS = 4;

const SYSTEM = "You are Ask Coreum, the AI assistant on coreum.xyz. Be as helpful, warm and sharp as the best AI assistants: answer any question well, including general crypto, DeFi, trading concepts, coding and everyday questions.\n\nAbout Coreum: a DePIN network of AI cores on Robinhood Chain (an Ethereum L2, chain id 4663). Six cores (Llama, Mistral, Qwen, Gemma, GPT-OSS, DeepSeek) check tokens with commit-reveal; the majority verdict is sealed in a public hash-chained ledger and on chain. Grades A to F come from on-chain facts: owner, honeypot, holders, deployer history, snipers, liquidity, dumps.\n$CORS is the network token (0x3a2ec7aeb4b3c3d6ae9ff6f390bc9da05a8cb945, launched on Pons). Hold 1,000,000 for 200 checks a day instead of 50; burn 100,000 for one more check; burn 1,000,000 for an API key (500 checks a day, 30 days); burn 100,000 for a verified core. A grade is never for sale.\nPages: /token (Token Check), /swap (Safe Swap), /grades, /watch, /stocks, /pons (Pons census), /radar, /cores, /nodes (run a core), /cohort (first 50 cores), /cors, /developers (API, MCP, badge), /ledger, /evidence.\n\nRules for tokens and wallets on Robinhood Chain:\n- Get facts only from tools. Never guess a grade, price, holder count or who launched what.\n- A ticker can belong to several tokens: use find_ticker, say which one has the most liquidity and pools, and that the others only share the name.\n- No check or an old one: call token_check with fresh=true. The site starts the check and shows its link under your answer; say it takes about a minute. Do not invent a link for it.\n- When a check exists, give its proof link https://www.coreum.xyz/v/ID.\n- You are a risk screen, not a financial adviser: never tell anyone to buy or sell, never predict prices.\n\nStyle: Reply in the language of the user's latest message, even if earlier messages were in another language. Lead with the answer. Use markdown: **bold** for the key fact, short bullet lists, inline code for addresses. Never announce that you are about to look something up; just call the tool. Keep it tight: no filler, no repeating the question, no headers for short answers.";

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
// one retry on a busy upstream; a failure is an error, never an empty answer
const getJ = async (url, tries = 2) => {
  const r = await fetch(url, { headers: { accept: 'application/json', 'user-agent': 'coreum.xyz' }, signal: AbortSignal.timeout(15000) });
  if (r.ok) return r.json();
  if (tries > 1) { await new Promise((ok) => setTimeout(ok, 1500)); return getJ(url, tries - 1); }
  throw new Error(`lookup failed (${r.status}); say the search is unavailable right now, not that nothing exists`);
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
      // searched by the site (GeckoTerminal + DexScreener turn away Worker IPs)
      const q = String(args.ticker || '').replace(/^\$/, '').trim().slice(0, 30);
      if (!q) return { error: 'empty ticker' };
      const j = await getJ(`${SITE}/api/ticker?q=${encodeURIComponent(q)}`);
      const list = (j.tokens || []).slice(0, 8);
      for (const t of list) t.on_pons = !!(await env.DB.prepare('SELECT 1 FROM pons_tokens WHERE token=?').bind(t.address).first());
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

  const STATUS = {
    token_check: (a) => `Reading Coreum's check of ${String(a.address || '').slice(0, 8)}…`,
    find_ticker: (a) => `Searching Robinhood Chain for ${String(a.ticker || '').replace(/^\$/, '')}`,
    deployer: () => "Reading the deployer's launch history",
    radar: () => 'Reading the radar',
    network: () => 'Reading network stats',
  };

  // DeepSeek streamed: text goes out as it arrives, tool calls are collected
  async function streamRound(env, messages, send) {
    const r = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.DEEPSEEK_API_KEY },
      body: JSON.stringify({ model: 'deepseek-chat', messages, tools: TOOLS.map((f) => ({ type: 'function', function: f })), max_tokens: 1200, temperature: 0.4, stream: true }),
      signal: AbortSignal.timeout(60000),
    });
    if (!r.ok || !r.body) throw new Error('the model is busy, try again in a minute');
    const reader = r.body.getReader(), dec = new TextDecoder();
    let buf = '', content = '';
    const calls = [];
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        let d;
        try { d = JSON.parse(data).choices?.[0]?.delta; } catch { continue; }
        if (!d) continue;
        if (d.content) { content += d.content; await send({ type: 'delta', text: d.content }); }
        for (const t of d.tool_calls || []) {
          const c = (calls[t.index] ||= { id: '', name: '', args: '' });
          if (t.id) c.id = t.id;
          if (t.function?.name) c.name += t.function.name;
          if (t.function?.arguments) c.args += t.function.arguments;
        }
      }
    }
    const list = calls.filter(Boolean);
    return {
      content, calls: list,
      raw: { role: 'assistant', content, ...(list.length ? { tool_calls: list.map((c) => ({ id: c.id, type: 'function', function: { name: c.name, arguments: c.args } })) } : {}) },
    };
  }

  /** Check the daily limit and count the message; returns the trimmed history or an error. */
  async function admit(env, body, asker, perDay = CHAT_PER_DAY) {
    const day = new Date(now() * 1000).toISOString().slice(0, 10);
    const key = await sha('chat' + asker);
    const used = (await env.DB.prepare('SELECT n FROM chat_use WHERE asker=? AND day=?').bind(key, day).first())?.n || 0;
    if (used >= perDay) return { e: `daily limit: ${perDay} messages. Holders of 1M $CORS get ${CHAT_HOLDER_PER_DAY}: coreum.xyz/cors`, s: 429 };
    const hist = (Array.isArray(body.messages) ? body.messages : [])
      .filter((m) => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
      .slice(-20)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
    if (!hist.length || hist[hist.length - 1].role !== 'user') return { e: 'send a message', s: 400 };
    await env.DB.prepare('INSERT INTO chat_use(asker,day,n) VALUES(?,?,1) ON CONFLICT(asker,day) DO UPDATE SET n=n+1').bind(key, day).run();
    return { hist, left: perDay - used - 1 };
  }

  // the conversation as events: status | delta | checks | done | error
  async function run(env, hist, left, send) {
    // the latest message decides the language, not the history
    const last = hist[hist.length - 1].content;
    const lang = /[а-яёіїєґ]/i.test(last) ? (/[іїєґ]/i.test(last) ? 'Ukrainian' : 'Russian') : /^[ -s$€£…–—'"“”‘’]*$/.test(last) ? 'English' : '';
    const messages = [{ role: 'system', content: SYSTEM }, ...hist];
    if (lang) messages.push({ role: 'system', content: `The user's latest message is in ${lang}. Write your whole answer in ${lang}.` });
    const checks = [];
    try {
      for (let round = 0; round <= MAX_ROUNDS; round++) {
        const m = env.DEEPSEEK_API_KEY ? await streamRound(env, messages, send) : await complete(env, messages);
        if (!env.DEEPSEEK_API_KEY && m.content) await send({ type: 'delta', text: m.content });
        if (!m.calls.length || round === MAX_ROUNDS) break;
        if (m.content) await send({ type: 'reset' }); // "let me look that up" before a tool call is not the answer
        messages.push(m.raw);
        for (const c of m.calls) {
          let args = c.args;
          try { if (typeof args === 'string') args = JSON.parse(args || '{}'); } catch { args = {}; }
          await send({ type: 'status', text: (STATUS[c.name] || (() => 'Working'))(args || {}) });
          let result;
          try { result = await runTool(env, c.name, args || {}, checks); } catch (e) { result = { error: String(e?.message || e) }; }
          messages.push({ role: 'tool', tool_call_id: c.id, content: JSON.stringify(result).slice(0, 6000) });
        }
      }
      if (checks.length) await send({ type: 'checks', addresses: checks });
      await send({ type: 'done', left });
    } catch (e) {
      await send({ type: 'error', text: String(e?.message || e) });
    }
  }

  return { admit, run };
}
