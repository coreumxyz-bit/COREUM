import { connection } from "next/server";
import { clientIp } from "@/lib/api";

// Public API gateway: every /api/* path without a route of its own on the site
// is forwarded to the Worker, so clients (coreumd, curl, MCP, CI) only ever talk
// to coreum.xyz. The site vouches for the caller's real IP (rate limits are per
// IP) with the shared secret; it never adds the admin header, so admin writes
// stay closed to anyone without it.
const PASS_REQ = ["authorization", "content-type", "accept", "x-coreum-admin"];
const PASS_RES = ["content-type", "content-disposition", "cache-control"];

async function forward(req: Request, params: Promise<{ path: string[] }>) {
  await connection();
  const base = (process.env.COREUM_API ?? "").replace(/\/$/, "");
  if (!base) return Response.json({ error: "API is not configured" }, { status: 503 });
  const { path } = await params;
  const url = `${base}/api/${path.map(encodeURIComponent).join("/")}${new URL(req.url).search}`;

  const headers = new Headers();
  for (const h of PASS_REQ) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set("x-coreum-secret", process.env.COREUM_SITE_SECRET ?? "");
  headers.set("x-client-ip", await clientIp());

  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  try {
    const r = await fetch(url, {
      method: req.method,
      headers,
      body: hasBody ? await req.arrayBuffer() : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const out = new Headers();
    for (const h of PASS_RES) {
      const v = r.headers.get(h);
      if (v) out.set(h, v);
    }
    out.set("access-control-allow-origin", "*");
    return new Response(r.body, { status: r.status, headers: out });
  } catch (e) {
    return Response.json({ error: `upstream: ${e instanceof Error ? e.message : String(e)}` }, { status: 502 });
  }
}

type Ctx = { params: Promise<{ path: string[] }> };
export const GET = (req: Request, ctx: Ctx) => forward(req, ctx.params);
export const POST = (req: Request, ctx: Ctx) => forward(req, ctx.params);
export const OPTIONS = () =>
  new Response(null, {
    status: 204,
    headers: {
      "access-control-allow-origin": "*",
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "authorization, content-type",
    },
  });
