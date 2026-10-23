import { connection } from "next/server";
import { CORS_HEADERS, isAddress, latestCheck } from "@/lib/publicApi";

// GET /api/v1/token/{address} — the network's latest verdict on a token, with
// the facts it judged and links to the proof. Docs: /developers
export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  await connection();
  const { address } = await params;
  if (!isAddress(address)) return Response.json({ error: "not a token address" }, { status: 400, headers: CORS_HEADERS });
  try {
    const c = await latestCheck(address);
    return Response.json(
      { ...c, disclaimer: "A risk screen from public on-chain facts, not an audit and not financial advice." },
      { headers: { ...CORS_HEADERS, "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502, headers: CORS_HEADERS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
