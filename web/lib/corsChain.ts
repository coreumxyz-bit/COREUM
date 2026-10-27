// $CORS read straight from Robinhood Chain for the token's jobs in the network:
// a wallet's balance (holder tier) and a burn transaction's receipt (paid checks,
// API keys, verified cores). Server-side only; the Worker keeps the records.
import { createHmac, timingSafeEqual } from "node:crypto";
import { CORS_TOKEN } from "@/lib/cors";

const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEAD = CORS_TOKEN.burnAddress.toLowerCase();

async function rpc<T>(method: string, params: unknown[], tries = 2): Promise<T> {
  const r = await fetch(CORS_TOKEN.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
    cache: "no-store",
  });
  const t = await r.text();
  const j = t.startsWith("{") ? (JSON.parse(t) as { result?: T; error?: { message?: string } }) : null;
  if (j && !j.error) return j.result as T;
  if (tries > 0) {
    await new Promise((ok) => setTimeout(ok, 3500 - tries * 1000)); // rate-limited: wait, then retry
    return rpc(method, params, tries - 1);
  }
  throw new Error(j?.error?.message || "Robinhood Chain RPC is busy, try again in a minute");
}

export async function corsBalance(addr: string): Promise<bigint> {
  const r = await rpc<string>("eth_call", [{ to: CORS_TOKEN.address, data: "0x70a08231" + addr.slice(2).toLowerCase().padStart(64, "0") }, "latest"]);
  return BigInt(r || "0x0");
}

/** A burn of $CORS to the dead address: who burned and how much (wei), or why not. */
export async function readBurn(tx: string): Promise<{ from: string; amount: bigint } | { pending: true } | { error: string }> {
  if (!/^0x[0-9a-fA-F]{64}$/.test(tx)) return { error: "not a transaction hash" };
  const rc = await rpc<{ status: string; logs: { address: string; topics: string[]; data: string }[] } | null>("eth_getTransactionReceipt", [tx]);
  if (!rc) return { pending: true };
  if (rc.status !== "0x1") return { error: "the transaction failed on chain" };
  let from = "", amount = BigInt(0);
  for (const l of rc.logs) {
    if (l.address.toLowerCase() !== CORS_TOKEN.address || l.topics[0] !== TRANSFER || l.topics.length < 3) continue;
    if ("0x" + l.topics[2].slice(26).toLowerCase() !== DEAD) continue;
    from = "0x" + l.topics[1].slice(26).toLowerCase();
    amount += BigInt(l.data);
  }
  return from ? { from, amount } : { error: "no $CORS sent to the burn address in that transaction" };
}

// The holder cookie names a wallet the Worker already verified; signed so it can't be borrowed.
const sig = (addr: string) => createHmac("sha256", process.env.COREUM_SITE_SECRET ?? "dev").update("holder:" + addr).digest("hex").slice(0, 32);
export const holderCookie = (addr: string) => `${addr.toLowerCase()}.${sig(addr.toLowerCase())}`;
export function holderFromCookie(v: string | undefined): string | null {
  const [addr, s] = String(v || "").split(".");
  if (!/^0x[0-9a-f]{40}$/.test(addr || "") || !s) return null;
  const want = sig(addr);
  return s.length === want.length && timingSafeEqual(Buffer.from(s), Buffer.from(want)) ? addr : null;
}
