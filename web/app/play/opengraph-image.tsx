import { ImageResponse } from "next/og";
import { googleFont } from "@/lib/ogFont";
import type { Arena } from "@/lib/play";

export const alt = "Beat the AI — BTC up or down in 15 minutes, you vs Coreum's AI swarm";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const LIME = "#e9e9e9";
const RED = "rgba(255,255,255,0.45)";
const GRAY = "#8a8a8a";

export default async function Image() {
  const [display, sans, sansBold] = await Promise.all([
    googleFont("Inter", 500),
    googleFont("Inter", 400),
    googleFont("Inter", 600),
  ]);
  let a: Arena | null = null;
  try {
    const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
    const r = await fetch(`${base}/api/arena`, { signal: AbortSignal.timeout(6000) });
    if (r.ok) a = await r.json();
  } catch {}

  const aiAcc = a?.ai.acc != null ? `${Math.round(a.ai.acc * 100)}%` : "—";
  const humAcc = a?.humans.acc != null ? `${Math.round(a.humans.acc * 100)}%` : "?";
  const D = display ? "Inter" : "sans-serif";
  const fonts = [
    display && { name: "Inter", data: display, weight: 400 as const },
    sans && { name: "Inter", data: sans, weight: 400 as const },
    sansBold && { name: "Inter", data: sansBold, weight: 700 as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 700 }[];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 64px",
          color: "#fff",
          fontFamily: "Inter",
          background: "#000",
          backgroundImage:
            "radial-gradient(circle at 85% 20%, rgba(233,233,233,0.20), rgba(0,0,0,0) 45%), radial-gradient(circle at 10% 110%, rgba(255,255,255,0.06), rgba(0,0,0,0) 40%)",
        }}
      >
        {/* top bar */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontFamily: D, fontSize: 30, letterSpacing: -1 }}>COREUM</span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "8px 18px",
              borderRadius: 999,
              border: `1px solid rgba(233,233,233,0.4)`,
              background: "rgba(233,233,233,0.10)",
              color: LIME,
              fontSize: 20,
              fontWeight: 700,
              letterSpacing: 1,
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 999, background: LIME }} />
            LIVE GAME · FREE · NO WALLET
          </span>
        </div>

        {/* body */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", fontFamily: D, fontSize: 116, letterSpacing: -5, lineHeight: 0.95 }}>
              <span>Beat the&nbsp;</span>
              <span style={{ color: LIME }}>AI.</span>
            </div>
            <div style={{ display: "flex", marginTop: 22, fontSize: 32, color: "#d0d0d0" }}>
              BTC · ETH · SOL — up or down in 15 minutes.
            </div>
            <div style={{ display: "flex", gap: 18, marginTop: 34 }}>
              <span
                style={{
                  display: "flex",
                  padding: "18px 44px",
                  borderRadius: 22,
                  background: LIME,
                  color: "#000",
                  fontFamily: D,
                  fontSize: 38,
                  boxShadow: "0 12px 40px rgba(233,233,233,0.45)",
                }}
              >
                UP
              </span>
              <span
                style={{
                  display: "flex",
                  padding: "18px 44px",
                  borderRadius: 22,
                  background: RED,
                  color: "#000",
                  fontFamily: D,
                  fontSize: 38,
                  boxShadow: "0 12px 40px rgba(255,255,255,0)",
                }}
              >
                DOWN
              </span>
            </div>
          </div>

          {/* scoreboard */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: 280,
              borderRadius: 26,
              border: "1px solid rgba(255,255,255,0.14)",
              background: "rgba(255,255,255,0.04)",
              overflow: "hidden",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", padding: "22px 26px", borderBottom: "1px solid rgba(255,255,255,0.12)" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: GRAY, letterSpacing: 1 }}>AI SWARM</span>
              <span style={{ fontFamily: D, fontSize: 64, lineHeight: 1.1 }}>{aiAcc}</span>
              <span style={{ fontSize: 17, color: GRAY }}>
                hit rate · {a?.ai.n ?? 0} calls · 7d
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", padding: "22px 26px", background: "rgba(233,233,233,0.07)" }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: LIME, letterSpacing: 1 }}>HUMANS</span>
              <span style={{ fontFamily: D, fontSize: 64, lineHeight: 1.1, color: LIME }}>{humAcc}</span>
              <span style={{ fontSize: 17, color: GRAY }}>
                {a && a.humans.n > 0 ? `${a.humans.n} calls · ${a.humans.players} players` : "your seat is open"}
              </span>
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 20, color: GRAY }}>
          <span>Every call sealed in a public SHA-256 ledger · misses kept forever</span>
          <span style={{ color: "#fff", fontWeight: 700 }}>coreum.xyz/play · $CORS</span>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
