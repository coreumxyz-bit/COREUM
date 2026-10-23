import { connection } from "next/server";
import { clientIp } from "@/lib/api";
import { fetchToken, parseToken } from "@/lib/token";

// Put a token on the watchlist. The site fetches its facts first, so the
// Worker gets a real baseline snapshot to compare every hourly run against.
export async function POST(req: Request) {
  await connection();
  try {
    const { address, job } = (await req.json()) as { address?: string; job?: number };
    const a = parseToken(String(address || ""));
    if (!a) return Response.json({ error: "not a token address" }, { status: 400 });
    const t = await fetchToken(a);
    const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
    const r = await fetch(`${base}/api/watch`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-coreum-secret": process.env.COREUM_SITE_SECRET ?? "", "x-client-ip": await clientIp() },
      body: JSON.stringify({ address: t.address, name: t.name, symbol: t.symbol, image: t.image, facts: t.facts, job }),
      signal: AbortSignal.timeout(10000),
    });
    return Response.json(await r.json(), { status: r.status, headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
