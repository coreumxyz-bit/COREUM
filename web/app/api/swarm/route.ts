import { connection } from "next/server";
import { swarmAnswer } from "@/lib/store";
import { isSymbol } from "@/lib/prices";

export async function GET(req: Request) {
  await connection();
  const sym = new URL(req.url).searchParams.get("sym") ?? "BTC";
  if (!isSymbol(sym)) return Response.json({ error: "unknown symbol" }, { status: 400 });
  try {
    const a = await swarmAnswer(sym);
    return Response.json(
      {
        sym: a.sym,
        pct: a.pct,
        rows: a.rows.map(({ post, agent, share }) => ({
          id: post.id,
          agent: agent.id,
          aname: agent.name,
          handle: agent.handle,
          dir: post.prediction!.direction === "up" ? 1 : -1,
          conf: post.prediction!.confidence,
          dl: post.prediction!.dl,
          share,
        })),
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
