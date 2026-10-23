#!/usr/bin/env node
// verify-coreum.mjs — check Coreum independently. Node 18+, zero dependencies.
//
//   curl -O https://www.coreum.xyz/verify-coreum.mjs
//   node verify-coreum.mjs                 # full check, last 10 jobs for commit-reveal
//   node verify-coreum.mjs --reveal 50     # commit-reveal on the last 50 jobs
//
// What it does, without trusting Coreum's word for anything it can check elsewhere:
//   1. Ledger    — downloads the public ledger and recomputes every SHA-256 link.
//   2. Contract  — reads verdictOf(job) straight from Robinhood Chain and matches it
//                  to the ledger block that sealed that job.
//   3. Anchors   — reads each hourly anchor tx from Robinhood Chain and matches its
//                  calldata to the ledger hash at that block.
//   4. Commits   — recomputes sha256(job|verdict|reason|salt) for revealed answers and
//                  matches it to the commitment sealed in the ledger.
// Read-only: it never signs or sends a transaction.

import { createHash } from "node:crypto";

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > -1 ? process.argv[i + 1] : d;
};
const API = arg("--api", "https://www.coreum.xyz").replace(/\/$/, "");
const RPC = arg("--rpc", "https://rpc.mainnet.chain.robinhood.com");
const CONTRACT = arg("--contract", "0x5A2332aFb10354d2657AAa1Ad1176507E00099C4");
const REVEAL = Number(arg("--reveal", "10"));
const CHAIN_ID = 4663;
const ZERO = "0".repeat(64);
const CODE = { YES: 1, NO: 2, UNSURE: 3 };

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failures = 0;
const ok = (msg) => console.log(`  ✓ ${msg}`);
const bad = (msg) => (failures++, console.log(`  ✗ ${msg}`));
const note = (msg) => console.log(`  · ${msg}`);

async function getJson(path) {
  const r = await fetch(API + path, { headers: { accept: "application/json" }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

let rpcId = 0;
async function rpc(method, params, tries = 4) {
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(RPC, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method, params }),
        signal: AbortSignal.timeout(20000),
      });
      const j = await r.json();
      if (j.error) throw new Error(j.error.message || JSON.stringify(j.error));
      return j.result;
    } catch (e) {
      if (k >= tries) throw e;
      await sleep(800 * (k + 1)); // public RPCs rate-limit; back off and retry
    }
  }
}

const word = (hex, n) => hex.slice(2 + n * 64, 2 + (n + 1) * 64);
const pad = (n) => BigInt(n).toString(16).padStart(64, "0");

async function main() {
  console.log(`Coreum independent check\n  api ${API}\n  rpc ${RPC}\n  contract ${CONTRACT}\n`);

  // ---- 1. ledger -----------------------------------------------------------
  console.log("1. Ledger hash chain");
  const ledger = await getJson("/api/export");
  let linkOk = true;
  for (let k = 0; k < ledger.length; k++) {
    const b = ledger[k];
    const prev = k ? ledger[k - 1].hash : ZERO;
    if (b.i !== k) (linkOk = false), bad(`block ${b.i}: expected index ${k}`);
    if (b.prev !== prev) (linkOk = false), bad(`block ${b.i}: prev does not point at block ${k - 1}`);
    if (sha(`${b.prev}|${b.type}|${b.data}`) !== b.hash) (linkOk = false), bad(`block ${b.i}: hash does not recompute`);
  }
  if (linkOk) ok(`${ledger.length} blocks, every hash recomputes, head #${ledger.at(-1).i} ${ledger.at(-1).hash.slice(0, 16)}…`);
  const byIndex = new Map(ledger.map((b) => [b.i, b]));
  const sealedJobs = ledger.filter((b) => b.type === "verify").map((b) => ({ block: b, d: JSON.parse(b.data) }));
  note(`${sealedJobs.length} verdicts sealed in the ledger`);

  // ---- 2. contract ---------------------------------------------------------
  console.log("\n2. CoreumVerdicts contract on Robinhood Chain");
  const chainId = parseInt(await rpc("eth_chainId", []), 16);
  if (chainId === CHAIN_ID) ok(`RPC is Robinhood Chain (chain id ${chainId})`);
  else bad(`RPC chain id ${chainId}, expected ${CHAIN_ID}`);
  const count = Number(BigInt(await rpc("eth_call", [{ to: CONTRACT, data: "0x06661abd" }, "latest"])));
  const lastJob = Number(BigInt(await rpc("eth_call", [{ to: CONTRACT, data: "0x51cc784f" }, "latest"])));
  const writer = "0x" + (await rpc("eth_call", [{ to: CONTRACT, data: "0x453a2abc" }, "latest"])).slice(-40);
  note(`contract holds ${count} verdicts, newest job #${lastJob}, writer ${writer}`);

  // a job sealed into the ledger twice (a race fixed on 2026-10-20) has two verify
  // blocks; the contract must match one of them, and both are listed openly
  const blocksOf = new Map();
  for (const s of sealedJobs) blocksOf.set(s.d.job, [...(blocksOf.get(s.d.job) || []), s]);
  const twice = [...blocksOf].filter(([, l]) => l.length > 1);
  if (twice.length)
    note(`sealed twice in the ledger (race, since fixed): ${twice.map(([j, l]) => `#${j} → blocks ${l.map((x) => x.block.i).join(" & ")}`).join("; ")}`);

  let matched = 0, missing = 0;
  for (const [, list] of blocksOf) {
    const { d } = list[0];
    if (d.job > lastJob) continue; // sealed in the ledger, not written on-chain yet (hourly)
    const out = await rpc("eth_call", [{ to: CONTRACT, data: "0xbcaa6cf7" + pad(d.job) }, "latest"]);
    const v = {
      questionHash: word(out, 0),
      ledgerHash: word(out, 1),
      ledgerBlock: Number(BigInt("0x" + word(out, 2))),
      verdict: Number(BigInt("0x" + word(out, 3))),
      agreePct: Number(BigInt("0x" + word(out, 4))),
      cores: Number(BigInt("0x" + word(out, 5))),
    };
    if (!v.verdict) {
      missing++;
      bad(`job #${d.job}: not in the contract although newest job is #${lastJob}`);
      continue;
    }
    const problems = [];
    const block = (list.find((x) => x.block.i === v.ledgerBlock) || list.at(-1)).block;
    if (v.ledgerBlock !== block.i) problems.push(`ledgerBlock ${v.ledgerBlock} is not a ledger block of this job (${list.map((x) => x.block.i).join(", ")})`);
    if (v.ledgerHash !== block.hash) problems.push("ledgerHash differs");
    if (v.questionHash !== sha(d.q)) problems.push("questionHash ≠ sha256(question)");
    if (v.verdict !== CODE[d.verdict]) problems.push(`verdict ${v.verdict} ≠ ${d.verdict}`);
    if (v.agreePct !== Math.round((d.agree || 0) * 100)) problems.push(`agreePct ${v.agreePct} ≠ ${Math.round(d.agree * 100)}`);
    if (v.cores !== d.n) problems.push(`cores ${v.cores} ≠ ${d.n}`);
    if (problems.length) bad(`job #${d.job}: ${problems.join(", ")}`);
    else matched++;
  }
  if (matched) ok(`${matched} on-chain verdicts match their ledger blocks exactly (hash, question, verdict, agreement, cores)`);
  const pending = [...blocksOf.keys()].filter((j) => j > lastJob).length;
  if (pending) note(`${pending} newer verdicts are waiting for the next hourly seal`);
  if (!missing && matched + pending === blocksOf.size) ok("every sealed verdict is either on-chain or pending the next seal");

  // ---- 3. anchors ----------------------------------------------------------
  console.log("\n3. Ledger anchors");
  const anchors = await getJson("/api/anchors");
  for (const a of anchors.filter((x) => x.kind === "evm")) {
    const tx = await rpc("eth_getTransactionByHash", [a.tx]);
    if (!tx) {
      bad(`anchor ${a.tx}: not found on Robinhood Chain`);
      continue;
    }
    const text = Buffer.from(tx.input.slice(2), "hex").toString("utf8");
    const m = text.match(/^coreum-anchor:v1:(\d+):([0-9a-f]{64})$/);
    const b = m && byIndex.get(Number(m[1]));
    if (!m) bad(`anchor ${a.tx.slice(0, 12)}…: calldata is not a Coreum anchor`);
    else if (!b) bad(`anchor ${a.tx.slice(0, 12)}…: names block #${m[1]}, which the ledger does not have`);
    else if (b.hash !== m[2]) bad(`anchor ${a.tx.slice(0, 12)}…: hash differs from ledger block #${m[1]}`);
    else ok(`Robinhood Chain tx ${a.tx.slice(0, 12)}… anchors block #${m[1]} — hash matches`);
  }
  const ots = anchors.filter((x) => x.kind === "ots");
  if (ots.length) {
    for (const a of ots) {
      const b = byIndex.get(a.head_i);
      if (b && b.hash === a.head_hash) ok(`Bitcoin (OpenTimestamps) stamp of block #${a.head_i} — hash matches the ledger`);
      else bad(`OpenTimestamps stamp of block #${a.head_i}: hash differs from the ledger`);
    }
    note(`to check a stamp against Bitcoin itself: download ${API}/api/ots?id=<anchor id> and run \`ots verify\``);
  }

  // ---- 4. commit-reveal ----------------------------------------------------
  console.log(`\n4. Commit–reveal (last ${REVEAL} sealed jobs)`);
  let commits = 0;
  for (const { d } of sealedJobs.slice(-REVEAL)) {
    const job = await getJson(`/api/job?id=${d.job}`);
    for (const w of job.work.filter((x) => x.ts_reveal && x.salt)) {
      const recomputed = sha(`${d.job}|${w.verdict}|${w.reason}|${w.salt}`);
      const sealed = d.work.find((x) => x.core === w.core)?.commit;
      if (recomputed !== w.commit) bad(`job #${d.job} ${w.core}: revealed answer does not hash to its commitment`);
      else if (sealed !== w.commit) bad(`job #${d.job} ${w.core}: commitment differs from the one sealed in the ledger`);
      else commits++;
    }
  }
  ok(`${commits} revealed answers hash to the commitments sealed in the ledger`);

  console.log(`\n${failures ? `✗ ${failures} problem(s) found` : "✓ everything checked out"}`);
  console.log(
    "Note: this proves nothing was changed after sealing and anchoring. It does not prove the verdicts are right,\n" +
      "or that the cores are run by different people — see https://www.coreum.xyz/evidence."
  );
  process.exit(failures ? 1 : 0);
}

main().catch((e) => {
  console.error("check could not run:", e.message);
  process.exit(2);
});
