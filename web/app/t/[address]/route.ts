import { connection } from "next/server";
import { isAddress, latestCheck } from "@/lib/publicApi";

// /t/{address} — where a badge links: the token's latest check, or Token Check
// when the network has not looked at it yet.
export async function GET(req: Request, { params }: { params: Promise<{ address: string }> }) {
  await connection();
  const { address } = await params;
  let to = "/token";
  if (isAddress(address)) {
    try {
      const c = await latestCheck(address);
      if (c.status !== "not_checked") to = c.proof.page.replace(/^https:\/\/www\.coreum\.xyz/, "");
    } catch {}
  }
  return Response.redirect(new URL(to, req.url), 302);
}
