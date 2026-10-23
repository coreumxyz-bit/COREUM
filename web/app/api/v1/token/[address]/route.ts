import { connection } from "next/server";
import { CORS_HEADERS, fellSince, isAddress, latestCheck, valueNow } from "@/lib/publicApi";

// GET /api/v1/token/{address} — the network's latest verdict on a token, with
// the facts it judged and links to the proof. Docs: /developers
export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  await connection();
  const { address } = await params;
  if (!isAddress(address)) return Response.json({ error: "not a token address" }, { status: 400, headers: CORS_HEADERS });
  try {
    const c = await latestCheck(address);
    // a grade is a snapshot: how far the value has fallen since the check
    const now = c.status === "checked" ? (await valueNow([c.address])).get(c.address) ?? null : null;
    const fell = c.status === "checked" ? fellSince(c.facts.fdv_usd, now) : null;
    return Response.json(
      { ...c, value_now_usd: now, fell_since_check_pct: fell == null ? null : Math.round(fell * 100), disclaimer: "A risk screen from public on-chain facts, not an audit and not financial advice." },
      { headers: { ...CORS_HEADERS, "cache-control": "public, max-age=30, s-maxage=60, stale-while-revalidate=300" } }
    );
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502, headers: CORS_HEADERS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
