import { connection } from "next/server";
import { api, clientIp } from "@/lib/api";

// POST: make a call (body {secret, name, sym, dir}); GET ?id=: one call
export async function POST(req: Request) {
  await connection();
  try {
    const body = await req.json();
    const r = await api("/api/play", { method: "POST", body, ip: await clientIp() });
    return Response.json(r, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function GET(req: Request) {
  await connection();
  const id = new URL(req.url).searchParams.get("id") ?? "";
  try {
    return Response.json(await api(`/api/play?id=${encodeURIComponent(id)}`), {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 404 });
  }
}
