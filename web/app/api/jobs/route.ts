import { connection } from "next/server";
import { api } from "@/lib/api";

// Read-only proxy to the verification network.
export async function GET(req: Request) {
  await connection();
  const qs = new URL(req.url).search;
  try {
    return Response.json(await api("/api/jobs" + qs), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
