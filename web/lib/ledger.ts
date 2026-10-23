// The hash chain lives in the API's database. This module only reads it and
// can re-verify it (the browser does the same check in VerifyChain).
import { api } from "./api";
import { sha256Hex } from "./sha";

export type LedgerEntry = {
  i: number;
  ts: number;
  type: "pred" | "settle" | "play" | "play_settle" | string;
  prev: string;
  data: string;
  hash: string;
};

const ZERO = "0".repeat(64);

export async function ledgerHead(): Promise<{ i: number; hash: string } | null> {
  const s = await api<{ head: { i: number; hash: string } | null }>("/api/state");
  return s.head;
}
export const ledgerList = (limit = 25) => api<LedgerEntry[]>(`/api/ledger?limit=${limit}`);
export const ledgerExport = () => api<LedgerEntry[]>("/api/export");
export async function ledgerSize(): Promise<number> {
  const h = await ledgerHead();
  return h ? h.i + 1 : 0;
}

export async function ledgerVerify(entries: LedgerEntry[]): Promise<{ ok: boolean; at?: number }> {
  let prev = ZERO;
  for (const e of entries) {
    if (e.prev !== prev) return { ok: false, at: e.i };
    if ((await sha256Hex(`${e.prev}|${e.type}|${e.data}`)) !== e.hash) return { ok: false, at: e.i };
    prev = e.hash;
  }
  return { ok: true };
}
