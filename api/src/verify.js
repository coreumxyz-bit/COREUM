// Coreum verification network.
//
// A question becomes a job. Cores answer it independently and first send only
// a commitment, sha256(job|verdict|reason|salt), so nobody can copy another
// core's answer. Once commits are in, cores reveal; the server checks every
// reveal against its commitment. The majority verdict (YES / NO / UNSURE),
// the agreement ratio and every core's commitment are sealed in the ledger.
//
// Reference cores run here on different open models (Workers AI + one free
// public endpoint) so the network answers from day one. Anyone can run a core
// on their own machine with coreumd (local model via Ollama).

const COMMIT_MAX = 30;      // s — commit phase hard stop
const COMMIT_MAX_COMMUNITY = 60; // s — hard stop while a community core is online
const COMMUNITY_WAIT = 45;  // s — hold commits open this long for a community core
const ONLINE_WINDOW = 600;  // s — a core that polled this recently counts as online
const COMMIT_GRACE = 8;     // s — after quorum, wait this long for more cores
const REVEAL_MAX = 25;      // s — reveal phase hard stop
const QUORUM = 3;
const REWARD = 0.5;         // $CORS accrued per core that lands in the majority
const ASK_PER_IP = 50;      // per day
const ASK_GLOBAL = 1500;    // per day (Workers Paid plan)
const VERDICTS = ['YES', 'NO', 'UNSURE'];

export const REF_CORES = [
  { id: 'ref-llama', name: 'Ref · Llama 3.3 70B', handle: 'ref-llama', model: '@cf/meta/llama-3.3-70b-instruct-fp8-fast' },
  { id: 'ref-mistral', name: 'Ref · Mistral Small 3.1', handle: 'ref-mistral', model: '@cf/mistralai/mistral-small-3.1-24b-instruct' },
  { id: 'ref-qwen', name: 'Ref · Qwen3 30B', handle: 'ref-qwen', model: '@cf/qwen/qwen3-30b-a3b-fp8' },
  { id: 'ref-gemma', name: 'Ref · Gemma 4 26B', handle: 'ref-gemma', model: '@cf/google/gemma-4-26b-a4b-it' },
  { id: 'ref-gptoss', name: 'Ref · GPT-OSS 20B', handle: 'ref-gptoss', model: '@cf/openai/gpt-oss-20b' },
  // DeepSeek V3 through DeepSeek's own API — joins only when the Worker has the key
  { id: 'ref-deepseek', name: 'Ref · DeepSeek V3', handle: 'ref-deepseek', model: 'deepseek:deepseek-chat', needs: 'DEEPSEEK_API_KEY' },
];

/** The reference cores this Worker can run (a core that needs a key sits out without it). */
export const activeCores = (env) => REF_CORES.filter((c) => !c.needs || env[c.needs]);

export const corePrompt = (q, date) =>
  `You are an independent verification core in the Coreum network. Today is ${date}.\n` +
  `Evaluate the statement or question below on your own knowledge.\n` +
  `- YES: it is true / the answer is yes, and this is well established.\n` +
  `- NO: it is false / the answer is no.\n` +
  `- UNSURE: it depends on opinion, on the future, on facts you cannot know, or the evidence is mixed.\n` +
  `Answer NO only when you know a specific fact that contradicts it. If the subject (a product, chain, token, event) may be newer than your training data or you know little about it, answer UNSURE: never guess.\n` +
  `Reply with JSON only, no prose around it: {"verdict":"YES|NO|UNSURE","reason":"one sentence, max 30 words"}\n\n` +
  `Statement: ${q}`;

// Models wrap JSON in prose or code fences; take the first verdict word found.
export function parseAnswer(text) {
  const t = String(text || '').replace(/<think>[\s\S]*?<\/think>/g, '');
  let verdict = null, reason = '';
  // some models think out loud before the JSON: use the last object that has a verdict
  for (const m of [...t.matchAll(/\{[^{}]*"verdict"[^{}]*\}/g)].reverse()) {
    try {
      const j = JSON.parse(m[0]);
      verdict = String(j.verdict || '').toUpperCase().trim();
      reason = String(j.reason || '');
      if (VERDICTS.includes(verdict)) break;
    } catch (e) {}
  }
  if (!VERDICTS.includes(verdict)) {
    const w = t.toUpperCase().match(/\b(YES|NO|UNSURE)\b/);
    verdict = w ? w[1] : 'UNSURE';
    reason = reason || t;
  }
  reason = reason.replace(/\s+/g, ' ').trim().slice(0, 240);
  return { verdict, reason };
}

// Models return a string, an already-parsed object, chat choices, or Responses output.
function textOf(out) {
  if (out == null) return '';
  if (typeof out === 'string') return out;
  const r = out.response;
  if (typeof r === 'string') return r;
  // Workers AI may hand back the model's JSON already parsed, or nest a whole chat completion
  if (r && typeof r === 'object') return r.choices || r.output ? textOf(r) : JSON.stringify(r);
  const msg = out.choices?.[0]?.message;
  if (typeof msg?.content === 'string' && msg.content.trim()) return msg.content;
  // reasoning models may leave content empty and put everything in reasoning
  if (typeof msg?.reasoning_content === 'string' && msg.reasoning_content.trim()) return msg.reasoning_content;
  if (typeof out.output_text === 'string') return out.output_text;
  if (Array.isArray(out.output)) {
    const parts = out.output.flatMap(o => o.content || []).map(c => c.text || '').filter(Boolean);
    if (parts.length) return parts.join(' ');
  }
  return ''; // no answer text: the core sits this job out
}

export function makeVerify({ append, sha, now }) {
  const commitOf = (job, verdict, reason, salt) => sha(`${job}|${verdict}|${reason}|${salt}`);
  const salt = () => [...crypto.getRandomValues(new Uint8Array(16))].map(b => b.toString(16).padStart(2, '0')).join('');

  async function ensureRefCores(env) {
    const db = env.DB;
    for (const c of activeCores(env)) {
      await db.prepare(
        "INSERT OR IGNORE INTO agents(id,name,handle,persona,kind,strat,focus,rate,created,cors_paid,cors_staked,cors_earned) VALUES(?,?,?,?,'refcore','verify','',0,?,0,0,0)"
      ).bind(c.id, c.name, c.handle, `Reference verification core run by Coreum on ${c.model.replace(/^@cf\//, '').replace(/^deepseek:/, 'the DeepSeek API, ')}.`, now()).run();
    }
  }

  async function runModel(env, model, prompt) {
    if (model.startsWith('deepseek:')) {
      const r = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + env.DEEPSEEK_API_KEY },
        body: JSON.stringify({ model: model.split(':')[1], messages: [{ role: 'user', content: prompt }], max_tokens: 300, temperature: 0 }),
        signal: AbortSignal.timeout(25000),
      });
      if (!r.ok) throw new Error('deepseek ' + r.status);
      const j = await r.json();
      return j?.choices?.[0]?.message?.content || '';
    }
    if (model.startsWith('pollinations:')) {
      const r = await fetch('https://text.pollinations.ai/openai', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model: model.split(':')[1], messages: [{ role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(20000),
      });
      if (!r.ok) throw new Error('pollinations ' + r.status);
      const j = await r.json();
      return j?.choices?.[0]?.message?.content || '';
    }
    if (!env.AI) throw new Error('no AI binding');
    // gpt-oss speaks the Responses format; the rest take chat messages
    const input = model.includes('gpt-oss')
      ? { input: prompt, reasoning: { effort: 'low' } }
      : {
          // Qwen3 reasons by default and can spend the whole budget thinking; /no_think turns that off
          messages: [{ role: 'user', content: model.includes('qwen3') ? prompt + '\n/no_think' : prompt }],
          max_tokens: model.includes('gemma') ? 1400 : 700, // gemma thinks before it answers
        };
    return textOf(await env.AI.run(model, input));
  }

  // Reference cores compute and commit right away; their plaintext stays
  // server-side (unrevealed) until the job enters the reveal phase.
  async function runRefCores(env, job) {
    const db = env.DB;
    const date = new Date().toISOString().slice(0, 10);
    await Promise.all(activeCores(env).map(async c => {
      try {
        const text = await runModel(env, c.model, corePrompt(job.q, date));
        if (!text.trim()) throw new Error('empty answer'); // no vote rather than a guessed one
        const { verdict, reason } = parseAnswer(text);
        const s = salt();
        const h = await commitOf(job.id, verdict, reason, s);
        await db.prepare(
          'INSERT OR IGNORE INTO job_work(job,core,model,commit_h,ts_commit,verdict,reason,salt) VALUES(?,?,?,?,?,?,?,?)'
        ).bind(job.id, c.id, c.model, h, now(), verdict, reason, s).run();
        await db.prepare('UPDATE agents SET last_seen=? WHERE id=?').bind(now(), c.id).run();
      } catch (e) {
        console.error('ref core ' + c.id + ' failed: ' + (e.message || e));
      }
    }));
    await advance(env, job.id);
  }

  // community (non-reference) cores that polled for work recently
  const communityOnline = async (db, t) =>
    (await db.prepare("SELECT COUNT(*) c FROM agents WHERE kind='external' AND last_seen>?").bind(t - ONLINE_WINDOW).first()).c;

  // Move a job forward by time and by who has committed / revealed.
  async function advance(env, id) {
    const db = env.DB, t = now();
    const job = await db.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();
    if (!job || job.phase === 'done' || job.phase === 'failed' || job.phase === 'sealing') return job;
    const works = (await db.prepare('SELECT * FROM job_work WHERE job=?').bind(id).all()).results;

    if (job.phase === 'commit') {
      const enough = works.length >= QUORUM;
      const lastCommit = Math.max(0, ...works.map(w => w.ts_commit));
      // a community core runs a local model on ordinary hardware and needs longer than
      // our cloud cores: while one is online, hold commits open for it before closing early
      const communityIn = works.some(w => !w.core.startsWith('ref-'));
      const waitForCommunity = !communityIn && t - job.created < COMMUNITY_WAIT && (await communityOnline(db, t)) > 0;
      if (t >= job.commit_dl || (enough && !waitForCommunity && t - lastCommit >= COMMIT_GRACE) || works.length >= activeCores(env).length + 4) {
        // reference cores reveal the moment commits close
        for (const w of works) {
          if (w.core.startsWith('ref-') && w.verdict && !w.ts_reveal)
            await db.prepare('UPDATE job_work SET ts_reveal=?, ok=1 WHERE job=? AND core=?').bind(t, id, w.core).run();
        }
        await db.prepare("UPDATE jobs SET phase='reveal', reveal_dl=? WHERE id=?").bind(t + REVEAL_MAX, id).run();
        return advance(env, id);
      }
      return job;
    }

    // reveal phase: finish when every committer revealed or time is up
    const pending = works.filter(w => !w.ts_reveal);
    if (pending.length && t < job.reveal_dl) return job;

    const valid = works.filter(w => w.ok === 1);
    if (valid.length < QUORUM) {
      await db.prepare("UPDATE jobs SET phase='failed', n=?, done_at=? WHERE id=?").bind(valid.length, t, id).run();
      return db.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();
    }
    const tally = { YES: 0, NO: 0, UNSURE: 0 };
    for (const w of valid) tally[w.verdict]++;
    // ties go to UNSURE: the network does not guess
    const top = Math.max(tally.YES, tally.NO, tally.UNSURE);
    const leaders = VERDICTS.filter(v => tally[v] === top);
    const verdict = leaders.length > 1 ? 'UNSURE' : leaders[0];
    const agree = tally[verdict] / valid.length;
    const qh = await sha(job.q);
    // the cron sweep and page polls can reach this at the same moment: only the
    // caller that flips reveal → sealing writes the verdict, so it is sealed once
    const claim = await db.prepare("UPDATE jobs SET phase='sealing' WHERE id=? AND phase='reveal'").bind(id).run();
    if (!claim.meta?.changes) return db.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();
    let h;
    try {
      h = await append(db, 'verify', {
        job: id, q: job.q, qh, verdict, agree, n: valid.length, tally,
        work: works.map(w => ({ core: w.core, model: w.model, commit: w.commit_h, verdict: w.ok === 1 ? w.verdict : null })),
      });
    } catch (e) {
      await db.prepare("UPDATE jobs SET phase='reveal' WHERE id=? AND phase='sealing'").bind(id).run(); // retry next sweep
      throw e;
    }
    await db.prepare("UPDATE jobs SET phase='done', verdict=?, agree=?, n=?, h=?, done_at=? WHERE id=?")
      .bind(verdict, agree, valid.length, h, t, id).run();
    for (const w of valid.filter(w => w.verdict === verdict)) {
      await db.prepare('UPDATE job_work SET reward=? WHERE job=? AND core=?').bind(REWARD, id, w.core).run();
      await db.prepare('UPDATE agents SET cors_earned=cors_earned+? WHERE id=?').bind(REWARD, w.core).run();
    }
    return db.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();
  }

  // src: the X post a job checks ({url, id, author, handle, avatar}) — only
  // accepted from our own site, which fetched it, so nobody can put words in
  // a real account's mouth through the API.
  async function ask(env, ctx, q, askerHash, src = null, perDay = ASK_PER_IP) {
    const db = env.DB, t = now();
    q = String(q || '').replace(/\s+/g, ' ').trim();
    const max = src?.kind === 'token' ? 1000 : src ? 700 : 300; // a token check quotes its facts
    if (q.length < 8 || q.length > max) return { e: `question must be 8–${max} characters`, s: 400 };
    if ((await db.prepare('SELECT COUNT(*) c FROM jobs WHERE asker=? AND created>?').bind(askerHash, t - 86400).first()).c >= perDay)
      return { e: `daily limit: ${perDay} questions`, s: 429 };
    if ((await db.prepare('SELECT COUNT(*) c FROM jobs WHERE created>?').bind(t - 86400).first()).c >= ASK_GLOBAL)
      return { e: 'the network is at its daily capacity, try again tomorrow', s: 429 };
    await ensureRefCores(env);
    const r = await db.prepare('INSERT INTO jobs(q,asker,created,commit_dl,src) VALUES(?,?,?,?,?) RETURNING *')
      .bind(q, askerHash, t, t + ((await communityOnline(db, t)) > 0 ? COMMIT_MAX_COMMUNITY : COMMIT_MAX), src ? JSON.stringify(src) : null).first();
    ctx.waitUntil(runRefCores(env, r));
    return { id: r.id, phase: r.phase, commit_dl: r.commit_dl };
  }

  // Public view of a job: hide every answer until it is revealed.
  async function view(env, id) {
    const job = await advance(env, id);
    if (!job) return null;
    const works = (await env.DB.prepare(
      'SELECT w.*, a.name, a.handle, a.kind FROM job_work w JOIN agents a ON a.id=w.core WHERE w.job=? ORDER BY w.ts_commit'
    ).bind(id).all()).results;
    // ledger position of the sealed result — tells the page which anchor covers it
    const blk = job.h ? await env.DB.prepare('SELECT i FROM ledger WHERE hash=?').bind(job.h).first() : null;
    return {
      id: job.id, q: job.q, phase: job.phase, created: job.created, commit_dl: job.commit_dl, reveal_dl: job.reveal_dl,
      verdict: job.verdict, agree: job.agree, n: job.n, h: job.h, block_i: blk ? blk.i : null, done_at: job.done_at,
      src: job.src ? JSON.parse(job.src) : null,
      chain_tx: job.chain_tx || null,
      work: works.map(w => {
        const shown = !!w.ts_reveal;
        return {
          core: w.core, name: w.name, handle: w.handle, kind: w.kind, model: w.model, commit: w.commit_h,
          ts_commit: w.ts_commit, ts_reveal: w.ts_reveal, ok: w.ok, reward: w.reward,
          verdict: shown ? w.verdict : null, reason: shown ? w.reason : null, salt: shown ? w.salt : null,
        };
      }),
    };
  }

  // ---- external cores (coreumd): authenticated by their agent key ----
  async function work(env, core) {
    const db = env.DB, t = now();
    await db.prepare('UPDATE agents SET last_seen=? WHERE id=?').bind(t, core.id).run();
    const commit = (await db.prepare(
      "SELECT id,q FROM jobs WHERE phase='commit' AND commit_dl>? AND id NOT IN (SELECT job FROM job_work WHERE core=?) ORDER BY id LIMIT 5"
    ).bind(t, core.id).all()).results;
    const reveal = (await db.prepare(
      "SELECT j.id FROM jobs j JOIN job_work w ON w.job=j.id WHERE j.phase='reveal' AND w.core=? AND w.ts_reveal IS NULL LIMIT 10"
    ).bind(core.id).all()).results;
    return { commit, reveal: reveal.map(r => r.id), date: new Date().toISOString().slice(0, 10) };
  }

  async function commit(env, core, b) {
    const db = env.DB, id = +b.job, h = String(b.hash || '');
    if (!/^[0-9a-f]{64}$/.test(h)) return { e: 'hash must be 64 hex chars', s: 400 };
    const job = await db.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();
    if (!job || job.phase !== 'commit' || now() >= job.commit_dl) return { e: 'job is not taking commits', s: 409 };
    await db.prepare('INSERT OR IGNORE INTO job_work(job,core,model,commit_h,ts_commit) VALUES(?,?,?,?,?)')
      .bind(id, core.id, String(b.model || 'unknown').slice(0, 60), h, now()).run();
    await advance(env, id);
    return { ok: 1 };
  }

  async function reveal(env, core, b) {
    const db = env.DB, id = +b.job;
    const w = await db.prepare('SELECT * FROM job_work WHERE job=? AND core=?').bind(id, core.id).first();
    const job = await db.prepare('SELECT * FROM jobs WHERE id=?').bind(id).first();
    if (!w || !job) return { e: 'no commitment from this core', s: 404 };
    if (job.phase !== 'reveal' || w.ts_reveal) return { e: 'not in reveal phase', s: 409 };
    const verdict = String(b.verdict || '').toUpperCase();
    const reason = String(b.reason || '').slice(0, 240);
    const s = String(b.salt || '');
    const ok = VERDICTS.includes(verdict) && (await commitOf(id, verdict, reason, s)) === w.commit_h ? 1 : 0;
    await db.prepare('UPDATE job_work SET verdict=?, reason=?, salt=?, ts_reveal=?, ok=? WHERE job=? AND core=?')
      .bind(verdict, reason, s, now(), ok, id, core.id).run();
    await advance(env, id);
    return { ok, error: ok ? undefined : 'reveal does not match the commitment' };
  }

  async function sweep(env) {
    const rows = (await env.DB.prepare("SELECT id FROM jobs WHERE phase IN ('commit','reveal') LIMIT 50").all()).results;
    for (const r of rows) await advance(env, r.id);
  }

  async function cores(env) {
    await ensureRefCores(env);
    return (await env.DB.prepare(
      `SELECT a.id,a.name,a.handle,a.kind,a.last_seen,a.cors_earned,
        (SELECT COUNT(*) FROM job_work w WHERE w.core=a.id) jobs,
        (SELECT COUNT(*) FROM job_work w WHERE w.core=a.id AND w.reward>0) majority,
        (SELECT model FROM job_work w WHERE w.core=a.id ORDER BY ts_commit DESC LIMIT 1) model
       FROM agents a WHERE a.kind IN ('refcore','external') OR EXISTS(SELECT 1 FROM job_work w WHERE w.core=a.id)
       ORDER BY jobs DESC`
    ).all()).results;
  }

  async function recent(env, n) {
    return (await env.DB.prepare(
      "SELECT id,q,phase,verdict,agree,n,h,created,done_at,src FROM jobs WHERE phase IN ('done','failed') ORDER BY id DESC LIMIT ?"
    ).bind(n).all()).results;
  }

  // finished token checks, newest first
  // Pons Radar: token checks of the last 7 days with a 24h tally, and which
  // addresses were already checked so the hourly run never repeats one
  async function radar(env) {
    const t = now();
    const rows = (await env.DB.prepare(
      "SELECT id,verdict,agree,n,done_at,src FROM jobs WHERE phase='done' AND json_extract(src,'$.kind')='token' AND done_at>? ORDER BY id DESC LIMIT 120"
    ).bind(t - 7 * 86400).all()).results.map((r) => ({ ...r, src: JSON.parse(r.src) }));
    const day = rows.filter((r) => r.done_at > t - 86400);
    const tally = { total: day.length, radar: day.filter((r) => r.src.via === 'radar').length, YES: 0, NO: 0, UNSURE: 0 };
    for (const r of day) tally[r.verdict]++;
    return { tally, checks: rows };
  }
  async function radarKnown(env) {
    const rows = (await env.DB.prepare(
      "SELECT DISTINCT json_extract(src,'$.address') a FROM jobs WHERE json_extract(src,'$.kind')='token' AND created>?"
    ).bind(now() - 30 * 86400).all()).results;
    return rows.map((r) => r.a).filter(Boolean);
  }

  async function tokenChecks(env, n) {
    const rows = (await env.DB.prepare(
      "SELECT id,verdict,agree,n,done_at,src FROM jobs WHERE phase='done' AND json_extract(src,'$.kind')='token' ORDER BY id DESC LIMIT ?"
    ).bind(n).all()).results;
    return rows.map((r) => ({ ...r, src: JSON.parse(r.src) }));
  }

  // The newest check of one token (finished or still running) — the public API reads this.
  async function tokenVerdict(env, address) {
    const a = String(address || '').toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(a)) return { e: 'bad address', s: 400 };
    const row = await env.DB.prepare(
      "SELECT id,phase,verdict,agree,n,created,done_at,h,chain_tx,src FROM jobs WHERE json_extract(src,'$.address')=? AND json_extract(src,'$.kind')='token' AND phase!='failed' ORDER BY id DESC LIMIT 1"
    ).bind(a).first();
    return row ? { found: true, ...row, src: JSON.parse(row.src) } : { found: false, address: a };
  }

  // X accounts ranked by how their checked posts came out. Built only from
  // posts people submitted; a handle needs MIN_CHECKS finished checks to rank.
  async function truthBoard(env, handle) {
    const MIN_CHECKS = 2;
    const rows = (await env.DB.prepare(
      "SELECT id,verdict,agree,done_at,src FROM jobs WHERE phase='done' AND src IS NOT NULL AND json_extract(src,'$.kind') IS NULL ORDER BY id DESC LIMIT 5000"
    ).all()).results;
    const by = new Map();
    for (const r of rows) {
      const s = JSON.parse(r.src);
      const k = String(s.handle || '').toLowerCase();
      if (!k) continue;
      if (handle && k !== handle.toLowerCase()) continue;
      const a = by.get(k) || { handle: s.handle, author: s.author, avatar: s.avatar, n: 0, t: 0, f: 0, u: 0, last: 0, checks: [] };
      a.n++;
      if (r.verdict === 'YES') a.t++; else if (r.verdict === 'NO') a.f++; else a.u++;
      a.last = Math.max(a.last, r.done_at || 0);
      if (a.checks.length < (handle ? 50 : 3)) a.checks.push({ id: r.id, verdict: r.verdict, agree: r.agree, text: String(s.text || '').slice(0, handle ? 600 : 140), url: s.url });
      by.set(k, a);
    }
    const all = [...by.values()].map((a) => ({
      ...a,
      // true share of the posts that got a clear verdict, smoothed toward 50% for few checks
      score: Math.round(((a.t + 1) / (a.t + a.f + 2)) * 100),
      ranked: a.n >= MIN_CHECKS,
    }));
    all.sort((x, y) => (y.ranked - x.ranked) || (y.score - x.score) || (y.n - x.n));
    return { min: MIN_CHECKS, accounts: all };
  }

  async function stats(env) {
    const db = env.DB, t = now();
    const s = await db.prepare(
      "SELECT COUNT(*) total, COALESCE(SUM(phase='done'),0) done, COALESCE(AVG(CASE WHEN phase='done' THEN agree END),0) agree FROM jobs"
    ).first();
    const online = (await db.prepare(
      "SELECT COUNT(*) c FROM agents WHERE last_seen>? AND kind='external'"
    ).bind(t - 120).first()).c;
    return { ...s, ref: activeCores(env).length, community_online: online };
  }

  return { ask, view, work, commit, reveal, sweep, cores, recent, stats, advance, tokenChecks, tokenVerdict, truthBoard, radar, radarKnown };
}
