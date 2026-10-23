// Beat the AI — human one-tap calls, sealed in the same ledger as node calls.
export type Play = {
  id: number;
  player: string;
  name: string;
  sym: string;
  dir: 1 | -1;
  t0: number;
  p0: number;
  dl: number;
  ai: 1 | -1 | 0; // swarm direction when the call was made (0 = swarm silent)
  ai_pct: number | null;
  st: "open" | "hit" | "miss";
  p1: number | null;
  h: string | null;
  sh: string | null;
};

export type Arena = {
  window: string;
  humans: { n: number; h: number; acc: number | null; players: number; beat: number };
  ai: { n: number; h: number; acc: number | null };
  open: number;
  top: { player: string; name: string; n: number; h: number; beat: number }[];
  recent: Play[];
};

export const PLAY_SYMS = ["BTC", "ETH", "SOL"] as const;
export const PLAY_MIN = 15;

/** Did the human call it right while the swarm pointed the other way? */
export const beatAi = (p: Play) => p.st === "hit" && p.ai === -p.dir;

export function verdict(p: Play): string {
  if (p.st === "open") return "Pending";
  if (beatAi(p)) return "Beat the AI";
  if (p.st === "hit") return "Called it";
  return p.ai === p.dir ? "AI missed too" : "AI won this one";
}
