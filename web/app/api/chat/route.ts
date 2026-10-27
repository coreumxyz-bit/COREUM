import { cookies } from "next/headers";
import { connection } from "next/server";
import { api, clientIp } from "@/lib/api";
import { holderFromCookie } from "@/lib/corsChain";
import { fetchToken, questionForToken } from "@/lib/token";

export const maxDuration = 60;

// Ask Coreum: the Worker runs the conversation and its tools; when a token needs a
// fresh check, it is started here like a Token Check, under the visitor's own limits.
export async function POST(req: Request) {
  await connection();
  try {
    const { messages } = (await req.json()) as { messages?: { role: string; content: string }[] };
    const ip = await clientIp();
    const holder = holderFromCookie((await cookies()).get("coreum_holder")?.value);
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-coreum-secret": process.env.COREUM_SITE_SECRET ?? "",
      ...(ip ? { "x-client-ip": ip } : {}),
      ...(holder ? { "x-coreum-holder": holder } : {}),
    };
    const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
    const r = await fetch(base + "/api/chat", { method: "POST", headers, body: JSON.stringify({ messages }), signal: AbortSignal.timeout(55_000), cache: "no-store" });
    const j = (await r.json()) as { reply?: string; checks?: string[]; left?: number; error?: string };
    if (!r.ok) return Response.json({ error: j.error ?? "the assistant is busy, try again" }, { status: r.status });

    const started: { address: string; symbol?: string; job?: number; page?: string; error?: string }[] = [];
    for (const a of j.checks ?? []) {
      try {
        const t = await fetchToken(a);
        const job = await api<{ id: number }>("/api/ask", { method: "POST", body: { q: questionForToken(t), src: t }, ip, headers: holder ? { "x-coreum-holder": holder } : {} });
        started.push({ address: a, symbol: t.symbol, job: job.id, page: `/v/${job.id}` });
      } catch (e) {
        started.push({ address: a, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return Response.json({ reply: j.reply, left: j.left, started }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 400 });
  }
}
