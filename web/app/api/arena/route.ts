import { connection } from "next/server";
import { api } from "@/lib/api";

export async function GET() {
  await connection();
  try {
    return Response.json(await api("/api/arena"), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
