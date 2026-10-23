import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { googleFont } from "@/lib/ogFont";
import { microPrice } from "@/lib/cors";

// Site-wide share card (replaces the old static og.jpg). Same language as the
// hero: black, thin Sora, mono labels, sharp rects; numbers are live.
export const alt = "Coreum — Deploy a core. Get a verifiable answer. DePIN AI verification on Robinhood Chain L2.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DIM = "rgba(255,255,255,0.62)";
const LINE = "rgba(255,255,255,0.18)";
const LIME = "#e9e9e9";
const SITE = "https://www.coreum.xyz";

async function json<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export default async function Image() {
  const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
  const [thin, mono, monoLight, mark, stats, ledger, pool] = await Promise.all([
    googleFont("Sora", 200),
    googleFont("JetBrains Mono", 400),
    googleFont("JetBrains Mono", 300),
    readFile(join(process.cwd(), "public/logo-mark.png")).catch(() => null),
    json<{ done: number; agree: number; ref: number; community_online: number }>(`${base}/api/network`),
    json<{ i: number }[]>(`${base}/api/ledger?limit=1`),
    // the site's own cached proxy — GeckoTerminal rate-limits direct callers
    json<{ price: number | null; change24h: number | null }>(`${SITE}/api/token-price`),
  ]);

  const price = pool?.price ?? null;
  const ch = pool?.change24h ?? null;
  const rows: [string, string][] = [
    ...(price
      ? ([["$CORS", `$${microPrice(price)}${ch != null ? `  ${ch >= 0 ? "+" : ""}${ch.toFixed(1)}%` : ""}`]] as [string, string][])
      : []),
    ["Answers sealed", stats ? String(stats.done) : "—"],
    ["Avg agreement", stats ? `${Math.round(stats.agree * 100)}%` : "—"],
    ["Blocks in the ledger", ledger?.[0] ? String(ledger[0].i + 1) : "—"],
  ];
  const fonts = [
    thin && { name: "Sora", data: thin, weight: 200 as const },
    mono && { name: "Mono", data: mono, weight: 400 as const },
    monoLight && { name: "Mono", data: monoLight, weight: 300 as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 200 | 300 | 400 }[];
  const logo = mark ? `data:image/png;base64,${mark.toString("base64")}` : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#000",
          backgroundImage:
            "radial-gradient(circle at 18% 45%, rgba(255,255,255,0.10), rgba(0,0,0,0) 42%), linear-gradient(to right, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)",
          color: "#fff",
          fontFamily: "Mono",
        }}
      >
        {/* nav row */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "44px 64px 0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, fontFamily: "Sora", fontSize: 30, letterSpacing: 5 }}>
            {logo && <img src={logo} width={26} height={30} alt="" />}
            COREUM
          </div>
          <div style={{ display: "flex", border: "1px solid rgba(255,255,255,0.3)", padding: "12px 24px", fontSize: 17, letterSpacing: 3 }}>
            COREUM.XYZ
          </div>
        </div>

        {/* body */}
        <div style={{ display: "flex", flex: 1, alignItems: "center", justifyContent: "space-between", padding: "0 64px" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                alignSelf: "flex-start",
                background: "rgba(255,255,255,0.09)",
                padding: "12px 18px",
                fontSize: 17,
                letterSpacing: 3.5,
              }}
            >
              <span style={{ width: 8, height: 8, background: LIME }} />[ DEPIN AI VERIFICATION · ROBINHOOD CHAIN L2 ]
            </div>
            <div style={{ display: "flex", fontFamily: "Sora", fontSize: 150, letterSpacing: 4, lineHeight: 1, marginTop: 30 }}>
              COREUM
            </div>
            <div style={{ display: "flex", fontWeight: 300, fontSize: 22, letterSpacing: 3, color: DIM, marginTop: 22 }}>
              DEPLOY A CORE. GET A VERIFIABLE ANSWER.
            </div>
          </div>

          {/* live numbers, the "form" column */}
          <div style={{ display: "flex", flexDirection: "column", width: 330, gap: 4 }}>
            {rows.map(([k, v], i) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  padding: "14px 18px",
                  background: i === 0 ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.05)",
                }}
              >
                <span style={{ fontSize: 13, letterSpacing: 3, color: DIM }}>{k.toUpperCase()}</span>
                <span style={{ fontSize: 26, marginTop: 4 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* legal-style footer */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            borderTop: `1px solid ${LINE}`,
            padding: "22px 64px",
            fontSize: 17,
            letterSpacing: 2,
            color: DIM,
          }}
        >
          5 AI MODELS · COMMIT → REVEAL · ANCHORED ON ROBINHOOD CHAIN · COREUM.XYZ
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
