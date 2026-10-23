import { connection } from "next/server";
import { api, clientIp } from "@/lib/api";
import { fetchToken, parseToken, questionForToken } from "@/lib/token";
import { CORS_HEADERS, SITE } from "@/lib/publicApi";

// POST /api/v1/check {"address": "0x…"} — ask the network for a fresh check.
// The six cores answer in about a minute; poll GET /api/v1/token/{address}.
// Same daily limits as the site. Docs: /developers
export async function POST(req: Request) {
  await connection();
  try {
    const { address } = (await req.json().catch(() => ({}))) as { address?: string };
    const a = parseToken(String(address || ""));
    if (!a) return Response.json({ error: "send {\"address\": \"0x…\"}" }, { status: 400, headers: CORS_HEADERS });
    const t = await fetchToken(a);
    const r = await api<{ id: number }>("/api/ask", { method: "POST", body: { q: questionForToken(t), src: t }, ip: await clientIp() });
    return Response.json(
      { address: a, job: r.id, status: "checking", page: `${SITE}/v/${r.id}`, result: `${SITE}/api/v1/token/${a}` },
      { status: 202, headers: { ...CORS_HEADERS, "cache-control": "no-store" } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: /limit/i.test(msg) ? 429 : 400, headers: CORS_HEADERS });
  }
}

export function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}
