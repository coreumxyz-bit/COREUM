import { connection } from "next/server";
import { api } from "@/lib/api";
import { grade, type Letter } from "@/lib/grade";
import type { TokenFacts } from "@/lib/token";
import { CORS_HEADERS } from "@/lib/publicApi";

// GET /api/v1/grades — the latest grade of every token checked in the last week,
// newest first. The hourly writer copies these into CoreumTokenRegistry on
// Robinhood Chain. Docs: /developers
const LETTER: Record<Letter, number> = { A: 1, B: 2, C: 3, D: 4, F: 5 };
const VERDICT = { YES: 1, NO: 2, UNSURE: 3 } as const;

type Row = { id: number; verdict: "YES" | "NO" | "UNSURE"; agree: number; done_at: number; src: { address: string; symbol: string; facts: TokenFacts } };

export async function GET() {
  await connection();
  try {
    const rows = await api<Row[]>("/api/token-checks?limit=100");
    const seen = new Set<string>();
    const out = rows
      .filter((r) => r.src?.address && Date.now() / 1000 - r.done_at < 7 * 86400 && !seen.has(r.src.address) && seen.add(r.src.address))
      .map((r) => {
        const g = grade(r.verdict, r.agree, r.src.facts);
        return {
          address: r.src.address,
          symbol: r.src.symbol,
          letter: g.letter,
          letter_code: LETTER[g.letter], // 1 A … 5 F, as stored on chain
          score: g.score,
          verdict_code: VERDICT[r.verdict], // 1 no red flags · 2 red flags · 3 mixed
          agree_pct: Math.round((r.agree ?? 0) * 100),
          job: r.id,
          checked_at: r.done_at,
        };
      });
    return Response.json(out, { headers: { ...CORS_HEADERS, "cache-control": "public, max-age=60, s-maxage=120" } });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 502, headers: CORS_HEADERS });
  }
}
