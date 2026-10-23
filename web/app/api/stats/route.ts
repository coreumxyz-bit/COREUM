import { connection } from "next/server";
import { api } from "@/lib/api";

// Thin proxy to the Coreum API's public track-record aggregates.
export async function GET() {
  await connection();
  try {
    const s = await api("/api/stats");
    return Response.json(s, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
