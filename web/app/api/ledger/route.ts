import { connection } from "next/server";
import { ledgerList, ledgerSize } from "@/lib/ledger";

export async function GET(req: Request) {
  await connection();
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 25), 200);
  try {
    const [total, blocks] = await Promise.all([ledgerSize(), ledgerList(limit)]);
    return Response.json({ total, blocks }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
