import { ImageResponse } from "next/og";
import { googleFont } from "@/lib/ogFont";
import { GRADE_NOTE } from "@/lib/grade";
import { isAddress, latestCheck } from "@/lib/publicApi";

// The card X shows under a shared grade link: the token, its letter and why.
export const alt = "Coreum grade — six AI cores and the on-chain facts, one letter from A to F";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DIM = "rgba(255,255,255,0.6)";

export default async function Image({ params }: { params: Promise<{ address: string }> }) {
  const { address } = await params;
  const [regular, medium] = await Promise.all([googleFont("Inter", 400), googleFont("Inter", 600)]);
  const c = isAddress(address) ? await latestCheck(address).catch(() => null) : null;
  const g = c && c.status === "checked" ? c.grade : null;
  const fonts = [
    regular && { name: "Inter", data: regular, weight: 400 as const },
    medium && { name: "Inter", data: medium, weight: 600 as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 600 }[];
  const name = c && c.status !== "not_checked" ? c : null;
  const reasons = g?.reasons.slice(0, 3) ?? [];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "46px 60px",
          background: "#000",
          backgroundImage: "radial-gradient(circle at 80% 30%, rgba(255,255,255,0.14), rgba(0,0,0,0) 50%)",
          color: "#fff",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: DIM }}>
          <span style={{ color: "#fff", fontWeight: 600 }}>Coreum grade</span>
          <span>coreum.xyz/grades</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 60 }}>
          <div style={{ display: "flex", fontSize: 300, fontWeight: 600, lineHeight: 0.8, letterSpacing: -10 }}>{g ? g.letter : "?"}</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", fontSize: 54, fontWeight: 600, letterSpacing: -1.5 }}>
              {name ? `$${name.symbol}` : "Not checked yet"}
            </div>
            <div style={{ display: "flex", fontSize: 28, color: DIM }}>{g ? `${g.score}/100 · ${GRADE_NOTE[g.letter]}` : "Run a check on coreum.xyz/token"}</div>
            {reasons.map((r) => (
              <div key={r.why} style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.75)" }}>
                {`${r.points}  ${r.why}`}
              </div>
            ))}
            {g && !reasons.length && <div style={{ display: "flex", fontSize: 22, color: "rgba(255,255,255,0.75)" }}>No deductions</div>}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 20, color: DIM }}>
          Six AI cores · on-chain facts · verdict sealed on Robinhood Chain · not financial advice
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
