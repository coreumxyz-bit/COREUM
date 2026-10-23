import { connection } from "next/server";
import { isAddress, latestCheck, type Check } from "@/lib/publicApi";

// GET /api/v1/badge/{address} — an SVG badge with the latest verdict, for token
// pages. Wrap it in a link to https://www.coreum.xyz/t/{address}. Docs: /developers
const LABEL: Record<string, string> = { NO_RED_FLAGS: "NO RED FLAGS", RED_FLAGS: "RED FLAGS", MIXED: "MIXED" };

function text(c: Check) {
  if (c.status === "not_checked") return "not checked yet";
  if (c.status === "checking") return "checking…";
  const pct = c.agreement != null ? ` · ${Math.round(c.agreement * 100)}%` : "";
  return `${c.grade ? c.grade.letter + " · " : ""}${LABEL[c.verdict ?? ""] ?? "—"}${pct}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const width = (s: string) => Math.round(s.length * 6.6 + 22); // 11px Verdana, roughly

function svg(right: string, verdict: string | null) {
  const left = "Coreum check";
  const lw = width(left), rw = width(right), w = lw + rw;
  // monochrome like the site: red flags invert, so they stand out
  const red = verdict === "RED_FLAGS";
  const bg = red ? "#000" : verdict === "MIXED" ? "#9a9a9a" : verdict ? "#fff" : "#555";
  const fg = red || !verdict ? "#fff" : "#000";
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="22" role="img" aria-label="${esc(left)}: ${esc(right)}">
<title>${esc(left)}: ${esc(right)}</title>
<clipPath id="r"><rect width="${w}" height="22" rx="5"/></clipPath>
<g clip-path="url(#r)">
<rect width="${lw}" height="22" fill="#141414"/>
<rect x="${lw}" width="${rw}" height="22" fill="${bg}"/>
${red ? `<rect x="${lw + 0.5}" y="0.5" width="${rw - 1}" height="21" fill="none" stroke="#fff"/>` : ""}
</g>
<g font-family="Verdana,DejaVu Sans,sans-serif" font-size="11" text-anchor="middle">
<text x="${lw / 2}" y="15" fill="#fff">${esc(left)}</text>
<text x="${lw + rw / 2}" y="15" fill="${fg}" font-weight="bold">${esc(right)}</text>
</g>
</svg>`;
}

export async function GET(_req: Request, { params }: { params: Promise<{ address: string }> }) {
  await connection();
  const { address } = await params;
  let body: string;
  if (!isAddress(address)) body = svg("bad address", null);
  else {
    try {
      const c = await latestCheck(address);
      body = svg(text(c), c.verdict);
    } catch {
      body = svg("unavailable", null);
    }
  }
  return new Response(body, {
    headers: {
      "content-type": "image/svg+xml; charset=utf-8",
      "access-control-allow-origin": "*",
      "cache-control": "public, max-age=300, s-maxage=300, stale-while-revalidate=3600",
    },
  });
}
