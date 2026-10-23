// Coreum grade: one letter for a token check, built from the network's verdict
// and the on-chain facts the cores judged. Fixed rules, every point explained —
// the same check always gets the same grade. Explained on /grades.
import type { TokenFacts } from "@/lib/token";

export type Letter = "A" | "B" | "C" | "D" | "F";
export type Grade = { letter: Letter; score: number; reasons: { why: string; points: number }[] };

const LETTERS: [number, Letter][] = [[85, "A"], [70, "B"], [55, "C"], [40, "D"], [0, "F"]];

export function grade(verdict: "YES" | "NO" | "UNSURE" | null | undefined, agree: number | null | undefined, f: TokenFacts): Grade {
  const reasons: Grade["reasons"] = [];
  const minus = (points: number, why: string) => reasons.push({ why, points: -points });
  const a = agree ?? 0.5;

  // the six cores' verdict carries the most weight, scaled by how many agree
  if (verdict === "NO") minus(Math.round(30 + 25 * a), `Cores found red flags (${Math.round(a * 100)}% agree)`);
  else if (verdict === "UNSURE") minus(20, "Cores were split or unsure");
  else if (verdict === "YES" && a < 0.75) minus(15, `Only ${Math.round(a * 100)}% of cores agree it is clean`);

  if (f.honeypot) minus(100, "Honeypot — selling may be blocked");
  if (f.stockBorrowed) minus(25, `Uses the ${f.stockBorrowed} ticker but is not the official stock token`);
  if (f.change24 != null && f.change24 <= -50) minus(30, `Price fell ${Math.abs(f.change24).toFixed(0)}% in 24h — likely dumped`);
  if (f.owner && f.owner !== "none" && f.owner !== "renounced") minus(25, "The contract has an active owner");
  if (f.dev != null && f.dev >= 10) minus(15, `Deployer holds ${f.dev.toFixed(1)}% of supply`);
  else if (f.dev != null && f.dev >= 5) minus(8, `Deployer holds ${f.dev.toFixed(1)}% of supply`);

  if (f.devLaunches == null && !f.devShared) minus(5, "Deployer history unknown");
  else if (f.devLaunches != null && f.devLaunches >= 5 && f.devDead != null) {
    const n = Math.min(f.devLaunches, 30);
    if (f.devDead / n >= 0.7) minus(25, `Deployer's earlier launches mostly died (${f.devDead} of ${n})`);
    else if (f.devLaunches >= 20) minus(12, `Deployer launched ${f.devLaunches} other tokens`);
  }

  // many wallets buying most of the supply at launch, still holding it: one hand can dump it all at once
  if (f.launchBuyers != null && f.launchBuyers >= 20 && (f.launchHeldPct ?? 0) >= 15)
    minus(35, `Bundled launch: ${f.launchBuyers} wallets bought ${f.launchBoughtPct?.toFixed(0)}% in the first 5 min and still hold ${f.launchHeldPct?.toFixed(0)}%`);
  else if (f.launchBuyers != null && (f.launchBoughtPct ?? 0) >= 25)
    minus(10, `Sniped launch: ${f.launchBuyers} wallets bought ${f.launchBoughtPct?.toFixed(0)}% in the first 5 min`);

  // the curve itself is a top holder before graduation; what wallets hold beyond it counts
  const inWallets = f.top10 == null ? null : f.graduated ? f.top10 : f.curvePct != null ? f.top10 - f.curvePct : null;
  if (inWallets != null && inWallets >= 40) minus(15, `Top wallets own ~${inWallets.toFixed(0)}% of supply`);
  if (f.liquidity != null && f.liquidity < 1000) minus(15, "Under $1K liquidity");
  if (f.holders != null && f.holders < 50) minus(10, `Only ${f.holders} holders`);
  if (f.ageDays != null && f.ageDays < 1) minus(10, "Less than a day old — too early to tell");

  const score = Math.max(0, 100 + reasons.reduce((s, r) => s + r.points, 0));
  // red flags from the cores always grade F
  const letter = verdict === "NO" ? "F" : LETTERS.find(([min]) => score >= min)![1];
  return { letter, score, reasons };
}

export const GRADE_NOTE: Record<Letter, string> = {
  A: "No red flags in the facts and the cores agree",
  B: "Mostly clean, a few things to watch",
  C: "Mixed — read the facts before buying",
  D: "Several warning signs",
  F: "Red flags",
};
