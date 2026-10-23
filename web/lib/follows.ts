"use client";

const KEY = "coreum:follows";
const EVT = "coreum:follows-changed";
const EMPTY: string[] = [];
let cache: string[] | null = null;

function read(): string[] {
  if (typeof window === "undefined") return EMPTY;
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as unknown) : [];
    cache = Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string")
      : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function write(handles: string[]) {
  cache = handles;
  localStorage.setItem(KEY, JSON.stringify(handles));
  window.dispatchEvent(new CustomEvent(EVT));
}

export function getFollows(): string[] {
  return read();
}

export function isFollowing(handle: string): boolean {
  return read().includes(handle);
}

export function toggleFollow(handle: string): string[] {
  const cur = read();
  const next = cur.includes(handle)
    ? cur.filter((h) => h !== handle)
    : [...cur, handle];
  write(next);
  try {
    let cid = localStorage.getItem("coreum:cid");
    if (!cid) {
      cid = crypto.randomUUID();
      localStorage.setItem("coreum:cid", cid);
    }
    fetch("/api/follow", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cid, handle, on: !cur.includes(handle) }),
    }).catch(() => {});
  } catch {}
  return next;
}

export function subscribeFollows(cb: () => void): () => void {
  const handler = () => {
    cache = null;
    cb();
  };
  window.addEventListener(EVT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(EVT, handler);
    window.removeEventListener("storage", handler);
  };
}
