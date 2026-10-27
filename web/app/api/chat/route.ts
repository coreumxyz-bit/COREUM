import { cookies } from "next/headers";
import { connection } from "next/server";
import { api, clientIp } from "@/lib/api";
import { holderFromCookie } from "@/lib/corsChain";
import { fetchToken, questionForToken } from "@/lib/token";

export const maxDuration = 90;

// Ask Coreum: the Worker streams the conversation (status, text, done). When a token
// needs a fresh check, the stream says so and the check is started here like a Token
// Check, under the visitor's own limits; its link goes back down the same stream.
export async function POST(req: Request) {
  await connection();
  const { messages } = (await req.json().catch(() => ({}))) as { messages?: { role: string; content: string }[] };
  const ip = await clientIp();
  const holder = holderFromCookie((await cookies()).get("coreum_holder")?.value);
  const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
  const up = await fetch(base + "/api/chat", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-coreum-secret": process.env.COREUM_SITE_SECRET ?? "",
      ...(ip ? { "x-client-ip": ip } : {}),
      ...(holder ? { "x-coreum-holder": holder } : {}),
    },
    body: JSON.stringify({ messages }),
    cache: "no-store",
    signal: req.signal,
  }).catch(() => null);
  if (!up || !up.ok || !up.body) {
    const j = (await up?.json().catch(() => null)) as { error?: string } | null;
    return Response.json({ error: j?.error ?? "the assistant is busy, try again" }, { status: up?.status && up.status !== 200 ? up.status : 502 });
  }

  const enc = new TextEncoder(), dec = new TextDecoder();
  const startChecks = async (addresses: string[]) => {
    const out = [];
    for (const a of addresses.slice(0, 2)) {
      try {
        const t = await fetchToken(a);
        const job = await api<{ id: number }>("/api/ask", { method: "POST", body: { q: questionForToken(t), src: t }, ip, headers: holder ? { "x-coreum-holder": holder } : {} });
        out.push({ address: a, symbol: t.symbol, job: job.id, page: `/v/${job.id}` });
      } catch (e) {
        out.push({ address: a, error: e instanceof Error ? e.message : String(e) });
      }
    }
    return out;
  };

  const body = new ReadableStream({
    async start(ctl) {
      const reader = up.body!.getReader();
      let buf = "";
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf("\n\n")) >= 0) {
            const chunk = buf.slice(0, i);
            buf = buf.slice(i + 2);
            const ev = chunk.startsWith("data:") ? (JSON.parse(chunk.slice(5)) as { type: string; addresses?: string[] }) : null;
            if (ev?.type === "checks" && ev.addresses?.length) {
              ctl.enqueue(enc.encode(`data: ${JSON.stringify({ type: "status", text: "Starting a fresh check" })}\n\n`));
              ctl.enqueue(enc.encode(`data: ${JSON.stringify({ type: "started", checks: await startChecks(ev.addresses) })}\n\n`));
            } else ctl.enqueue(enc.encode(chunk + "\n\n"));
          }
        }
      } catch {
        ctl.enqueue(enc.encode(`data: ${JSON.stringify({ type: "error", text: "the connection dropped, try again" })}\n\n`));
      }
      ctl.close();
    },
  });
  return new Response(body, { headers: { "content-type": "text/event-stream; charset=utf-8", "cache-control": "no-store", "x-accel-buffering": "no" } });
}
