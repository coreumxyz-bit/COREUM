import { ImageResponse } from "next/og";
import { googleFont } from "@/lib/ogFont";
import { isToken, verdictLabel, type Job, type XSource } from "@/lib/verify";
import { factLines, type TokenFacts } from "@/lib/token";

// Share card for a verifiable answer — what X shows under a reply with the proof link.
export const alt = "Coreum verdict — independent AI models, commit-reveal, anchored on Robinhood Chain";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const DIM = "rgba(255,255,255,0.6)";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [regular, medium] = await Promise.all([googleFont("Inter", 400), googleFont("Inter", 600)]);
  let job: Job | null = null;
  try {
    const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
    const r = await fetch(`${base}/api/job?id=${encodeURIComponent(id)}`, { signal: AbortSignal.timeout(6000) });
    if (r.ok) job = await r.json();
  } catch {}

  const src = job?.src ?? null;
  const v = job?.verdict ?? null;
  const token = isToken(src) ? src : null;
  const post = src && !token ? (src as XSource) : null;
  const verdict = !v ? (job?.phase === "failed" ? "NO VERDICT" : "CHECKING…") : verdictLabel(src, v);
  const quote = (token
    ? `${token.name} ($${token.symbol}) on Robinhood Chain — ${token.address.slice(0, 10)}…${token.address.slice(-6)}`
    : post ? post.text : job?.q ?? "Ask the network."
  ).slice(0, 220);
  const fonts = [
    regular && { name: "Inter", data: regular, weight: 400 as const },
    medium && { name: "Inter", data: medium, weight: 600 as const },
  ].filter(Boolean) as { name: string; data: ArrayBuffer; weight: 400 | 600 }[];

  // token checks get their own card: logo, verdict and the facts it was judged on
  if (token) {
    const f = Object.fromEntries(factLines(token.facts as unknown as TokenFacts));
    const tiles: [string, string][] = [
      ["Holders", f["Holders"]],
      ["Deployer holds", f["Deployer holds"]],
      ["Honeypot", f["Honeypot (can't sell)"]],
      ["Owner", f["Contract owner"].replace("no owner function", "none")],
      ["Liquidity", f["Liquidity"]],
      ["Curve", f["Launchpad curve"].replace(", not graduated", "").replace("not a launchpad token", "—")],
    ];
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
            backgroundImage: "radial-gradient(circle at 88% 10%, rgba(255,255,255,0.14), rgba(0,0,0,0) 46%)",
            color: "#fff",
            fontFamily: "Inter",
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 22, color: DIM }}>
            <span style={{ color: "#fff", fontWeight: 600 }}>Coreum · Token Check</span>
            <span>coreum.xyz/v/{id}</span>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
            {token.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={token.image} width={84} height={84} style={{ borderRadius: 42, border: "1px solid rgba(255,255,255,0.2)" }} alt="" />
            ) : (
              <div style={{ display: "flex", width: 84, height: 84, borderRadius: 42, border: "1px solid rgba(255,255,255,0.3)", alignItems: "center", justifyContent: "center", fontSize: 26 }}>
                {token.symbol.slice(0, 3)}
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 50, fontWeight: 600, letterSpacing: -1.5, lineHeight: 1.05 }}>
                {token.name}
                <span style={{ marginLeft: 16, color: DIM, fontWeight: 400 }}>{"$" + token.symbol}</span>
              </div>
              <span style={{ marginTop: 6, fontSize: 20, color: "rgba(255,255,255,0.45)" }}>
                {token.address.slice(0, 12)}…{token.address.slice(-8)} · Robinhood Chain
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
            <div style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 20, color: DIM }}>Network verdict</span>
              <span style={{ fontSize: String(verdict).length > 8 ? 96 : 120, fontWeight: 600, letterSpacing: -4, lineHeight: 1 }}>{verdict}</span>
            </div>
            {job?.n ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                <span style={{ fontSize: 56, fontWeight: 600, lineHeight: 1 }}>{Math.round((job.agree ?? 0) * 100)}%</span>
                <span style={{ marginTop: 6, fontSize: 20, color: DIM }}>of {job.n} AI cores agree</span>
              </div>
            ) : null}
          </div>

          <div style={{ display: "flex", gap: 12 }}>
            {tiles.map(([k, val]) => (
              <div
                key={k}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  padding: "14px 16px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "rgba(255,255,255,0.05)",
                }}
              >
                <span style={{ fontSize: 15, color: "rgba(255,255,255,0.5)" }}>{k}</span>
                <span style={{ marginTop: 4, fontSize: 24, fontWeight: 600 }}>{val}</span>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", fontSize: 19, color: "rgba(255,255,255,0.45)" }}>
            Judged from on-chain facts · commit → reveal · sealed on Robinhood Chain · not financial advice
          </div>
        </div>
      ),
      { ...size, fonts }
    );
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "52px 64px",
          background: "#000",
          backgroundImage: "radial-gradient(circle at 85% 15%, rgba(255,255,255,0.12), rgba(0,0,0,0) 45%)",
          color: "#fff",
          fontFamily: "Inter",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 24, color: DIM }}>
          <span style={{ color: "#fff", fontWeight: 600 }}>Coreum · AI verification</span>
          <span>coreum.xyz/v/{id}</span>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 26, color: DIM }}>{token ? "Token check — red flags?" : post ? `@${post.handle} posted:` : "The question:"}</div>
          <div
            style={{
              display: "flex",
              marginTop: 14,
              padding: "22px 26px",
              borderRadius: 22,
              border: "1px solid rgba(255,255,255,0.16)",
              background: "rgba(255,255,255,0.06)",
              fontSize: 32,
              lineHeight: 1.3,
            }}
          >
            “{quote}
            {quote.length >= 220 ? "…" : ""}”
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 22, color: DIM }}>Network verdict</span>
            <span style={{ fontSize: String(verdict).length > 8 ? 84 : 120, fontWeight: 600, letterSpacing: -4, lineHeight: 1 }}>{verdict}</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", fontSize: 26, color: DIM }}>
            {job?.n ? (
              <span style={{ color: "#fff" }}>
                {Math.round((job.agree ?? 0) * 100)}% of {job.n} independent AI models agree
              </span>
            ) : null}
            <span style={{ marginTop: 8 }}>commit → reveal · anchored on Robinhood Chain</span>
          </div>
        </div>
      </div>
    ),
    { ...size, fonts }
  );
}
