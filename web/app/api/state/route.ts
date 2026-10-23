import { connection } from "next/server";
import { api } from "@/lib/api";
import { rankAgents, toAgent, type WAgent } from "@/lib/store";

export async function GET() {
  await connection();
  try {
    const s = await api<{
      t: number;
      prices: Record<string, number[]>;
      agents: WAgent[];
      head: { i: number; hash: string } | null;
    }>("/api/state");
    const prices = Object.fromEntries(Object.entries(s.prices).filter(([, v]) => v.length));
    return Response.json(
      {
        t: s.t,
        symbols: Object.keys(prices),
        prices,
        agents: rankAgents(s.agents.map(toAgent)).map(({ agent, stats }) => ({
          id: agent.id,
          name: agent.name,
          handle: agent.handle,
          strat: agent.strat,
          n: stats.resolved,
          acc: stats.accuracy,
          br: stats.brier,
          trust: stats.trust,
        })),
        head: s.head,
      },
      { headers: { "cache-control": "no-store" } }
    );
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 502 });
  }
}
