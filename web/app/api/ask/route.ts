import { cookies } from "next/headers";
import { connection } from "next/server";
import { holderFromCookie, readBurn } from "@/lib/corsChain";
import { api, clientIp } from "@/lib/api";
import { fetchXPost, parseXUrl, questionFor } from "@/lib/xpost";
import { fetchToken, parseToken, questionForToken } from "@/lib/token";

// Submit to the verification network: a question/claim, or a link to an X post
// (fetched here, so the network checks the post's real words and author), or a
// token address on Robinhood Chain (its on-chain facts are fetched here too).
export async function POST(req: Request) {
  await connection();
  try {
    const { q, url, paid_tx } = (await req.json()) as { q?: string; url?: string; paid_tx?: string };
    const link = (url || q || "").trim();
    // $CORS: the holder tier (signed cookie) or one check paid by a burn past the daily limit
    const headers: Record<string, string> = {};
    const holder = holderFromCookie((await cookies()).get("coreum_holder")?.value);
    if (holder) headers["x-coreum-holder"] = holder;
    if (paid_tx) {
      const b = await readBurn(paid_tx);
      if ("pending" in b) return Response.json({ error: "the burn is not mined yet, try again in a few seconds" }, { status: 409 });
      if ("error" in b) return Response.json({ error: b.error }, { status: 400 });
      await api("/api/burn/record", { method: "POST", body: { tx: paid_tx, addr: b.from, amount: b.amount.toString(), purpose: "check" } });
      headers["x-coreum-paid"] = paid_tx.toLowerCase();
    }
    if (parseXUrl(link)) {
      const post = await fetchXPost(link);
      const r = await api("/api/ask", { method: "POST", body: { q: questionFor(post), src: post }, ip: await clientIp(), headers });
      return Response.json(r, { headers: { "cache-control": "no-store" } });
    }
    const token = parseToken(link);
    if (token) {
      const t = await fetchToken(token);
      const r = await api("/api/ask", { method: "POST", body: { q: questionForToken(t), src: t }, ip: await clientIp(), headers });
      return Response.json(r, { headers: { "cache-control": "no-store" } });
    }
    const r = await api("/api/ask", { method: "POST", body: { q }, ip: await clientIp(), headers });
    return Response.json(r, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
