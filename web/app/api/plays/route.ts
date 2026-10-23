import { connection } from "next/server";
import { api } from "@/lib/api";

// The player's own history — proven by the browser-held secret.
export async function POST(req: Request) {
  await connection();
  try {
    const { secret } = await req.json();
    return Response.json(await api("/api/plays", { method: "POST", body: { secret } }), {
      headers: { "cache-control": "no-store" },
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
