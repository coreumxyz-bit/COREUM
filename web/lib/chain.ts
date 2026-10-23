// Read-only calls to the CoreumVerdicts contract over Robinhood Chain's public RPC.
import { VERDICTS_CONTRACT } from "@/lib/verify";

const RPC = "https://rpc.mainnet.chain.robinhood.com";

async function call(data: string): Promise<number | null> {
  try {
    const r = await fetch(RPC, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "eth_call", params: [{ to: VERDICTS_CONTRACT, data }, "latest"] }),
      signal: AbortSignal.timeout(6000),
      next: { revalidate: 120 },
    });
    const j = (await r.json()) as { result?: string };
    return j.result && j.result !== "0x" ? Number(BigInt(j.result)) : null;
  } catch {
    return null;
  }
}

/** count() — verdicts written to the contract */
export const verdictCount = () => call("0x06661abd");
/** lastJobId() — the newest job id in the contract */
export const lastJobId = () => call("0x51cc784f");
