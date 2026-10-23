import { connection } from "next/server";
import { ledgerExport } from "@/lib/ledger";

export async function GET() {
  await connection();
  try {
    return Response.json(await ledgerExport(), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
