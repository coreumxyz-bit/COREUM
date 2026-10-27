import { cookies } from "next/headers";
import { connection } from "next/server";
import { api } from "@/lib/api";
import { SESSION_COOKIE, corsBalance, holderCookie, newNonce, nonceOk, sessionCookie, sessionFromCookie, signInMessage } from "@/lib/corsChain";

// Sign in with a wallet: GET gives the message to sign, POST checks the signature
// (in the Worker) and sets a 30-day session cookie. If the wallet holds 1M $CORS
// the holder tier switches on with the same signature.
const opts = { httpOnly: true, secure: true, sameSite: "lax" as const, path: "/" };

export async function GET(req: Request) {
  await connection();
  const addr = sessionFromCookie((await cookies()).get(SESSION_COOKIE)?.value);
  const want = new URL(req.url).searchParams.get("addr");
  const body: { addr: string | null; message?: string; nonce?: string } = { addr };
  if (want && /^0x[0-9a-fA-F]{40}$/.test(want)) {
    body.nonce = newNonce();
    body.message = signInMessage(want, body.nonce);
  }
  return Response.json(body, { headers: { "cache-control": "no-store" } });
}

export async function POST(req: Request) {
  await connection();
  try {
    const { addr, sig, nonce } = (await req.json()) as { addr?: string; sig?: string; nonce?: string };
    const a = String(addr || "").toLowerCase();
    if (!/^0x[0-9a-f]{40}$/.test(a)) return Response.json({ error: "bad address" }, { status: 400 });
    if (!nonceOk(String(nonce || ""))) return Response.json({ error: "the sign-in request expired, try again" }, { status: 400 });
    await api("/api/auth/verify", { method: "POST", body: { addr: a, sig, msg: signInMessage(a, String(nonce)) } });
    const jar = await cookies();
    jar.set(SESSION_COOKIE, sessionCookie(a), { ...opts, maxAge: 30 * 86400 });
    let holder = false;
    try {
      const bal = await corsBalance(a);
      const r = await api<{ ok: boolean }>("/api/holder/record", { method: "POST", body: { addr: a, amount: bal.toString(), signed_in: true } });
      if (r.ok) {
        jar.set("coreum_holder", holderCookie(a), { ...opts, maxAge: 7 * 86400 });
        holder = true;
      }
    } catch {}
    return Response.json({ addr: a, holder }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function DELETE() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  jar.delete("coreum_holder");
  return Response.json({ ok: true });
}
