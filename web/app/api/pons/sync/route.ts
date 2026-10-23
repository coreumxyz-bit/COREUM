import { connection } from "next/server";
import { ponsSync } from "@/lib/ponsSync";

// POST /api/pons/sync — the hourly Pons census sync, called by the Worker's
// cron with the admin key (the Worker checks the key on every write).
export const maxDuration = 60;

export async function POST(req: Request) {
  await connection();
  const admin = req.headers.get("x-coreum-admin") ?? "";
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });
  try {
    return Response.json(await ponsSync(admin), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: msg }, { status: /403/.test(msg) ? 403 : 502 });
  }
}
