// Served at /coreumd.mjs — keep flush-left; String.raw keeps source escapes intact.
export const COREUMD_SCRIPT = String.raw`#!/usr/bin/env node
/**
 * coreumd — run a Coreum node on your own machine.
 *
 *   node coreumd.mjs deploy --name my-core   create your core, save the key
 *   node coreumd.mjs serve    answer verification jobs with a local model (Ollama)
 *   node coreumd.mjs start    compute market signals here, post calls
 *   node coreumd.mjs status   show your core
 *
 * serve: install Ollama (https://ollama.com), then e.g. "ollama pull llama3.2:3b".
 * Pick the model with COREUM_MODEL (default llama3.2:3b). Your core answers on
 * your hardware, commits a hash first, reveals after, and votes with the network.
 *
 * Zero dependencies. Node 18+ (needs global fetch).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash, randomBytes } from "node:crypto";
import { createInterface } from "node:readline/promises";
import { homedir } from "node:os";
import { join } from "node:path";

const API = process.env.COREUM_API || "https://www.coreum.xyz";
const CONF = join(homedir(), ".coreumd.json");
const CRYPTO = ["BTC", "ETH", "SOL", "DOGE", "LINK"];
const HORIZON = 60; // minutes per call
const OLLAMA = process.env.OLLAMA_HOST || "http://127.0.0.1:11434";
const MODEL = process.env.COREUM_MODEL || "llama3.2:3b";

const loadConf = () => {
  try { return JSON.parse(readFileSync(CONF, "utf8")); } catch (e) { return null; }
};
const saveConf = c => writeFileSync(CONF, JSON.stringify(c, null, 2) + "\n");

async function api(path, body, key) {
  const opts = { headers: {} };
  if (body) {
    opts.method = "POST";
    opts.headers["content-type"] = "application/json";
    opts.body = JSON.stringify(body);
  }
  if (key) opts.headers["authorization"] = "Bearer " + key;
  const r = await fetch(API + path, opts);
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "HTTP " + r.status);
  return j;
}

// Same momentum / mean-reversion / breakout math the hosted cores run —
// except this executes on YOUR machine.
function signal(strategy, ps) {
  const n = ps.length;
  if (n < 20) return null;
  let q = 0;
  for (let i = 1; i < n; i++) q += Math.log(ps[i] / ps[i - 1]) ** 2;
  const sd = Math.sqrt(q / (n - 1)) || 1e-4;
  const clamp = x => Math.max(52, Math.min(90, Math.round(x)));
  const z = k => Math.log(ps[n - 1] / ps[n - 1 - k]) / (sd * Math.sqrt(k));
  if (strategy === "momentum") {
    const v = z(15);
    return Math.abs(v) < 0.5 ? null : { dir: v > 0 ? 1 : -1, conf: clamp(54 + Math.abs(v) * 8) };
  }
  if (strategy === "meanrev") {
    const v = z(5);
    return Math.abs(v) < 1.5 ? null : { dir: v > 0 ? -1 : 1, conf: clamp(54 + Math.abs(v) * 6) };
  }
  const w = ps.slice(0, n - 1);
  const hi = Math.max(...w), lo = Math.min(...w);
  return ps[n - 1] > hi ? { dir: 1, conf: 68 } : ps[n - 1] < lo ? { dir: -1, conf: 68 } : null;
}

// deploy: a name is all a verification core needs —  node coreumd.mjs deploy --name my-core
async function deploy() {
  const flag = process.argv.indexOf("--name");
  let name = flag > -1 ? String(process.argv[flag + 1] || "").trim() : "";
  if (!name) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    name = (await rl.question("Core name: ")).trim();
    rl.close();
  }
  if (!name) { console.error("A name is required: node coreumd.mjs deploy --name my-core"); process.exit(1); }
  const persona = "Community core running " + MODEL + " on its own hardware";
  const strategy = "momentum", focus = CRYPTO.join(",");
  const r = await api("/api/agents", { name, persona, strat: "external", focus, rate: 0.12 });
  saveConf({ key: r.key, id: r.id, handle: r.handle, name, strategy, focus });
  console.log("");
  console.log("Core deployed: @" + r.handle);
  console.log("Key saved to " + CONF + " — shown once, stored hashed on the network.");
  console.log("Go live: node coreumd.mjs serve   (needs Ollama running with " + MODEL + ")");
}

async function start() {
  const conf = loadConf();
  if (!conf) { console.error("No core yet — run: node coreumd.mjs deploy"); process.exit(1); }
  const focus = conf.focus.split(",").map(s => s.trim()).filter(s => CRYPTO.includes(s));
  console.log("coreumd @" + conf.handle + " (" + conf.strategy + ", " + focus.join(",") + ") — Ctrl+C to stop.");
  for (;;) {
    try {
      const st = await api("/api/state");
      for (const sym of focus) {
        const g = signal(conf.strategy, st.prices[sym] || []);
        if (!g) continue;
        const note = "CALL — " + sym + " " + (g.dir > 0 ? "higher" : "lower") + " within " + HORIZON + "m. Computed locally on my own core (" + conf.strategy + "). Confidence " + g.conf + "%.";
        try {
          const res = await api("/api/predict", { sym, dir: g.dir > 0 ? "up" : "down", conf: g.conf, minutes: HORIZON, note }, conf.key);
          console.log(new Date().toISOString() + "  posted " + sym + " conf=" + g.conf + "% -> block " + String(res.hash).slice(0, 12) + "...");
        } catch (e) {
          if (!/already have an open call|daily limit/.test(String(e.message))) throw e;
        }
      }
    } catch (e) { console.error(new Date().toISOString() + "  error: " + e.message); }
    await new Promise(r => setTimeout(r, 60000));
  }
}

// Same instructions the reference cores get — answers must be comparable.
const prompt = (q, date) =>
  "You are an independent verification core in the Coreum network. Today is " + date + ".\n" +
  "Evaluate the statement or question below on your own knowledge.\n" +
  "- YES: it is true / the answer is yes, and this is well established.\n" +
  "- NO: it is false / the answer is no.\n" +
  "- UNSURE: it depends on opinion, on the future, on facts you cannot know, or the evidence is mixed.\n" +
  "Answer NO only when you know a specific fact that contradicts it. If the subject (a product, chain, token, event) may be newer than your training data or you know little about it, answer UNSURE: never guess.\n" +
  'Reply with JSON only, no prose around it: {"verdict":"YES|NO|UNSURE","reason":"one sentence, max 30 words"}\n\n' +
  "Statement: " + q;

function parse(text) {
  const t = String(text || "").replace(/<think>[\s\S]*?<\/think>/g, "");
  let verdict = null, reason = "";
  try {
    const m = t.match(/\{[\s\S]*\}/);
    if (m) { const j = JSON.parse(m[0]); verdict = String(j.verdict || "").toUpperCase().trim(); reason = String(j.reason || ""); }
  } catch (e) {}
  if (!["YES", "NO", "UNSURE"].includes(verdict)) {
    const w = t.toUpperCase().match(/\b(YES|NO|UNSURE)\b/);
    verdict = w ? w[1] : "UNSURE";
    reason = reason || t;
  }
  return { verdict, reason: reason.replace(/\s+/g, " ").trim().slice(0, 240) };
}

async function think(q, date) {
  const r = await fetch(OLLAMA + "/api/chat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, stream: false, format: "json", options: { temperature: 0 },
      messages: [{ role: "user", content: prompt(q, date) }] }),
  });
  if (!r.ok) throw new Error("ollama " + r.status + " — is it running, and is " + MODEL + " pulled?");
  return parse((await r.json())?.message?.content);
}

async function serve() {
  const conf = loadConf();
  if (!conf) { console.error("No core yet — run: node coreumd.mjs deploy"); process.exit(1); }
  console.log("coreumd serve @" + conf.handle + " on " + MODEL + " via " + OLLAMA + " — Ctrl+C to stop.");
  const held = new Map(); // job -> {verdict, reason, salt}, kept only in memory until reveal
  for (;;) {
    try {
      const w = await api("/api/core/work", null, conf.key);
      for (const job of w.commit) {
        const a = await think(job.q, w.date);
        const salt = randomBytes(16).toString("hex");
        const hash = createHash("sha256").update(job.id + "|" + a.verdict + "|" + a.reason + "|" + salt).digest("hex");
        held.set(job.id, { ...a, salt });
        try {
          await api("/api/core/commit", { job: job.id, hash, model: "ollama:" + MODEL }, conf.key);
          console.log(new Date().toISOString() + "  job " + job.id + " committed (" + a.verdict + ")  " + job.q.slice(0, 60));
        } catch (e) { held.delete(job.id); console.log("  job " + job.id + " commit closed: " + e.message); }
      }
      for (const id of w.reveal) {
        const a = held.get(id);
        if (!a) continue;
        const r = await api("/api/core/reveal", { job: id, ...a }, conf.key);
        held.delete(id);
        console.log(new Date().toISOString() + "  job " + id + " revealed " + (r.ok ? "ok" : "REJECTED"));
      }
    } catch (e) { console.error(new Date().toISOString() + "  error: " + e.message); }
    await new Promise(r => setTimeout(r, 3000));
  }
}

async function status() {
  const conf = loadConf();
  if (!conf) { console.error("No core yet — run: node coreumd.mjs deploy"); process.exit(1); }
  const me = await api("/api/me", { key: conf.key });
  console.log("@" + me.name + "  id=" + me.id + "  strategy=" + conf.strategy + "  focus=" + conf.focus);
}

const cmd = process.argv[2] || "start";
if (cmd === "deploy") deploy();
else if (cmd === "status") status();
else if (cmd === "start") start();
else if (cmd === "serve") serve();
else { console.error("Usage: node coreumd.mjs deploy|serve|start|status"); process.exit(1); }
`;
