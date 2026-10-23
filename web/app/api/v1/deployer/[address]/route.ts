import { connection } from "next/server";
import { passport } from "@/lib/passport";
import { CORS_HEADERS, isAddress, SITE } from "@/lib/publicApi";

// GET /api/v1/deployer/{address} — a wallet's Pons launches and what became of
// them, with the passport badges. Docs: /developers
export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  await connection();
  const { address } = await params;
  if (!isAddress(address)) return Response.json({ error: "not a wallet address" }, { status: 400, headers: CORS_HEADERS });
  try {
    const p = await passport(address);
    return Response.json(
      { ...p, page: `${SITE}/deployer/${p.address}` },
      { headers: { ...CORS_HEADERS, "cache-control": "public, max-age=60, s-maxage=300, stale-while-revalidate=900" } }
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502, headers: CORS_HEADERS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
