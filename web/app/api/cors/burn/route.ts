import { connection } from "next/server";
import { api } from "@/lib/api";
import { readBurn } from "@/lib/corsChain";

// POST /api/cors/burn {"tx": "0x…", "purpose": "check" | "apikey" | "core"}
// The site reads the burn's receipt on Robinhood Chain and records it once;
// 202 while the transaction is not mined yet (poll again).
export async function POST(req: Request) {
  await connection();
  try {
    const { tx, purpose } = (await req.json()) as { tx?: string; purpose?: string };
    const b = await readBurn(String(tx || ""));
    if ("pending" in b) return Response.json({ pending: true }, { status: 202 });
    if ("error" in b) return Response.json({ error: b.error }, { status: 400 });
    await api("/api/burn/record", { method: "POST", body: { tx, addr: b.from, amount: b.amount.toString(), purpose } });
    return Response.json({ ok: true, from: b.from, burned: (b.amount / BigInt("1000000000000000000")).toString() }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
