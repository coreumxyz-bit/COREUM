#!/usr/bin/env node
// Hourly on Robinhood Chain: (1) anchors the Coreum ledger head, (2) writes new
// verdicts into the CoreumVerdicts contract, (3) copies the latest token grades
// into CoreumTokenRegistry (both in contracts/deployments.json).
//
// (1) Anchor:
//
// Sends a 0-value transaction from the anchor wallet to itself whose calldata is
// the UTF-8 text  coreum-anchor:v1:<ledger block>:<sha256 head hash>
// Blockscout shows it as readable input data, so anyone can match it against
// /api/export and recompute every hash up to that block.
//
// Runs hourly from GitHub Actions (the public RPC rate-limits Cloudflare's
// shared egress, so the Worker cannot send it). Skips when the head has not
// moved since the last anchor, so idle hours cost nothing.
//
// env: ANCHOR_KEY (anchor wallet private key, required to send)
//      COREUM_SECRET (the Worker's SHARED_SECRET, to record the anchor)
//      COREUM_API, RPC_URL (optional overrides)
import { JsonRpcProvider, Wallet, Contract, hexlify, toUtf8Bytes, formatEther } from "ethers";
import { appendFileSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const API = (process.env.COREUM_API || "https://www.coreum.xyz").replace(/\/$/, "");
const RPC = process.env.RPC_URL || "https://rpc.mainnet.chain.robinhood.com";
const CHAIN_ID = 4663;
const EXPLORER = "https://robinhoodchain.blockscout.com";

const summary = (line) => {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, line + "\n");
};

async function getJson(path) {
  const r = await fetch(API + path, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

// The public RPC answers 429 under load; back off and retry a few times.
async function retry(fn, label) {
  let wait = 2000;
  for (let i = 0; ; i++) {
    try {
      return await fn();
    } catch (e) {
      const msg = String(e?.message || e);
      if (i >= 5 || !/429|Too Many|rate|timeout|ECONNRESET|network/i.test(msg)) throw e;
      console.log(`${label}: ${msg.slice(0, 120)} — retrying in ${wait / 1000}s`);
      await new Promise((r) => setTimeout(r, wait));
      wait *= 2;
    }
  }
}

const key = process.env.ANCHOR_KEY;
if (!key) {
  summary("ANCHOR_KEY is not set — add the anchor wallet's private key as a repository secret. Skipping.");
  process.exit(0);
}

const provider = new JsonRpcProvider(RPC, CHAIN_ID, { staticNetwork: true });
const wallet = new Wallet(key, provider);
const balance = await retry(() => provider.getBalance(wallet.address), "balance");
console.log(`anchor wallet ${wallet.address} · balance ${formatEther(balance)} ETH`);
if (balance === 0n) throw new Error(`anchor wallet ${wallet.address} has no ETH for gas on Robinhood Chain`);

async function record(path, body) {
  if (!process.env.COREUM_SECRET) {
    summary(`COREUM_SECRET is not set — ${path} not recorded on the site.`);
    return;
  }
  const r = await fetch(API + path, {
    method: "POST",
    headers: { "content-type": "application/json", "x-coreum-admin": process.env.COREUM_SECRET },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`recording ${path} failed: ${j.error || r.status}`);
}

const fee = (rc) => formatEther(rc.gasUsed * (rc.gasPrice ?? 0n));

// 1) anchor the ledger head (skipped when it has not moved)
async function anchorHead() {
  const { head } = await getJson("/api/state");
  if (!head) throw new Error("ledger is empty");
  const anchors = await getJson("/api/anchors");
  const lastChain = anchors.find((a) => a.kind === "evm");
  if (lastChain && lastChain.head_i >= head.i) {
    summary(`Head #${head.i} already anchored in ${EXPLORER}/tx/${lastChain.tx} — no new anchor.`);
    return;
  }
  const text = `coreum-anchor:v1:${head.i}:${head.hash}`;
  const tx = await retry(
    () => wallet.sendTransaction({ to: wallet.address, value: 0n, data: hexlify(toUtf8Bytes(text)) }),
    "send"
  );
  console.log(`sent ${tx.hash} — waiting for the receipt`);
  const rcpt = await retry(() => tx.wait(1, 180_000), "receipt");
  if (!rcpt || rcpt.status !== 1) throw new Error(`anchor tx ${tx.hash} failed`);
  await record("/api/anchor/evm", { head_i: head.i, head_hash: head.hash, tx: tx.hash, block: rcpt.blockNumber });
  summary(`Anchored ledger head #${head.i} (${head.hash.slice(0, 16)}…) · ${EXPLORER}/tx/${tx.hash} · fee ${fee(rcpt)} ETH`);
}

// 2) write new verdicts into CoreumVerdicts, resuming from the contract's lastJobId
async function sealVerdicts() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments.json"), "utf8")).CoreumVerdicts;
  const { abi } = JSON.parse(readFileSync(join(here, "..", "contracts", "CoreumVerdicts.json"), "utf8"));
  const verdicts = new Contract(dep.address, abi, wallet);
  for (let round = 0; round < 4; round++) {
    const after = Number(await retry(() => verdicts.lastJobId(), "lastJobId"));
    const batch = await getJson(`/api/verdicts/pending?after=${after}&limit=50`);
    if (!batch.length) {
      summary(`CoreumVerdicts ${dep.address}: up to date (last job #${after}).`);
      return;
    }
    const tx = await retry(() => verdicts.seal(batch), "seal");
    console.log(`seal ${batch.length} verdicts · ${tx.hash} — waiting`);
    const rcpt = await retry(() => tx.wait(1, 180_000), "receipt");
    if (!rcpt || rcpt.status !== 1) throw new Error(`seal tx ${tx.hash} failed`);
    await record("/api/verdicts/sealed", { tx: tx.hash, ids: batch.map((b) => b.jobId) });
    summary(
      `Wrote ${batch.length} verdicts (jobs #${batch[0].jobId}–#${batch.at(-1).jobId}) to CoreumVerdicts · ${EXPLORER}/tx/${tx.hash} · fee ${fee(rcpt)} ETH`
    );
  }
}

// 3) copy the latest token grades into CoreumTokenRegistry — only checks newer
// than what the registry already holds, so idle hours cost nothing
async function syncRegistry() {
  const here = dirname(fileURLToPath(import.meta.url));
  const dep = JSON.parse(readFileSync(join(here, "..", "contracts", "deployments.json"), "utf8")).CoreumTokenRegistry;
  if (!dep) return;
  const { abi } = JSON.parse(readFileSync(join(here, "..", "contracts", "CoreumTokenRegistry.json"), "utf8"));
  const registry = new Contract(dep.address, abi, wallet);
  const grades = await getJson("/api/v1/grades");
  const fresh = [];
  for (const g of grades) {
    const cur = await retry(() => registry.gradeOf(g.address), "gradeOf");
    if (Number(cur.checkedAt) < g.checked_at)
      fresh.push({ token: g.address, letter: g.letter_code, score: g.score, verdict: g.verdict_code, agreePct: g.agree_pct, jobId: g.job, checkedAt: g.checked_at });
  }
  if (!fresh.length) {
    summary(`CoreumTokenRegistry ${dep.address}: up to date (${grades.length} tokens graded this week).`);
    return;
  }
  for (let i = 0; i < fresh.length; i += 40) {
    const batch = fresh.slice(i, i + 40);
    const tx = await retry(() => registry.update(batch), "update");
    console.log(`update ${batch.length} grades · ${tx.hash} — waiting`);
    const rcpt = await retry(() => tx.wait(1, 180_000), "receipt");
    if (!rcpt || rcpt.status !== 1) throw new Error(`registry tx ${tx.hash} failed`);
    summary(`Wrote ${batch.length} grades to CoreumTokenRegistry · ${EXPLORER}/tx/${tx.hash} · fee ${fee(rcpt)} ETH`);
  }
}

await anchorHead();
await sealVerdicts();
await syncRegistry();
