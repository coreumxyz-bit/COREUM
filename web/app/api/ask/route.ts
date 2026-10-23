import { connection } from "next/server";
import { api, clientIp } from "@/lib/api";
import { fetchXPost, parseXUrl, questionFor } from "@/lib/xpost";
import { fetchToken, parseToken, questionForToken } from "@/lib/token";

// Submit to the verification network: a question/claim, or a link to an X post
// (fetched here, so the network checks the post's real words and author), or a
// token address on Robinhood Chain (its on-chain facts are fetched here too).
export async function POST(req: Request) {
  await connection();
  try {
    const { q, url } = (await req.json()) as { q?: string; url?: string };
    const link = (url || q || "").trim();
    if (parseXUrl(link)) {
      const post = await fetchXPost(link);
      const r = await api("/api/ask", { method: "POST", body: { q: questionFor(post), src: post }, ip: await clientIp() });
      return Response.json(r, { headers: { "cache-control": "no-store" } });
    }
    const token = parseToken(link);
    if (token) {
      const t = await fetchToken(token);
      const r = await api("/api/ask", { method: "POST", body: { q: questionForToken(t), src: t }, ip: await clientIp() });
      return Response.json(r, { headers: { "cache-control": "no-store" } });
    }
    const r = await api("/api/ask", { method: "POST", body: { q }, ip: await clientIp() });
    return Response.json(r, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
