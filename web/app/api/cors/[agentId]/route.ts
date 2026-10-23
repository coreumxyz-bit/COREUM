import { NextRequest, NextResponse } from "next/server";
import { api } from "@/lib/api";

interface CorsOverview {
  agents: Array<{
    id: string;
    cors_paid?: number;
    cors_staked?: number;
    cors_earned?: number;
  }>;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ agentId: string }> }
) {
  const { agentId } = await params;
  try {
    const overview = await api<CorsOverview>("/api/cors");
    const agent = overview.agents.find((a) => a.id === agentId);
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    return NextResponse.json({
      paid: agent.cors_paid || 0,
      staked: agent.cors_staked || 0,
      earned: agent.cors_earned || 0,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 502 });
  }
}
