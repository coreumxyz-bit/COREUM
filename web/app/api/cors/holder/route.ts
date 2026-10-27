import { cookies } from "next/headers";
import { connection } from "next/server";
import { api } from "@/lib/api";
import { corsBalance, holderCookie, holderFromCookie } from "@/lib/corsChain";

// The holder tier: sign one message (no gas), the site reads your $CORS balance
// on Robinhood Chain, and the Worker remembers the wallet for a week.
const COOKIE = "coreum_holder";

export async function GET() {
  await connection();
  const addr = holderFromCookie((await cookies()).get(COOKIE)?.value);
  if (!addr) return Response.json({ holder: false });
  const r = await api<{ holder: boolean }>(`/api/holder/status?addr=${addr}`).catch(() => ({ holder: false }));
  return Response.json({ addr, holder: r.holder }, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  await connection();
  try {
    const { addr, sig } = (await req.json()) as { addr?: string; sig?: string };
    const a = String(addr || "").toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(a)) return Response.json({ error: "bad address" }, { status: 400 });
    const amount = await corsBalance(a);
    const r = await api<{ ok: boolean; amount: string; need?: string; per_day?: number }>("/api/holder/record", {
      method: "POST",
      body: { addr: a, sig, amount: amount.toString() },
    });
    if (r.ok) (await cookies()).set(COOKIE, holderCookie(a), { httpOnly: true, secure: true, sameSite: "lax", maxAge: 7 * 86400, path: "/" });
    return Response.json(r, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function DELETE() {
  (await cookies()).delete(COOKIE);
  return Response.json({ ok: true });
}
