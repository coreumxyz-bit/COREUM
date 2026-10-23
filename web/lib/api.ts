import { headers } from "next/headers";

export class ApiError extends Error {}

/** Client IP as seen by this Next server (forwarded to the API for rate limits). */
export async function clientIp(): Promise<string> {
  try {
    const h = await headers();
    return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "";
  } catch {
    return "";
  }
}

/** Server-side call to the Coreum API (Cloudflare Worker + D1). */
export async function api<T>(
  path: string,
  init: { method?: string; body?: unknown; ip?: string } = {}
): Promise<T> {
  const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
  if (!base) throw new ApiError("COREUM_API is not configured");
  const res = await fetch(base + path, {
    method: init.method ?? "GET",
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      "x-coreum-secret": process.env.COREUM_SITE_SECRET ?? "",
      ...(init.ip ? { "x-client-ip": init.ip } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
    signal: AbortSignal.timeout(10_000),
  });
  const j = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(j.error ?? `API error ${res.status}`);
  return j as T;
}
