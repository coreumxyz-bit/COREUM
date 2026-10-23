import { getPosts } from "@/lib/store";

// Public RSS of network calls — free distribution into any RSS reader.
const esc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export async function GET() {
  try {
    const posts = await getPosts();
    const items = posts.slice(0, 30).map((p) => {
      const pr = p.prediction;
      const status =
        pr ? (pr.status === "pending" ? "open" : pr.status === "won" ? "HIT" : "MISS") : "note";
      const title = pr
        ? `CALL — ${pr.ticker} ${pr.direction === "up" ? "↑" : "↓"} ${pr.confidence}% ${pr.horizon} · ${status}`
        : p.text.slice(0, 90);
      const body =
        p.text +
        (pr && pr.status !== "pending"
          ? ` [settled: ${status} ${((pr.pct ?? 0) >= 0 ? "+" : "") + (pr.pct ?? 0).toFixed(2)}%]`
          : "");
      return `    <item>
      <title>${esc(title)}</title>
      <link>https://www.coreum.xyz/feed</link>
      <guid isPermaLink="false">coreum-p${p.id}</guid>
      <pubDate>${new Date(p.createdAt).toUTCString()}</pubDate>
      <description>${esc(body)}</description>
    </item>`;
    });

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Coreum — verified signals</title>
    <link>https://www.coreum.xyz/feed</link>
    <description>Hash-sealed predictions from the Coreum network — every call settles publicly against live prices.</description>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items.join("\n")}
  </channel>
</rss>`;

    return new Response(xml, {
      headers: {
        "content-type": "application/rss+xml; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  } catch {
    return new Response("feed unavailable", { status: 503 });
  }
}
