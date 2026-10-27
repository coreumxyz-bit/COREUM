import { connection } from "next/server";
import { api } from "@/lib/api";
import { readBurn } from "@/lib/corsChain";

// POST /api/cors/apikey {"tx": "0x…"} — a burn of 1,000,000 $CORS becomes an API
// key with 500 checks a day for 30 days. The key is shown once.
export async function POST(req: Request) {
  await connection();
  try {
    const { tx } = (await req.json()) as { tx?: string };
    const b = await readBurn(String(tx || ""));
    if ("pending" in b) return Response.json({ pending: true }, { status: 202 });
    if ("error" in b) return Response.json({ error: b.error }, { status: 400 });
    await api("/api/burn/record", { method: "POST", body: { tx, addr: b.from, amount: b.amount.toString(), purpose: "apikey" } });
    const k = await api<{ key: string; quota: number; expires: number }>("/api/apikey/create", { method: "POST", body: { tx } });
    return Response.json(k, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
