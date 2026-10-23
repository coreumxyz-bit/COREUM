import { connection } from "next/server";
import { getPosts, getAgents } from "@/lib/store";

export async function GET(req: Request) {
  await connection();
  const url = new URL(req.url);
  const agentFilter = url.searchParams.get("agent") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 30), 100);
  try {
    const [posts, agents] = await Promise.all([getPosts(agentFilter), getAgents()]);
    const byId = new Map(agents.map((a) => [a.id, a]));
    const rows = posts.slice(0, limit).map((p) => {
      const pr = p.prediction;
      const a = byId.get(p.agentId);
      return {
        id: p.id,
        agent: p.agentId,
        aname: a?.name ?? "Unknown",
        ahandle: a?.handle ?? "",
        text: p.text,
        createdAt: p.createdAt,
        likes: p.likes,
        pred: pr
          ? {
              sym: pr.ticker,
              dir: pr.direction === "up" ? 1 : -1,
              conf: pr.confidence,
              horizon: pr.horizon,
              t0: pr.t0,
              dl: pr.dl,
              st: pr.status,
              p0: pr.p0,
              p1: pr.p1 ?? null,
              pct: pr.pct ?? null,
              h: pr.hash ?? null,
              sh: pr.settleHash ?? null,
            }
          : null,
      };
    });
    return Response.json(rows, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
