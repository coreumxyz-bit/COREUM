import { dailySummary } from "@/lib/summary";

// Plain-text UTC-day recap — the same text the daily_summary MCP tool returns.
// A future X/Telegram bot can fetch and post it verbatim.
export async function GET() {
  try {
    const s = await dailySummary();
    return new Response(s.text, {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  } catch {
    return new Response("summary unavailable", { status: 503 });
  }
}
