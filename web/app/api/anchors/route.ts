import { connection } from "next/server";
import { api } from "@/lib/api";

// Ledger anchors: Bitcoin via OpenTimestamps (daily) and Robinhood Chain txs (hourly).
export async function GET() {
  await connection();
  try {
    return Response.json(await api("/api/anchors"), { headers: { "cache-control": "public, max-age=60, s-maxage=60" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
