import { api } from "@/lib/api";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => null)) as { cid?: string; handle?: string; on?: boolean } | null;
  if (!b?.cid || !b.handle) return Response.json({ error: "bad request" }, { status: 400 });
  try {
    return Response.json(await api("/api/follow", { method: "POST", body: { cid: b.cid, handle: b.handle, on: !!b.on } }));
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
