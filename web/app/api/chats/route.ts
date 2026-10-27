import { cookies } from "next/headers";
import { connection } from "next/server";
import { api } from "@/lib/api";
import { SESSION_COOKIE, sessionFromCookie } from "@/lib/corsChain";

// Ask Coreum history of the signed-in wallet: GET lists (or ?id= opens one),
// POST saves a conversation, DELETE ?id= removes it.
async function me() {
  await connection();
  return sessionFromCookie((await cookies()).get(SESSION_COOKIE)?.value);
}
const no = () => Response.json({ error: "sign in with your wallet first" }, { status: 401 });
const nostore = { headers: { "cache-control": "no-store" } };

export async function GET(req: Request) {
  const addr = await me();
  if (!addr) return no();
  const id = new URL(req.url).searchParams.get("id");
  try {
    return Response.json(await api(id ? `/api/chats/one?addr=${addr}&id=${encodeURIComponent(id)}` : `/api/chats?addr=${addr}`), nostore);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 404 });
  }
}

export async function POST(req: Request) {
  const addr = await me();
  if (!addr) return no();
  try {
    const b = (await req.json()) as { id?: string; title?: string; ts?: number; msgs?: unknown[] };
    return Response.json(await api("/api/chats/save", { method: "POST", body: { ...b, addr } }), nostore);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  const addr = await me();
  if (!addr) return no();
  await api("/api/chats/delete", { method: "POST", body: { addr, id: new URL(req.url).searchParams.get("id") } });
  return Response.json({ ok: true });
}
