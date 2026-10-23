import { connection } from "next/server";
import { CORS_TOKEN } from "@/lib/cors";

// $CORS burned on-chain, read straight from Robinhood Chain over JSON-RPC:
// the total is the live balance of 0x…dEaD, the list is every Transfer log to it.
// Runs here (not in the Worker) because the public RPC rate-limits Cloudflare's
// shared egress. The CDN caches the answer, so the RPC sees ~1 call per 5 min.
const DEAD = "0x000000000000000000000000000000000000dead";
const TRANSFER = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
const DEAD_TOPIC = "0x" + DEAD.slice(2).padStart(64, "0");
const START_BLOCK = 88_000_000; // before the token existed
const SPAN = 9_000_000; // RPC allows 10M blocks per getLogs
const SUPPLY = 1_000_000_000;

type Log = { blockNumber: string; transactionHash: string; logIndex: string; topics: string[]; data: string };

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const r = await fetch(CORS_TOKEN.rpcUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(12000),
    cache: "no-store",
  });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${j.error.message ?? JSON.stringify(j.error)}`);
  return j.result as T;
}

// 4 decimals is plenty for display; BigInt keeps 18-decimal amounts exact until then
const UNIT = BigInt("100000000000000"); // 1e14
const toCors = (wei: bigint) => Number(wei / UNIT) / 1e4;

export async function GET() {
  await connection();
  try {
    const [bal, latestHex] = await Promise.all([
      rpc<string>("eth_call", [{ to: CORS_TOKEN.address, data: "0x70a08231" + DEAD.slice(2).padStart(64, "0") }, "latest"]),
      rpc<string>("eth_blockNumber", []),
    ]);
    const latest = parseInt(latestHex, 16);
    const logs: Log[] = [];
    for (let from = START_BLOCK; from <= latest; from += SPAN) {
      const to = Math.min(from + SPAN - 1, latest);
      logs.push(
        ...(await rpc<Log[]>("eth_getLogs", [
          {
            address: CORS_TOKEN.address,
            topics: [TRANSFER, null, DEAD_TOPIC],
            fromBlock: "0x" + from.toString(16),
            toBlock: "0x" + to.toString(16),
          },
        ]))
      );
    }
    logs.sort((a, b) => parseInt(b.blockNumber, 16) - parseInt(a.blockNumber, 16));
    const recent = await Promise.all(
      logs.slice(0, 12).map(async (l) => {
        const blk = await rpc<{ timestamp: string }>("eth_getBlockByNumber", [l.blockNumber, false]);
        return {
          tx: l.transactionHash,
          block: parseInt(l.blockNumber, 16),
          ts: parseInt(blk.timestamp, 16),
          from: "0x" + l.topics[1].slice(26),
          amount: toCors(BigInt(l.data)),
        };
      })
    );
    const total = toCors(BigInt(bal));
    return Response.json(
      { token: CORS_TOKEN.address, dead: DEAD, supply: SUPPLY, total, pct: total / SUPPLY, count: logs.length, block: latest, recent },
      { headers: { "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600" } }
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502 });
  }
}
