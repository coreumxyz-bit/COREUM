// Verification network: a question is a job; cores commit a hash of their
// answer first, reveal it after, and the majority verdict is sealed.
export type Verdict = "YES" | "NO" | "UNSURE";

export type JobWork = {
  core: string;
  name: string;
  handle: string;
  kind: string; // refcore | external
  model: string | null;
  commit: string;
  ts_commit: number;
  ts_reveal: number | null;
  ok: number | null;
  reward: number;
  verdict: Verdict | null;
  reason: string | null;
  salt: string | null;
};

// Verdicts are written to this contract on Robinhood Chain (api/contracts/deployments.json)
export const VERDICTS_CONTRACT = "0x5A2332aFb10354d2657AAa1Ad1176507E00099C4";

export type XSource = {
  url: string;
  id: string;
  author: string;
  handle: string;
  avatar: string;
  text: string;
  created: string;
};

// a Token Check job: facts from GeckoTerminal + the token contract (lib/token.ts)
export type TokenSrc = {
  kind: "token";
  address: string;
  name: string;
  symbol: string;
  image: string;
  url: string;
  facts: Record<string, number | string | boolean | null>;
  via?: "radar";
};

export const isToken = (s: Job["src"]): s is TokenSrc => !!s && (s as TokenSrc).kind === "token";

/** How a verdict reads for each kind of job. */
export const verdictLabel = (src: Job["src"], v: Verdict | null) =>
  !v ? null : isToken(src) ? { YES: "NO RED FLAGS", NO: "RED FLAGS", UNSURE: "MIXED" }[v] : src ? { YES: "TRUE", NO: "FALSE", UNSURE: "UNCLEAR" }[v] : v;

export type Job = {
  id: number;
  q: string;
  phase: "commit" | "reveal" | "sealing" | "done" | "failed";
  created: number;
  commit_dl: number;
  reveal_dl: number | null;
  verdict: Verdict | null;
  agree: number | null;
  n: number | null;
  h: string | null;
  block_i: number | null; // ledger position of the sealed result
  done_at: number | null;
  src: XSource | TokenSrc | null; // the X post or token this job checks, if any
  chain_tx: string | null; // CoreumVerdicts seal tx on Robinhood Chain
  work: JobWork[];
};

export type Core = {
  id: string;
  name: string;
  handle: string;
  kind: string;
  last_seen: number | null;
  cors_earned: number;
  jobs: number;
  majority: number;
  model: string | null;
};

export type NetworkStats = { total: number; done: number; agree: number; ref: number; community_online: number };

export const modelLabel = (m: string | null) =>
  !m ? "—" : m.replace(/^@cf\//, "").replace(/^ollama:/, "ollama · ").replace(/^pollinations:/, "");

export const EXAMPLES = [
  "Is Bitcoin's supply capped at 21 million coins?",
  "Did Ethereum switch to proof-of-stake?",
  "Will SOL close above $200 this week?",
  "Is the Moon made of cheese?",
];
