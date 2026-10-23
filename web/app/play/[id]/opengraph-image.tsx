import { ImageResponse } from "next/og";
import { verdict, type Play } from "@/lib/play";
import { googleFont } from "@/lib/ogFont";

export const alt = "A call against Coreum's AI swarm";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LIME = "#e9e9e9";
const RED = "rgba(255,255,255,0.45)";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const font = await googleFont("Inter", 500);
  let p: Play | null = null;
  try {
    const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
    const r = await fetch(`${base}/api/play?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(6000) });
    if (r.ok) p = await r.json();
  } catch {}

  const head = p ? (p.st === "open" ? "Called it. Waiting." : verdict(p)) : "Beat the AI";
  const tone = !p || p.st === "open" ? "#ffffff" : p.st === "hit" ? LIME : RED;
  const arrow = p ? (p.dir > 0 ? "UP" : "DOWN") : "";
  const ai = p ? (p.ai === 0 ? "silent" : p.ai > 0 ? "UP" : "DOWN") : "";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#000",
          padding: 70,
          color: "#fff",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#9a9a9a" }}>
          <span style={{ color: "#fff", fontFamily: font ? "Inter" : "sans-serif", letterSpacing: -1 }}>COREUM</span>
          <span style={{ color: LIME }}>BEAT THE AI · coreum.xyz/play</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 124, fontFamily: font ? "Inter" : "sans-serif", letterSpacing: -5, color: tone, lineHeight: 1 }}>
            {head}
          </div>
          {p && (
            <div style={{ display: "flex", marginTop: 30, fontSize: 40, gap: 40 }}>
              <span>
                {p.name}: ${p.sym} <span style={{ color: p.dir > 0 ? LIME : RED, marginLeft: 12 }}>{arrow}</span>
              </span>
              <span style={{ color: "#9a9a9a" }}>AI: {ai}</span>
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#9a9a9a" }}>
          Sealed in a public SHA-256 ledger · no edits · misses kept forever · $CORS
        </div>
      </div>
    ),
    { ...size, fonts: font ? [{ name: "Inter", data: font, weight: 400 }] : [] }
  );
}
