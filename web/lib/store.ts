// Data layer: everything is read from the Coreum API (D1 database, hash
// chain, bots and settlement all run server-side in the Worker).
import { api } from "./api";

export type Prediction = {
  ticker: string;
  direction: "up" | "down";
  horizon: string;
  minutes: number;
  confidence: number;
  status: "pending" | "won" | "lost";
  t0: number;
  dl: number;
  p0: number;
  p1?: number;
  pct?: number;
  hash?: string;
  settleHash?: string;
};

export type Strategy = "momentum" | "meanrev" | "breakout";

export type AgentStats = {
  posts: number;
  resolved: number;
  won: number;
  accuracy: number | null;
  brier: number | null;
  trust: number;
};

export type Agent = {
  id: string;
  name: string;
  handle: string;
  persona: string;
  accent: string;
  createdAt: number;
  followers: number;
  strat: Strategy;
  focus: string;
  rate: number;
  lastPost: number;
  holder?: boolean;
  stats: AgentStats;
};

export type Post = {
  id: string;
  agentId: string;
  text: string;
  prediction: Prediction | null;
  createdAt: number;
  likes: number;
};

/* ---- wire types (what the API returns) ---- */
export type WAgent = {
  id: string; name: string; handle: string; persona: string; created: number;
  kind: string; strat: string; focus: string; rate: number; followers: number;
  n: number; h: number; acc: number; br: number; trust: number; holder?: number;
};
export type WPred = {
  id: number; agent: string; aname: string; ahandle: string; sym: string;
  dir: 1 | -1; conf: number; t0: number; p0: number; dl: number;
  st: "open" | "hit" | "miss"; p1: number | null; h: string | null;
  sh: string | null; note: string | null; likes?: number;
};

const ACCENTS = ["#ffffff", "#d9d9d9", "#9a9a9a", "#bdbdbd", "#6f6f6f", "#efefef"];
export const HORIZONS = [5, 15, 60, 240, 1440];

export function horizonLabel(min: number): string {
  if (min < 60) return `${min}m`;
  if (min < 1440) return `${min / 60}h`;
  return `${min / 1440}d`;
}

function accentFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ACCENTS[h % ACCENTS.length];
}

export function toAgent(w: WAgent): Agent {
  return {
    id: w.id,
    name: w.name,
    handle: w.handle,
    persona: w.persona,
    accent: accentFor(w.id),
    createdAt: w.created * 1000,
    followers: w.followers,
    strat: w.strat as Strategy,
    focus: w.focus,
    rate: w.rate,
    lastPost: 0,
    holder: !!w.holder,
    stats: {
      posts: w.n,
      resolved: w.n,
      won: w.h,
      accuracy: w.n ? Math.round(w.acc * 100) : null,
      brier: w.n ? w.br : null,
      trust: w.trust,
    },
  };
}

export function toPost(p: WPred): Post {
  const minutes = Math.round((p.dl - p.t0) / 60);
  const settled = p.st !== "open";
  return {
    id: String(p.id),
    agentId: p.agent,
    text:
      p.note ??
      `CALL — ${p.sym} ${p.dir === 1 ? "higher" : "lower"} within ${horizonLabel(minutes)}. Confidence ${p.conf}%.`,
    prediction: {
      ticker: p.sym,
      direction: p.dir === 1 ? "up" : "down",
      minutes,
      horizon: horizonLabel(minutes),
      confidence: p.conf,
      status: p.st === "open" ? "pending" : p.st === "hit" ? "won" : "lost",
      t0: p.t0,
      dl: p.dl,
      p0: p.p0,
      p1: settled && p.p1 != null ? p.p1 : undefined,
      pct: settled && p.p1 != null ? (p.p1 / p.p0 - 1) * 100 * p.dir : undefined,
      hash: p.h ?? undefined,
      settleHash: p.sh ?? undefined,
    },
    createdAt: p.t0 * 1000,
    likes: p.likes ?? 0,
  };
}

export function rankAgents(agents: Agent[]): { agent: Agent; stats: AgentStats }[] {
  return agents
    .map((agent) => ({ agent, stats: agent.stats }))
    .sort(
      (a, b) =>
        (b.stats.resolved >= 5 ? 1 : 0) - (a.stats.resolved >= 5 ? 1 : 0) ||
        b.stats.trust - a.stats.trust
    );
}

/** Bots, settlement and the ledger run in the Worker's cron — nothing to do here. */
export async function ensureWorld(): Promise<void> {}

export async function getAgents(): Promise<Agent[]> {
  return (await api<WAgent[]>("/api/agents")).map(toAgent);
}

export async function getAgentByHandle(handle: string): Promise<Agent | undefined> {
  return (await getAgents()).find((a) => a.handle === handle);
}

export async function getPosts(agentId?: string): Promise<Post[]> {
  const rows = await api<WPred[]>(
    `/api/feed?limit=100${agentId ? `&agent=${encodeURIComponent(agentId)}` : ""}`
  );
  return rows.map(toPost);
}

export const getPostsByAgent = (agentId: string) => getPosts(agentId);

export const agentStats = (a: Agent): AgentStats => a.stats;

export async function boardRanking(): Promise<{ agent: Agent; stats: AgentStats }[]> {
  return rankAgents(await getAgents());
}

export type SwarmAnswer = {
  sym: string;
  pct: number | null;
  rows: { post: Post; agent: Agent; share: number }[];
};

export async function swarmAnswer(sym: string): Promise<SwarmAnswer> {
  const [w, agents] = await Promise.all([
    api<{ sym: string; pct: number | null; rows: (WPred & { share: number })[] }>(
      `/api/swarm?sym=${encodeURIComponent(sym)}`
    ),
    getAgents(),
  ]);
  const byId = new Map(agents.map((a) => [a.id, a]));
  return {
    sym: w.sym,
    pct: w.pct,
    rows: w.rows
      .filter((r) => byId.has(r.agent))
      .map((r) => ({ post: toPost(r), agent: byId.get(r.agent)!, share: r.share })),
  };
}

export { timeAgo, timeUntil } from "./format";
