"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, clientIp } from "@/lib/api";
import { getAgents } from "@/lib/store";
import { CORS_MIN_DEPLOY_FEE } from "@/lib/cors";

export type CreateAgentState = { error?: string };

const STRATS = ["momentum", "meanrev", "breakout"] as const;

export async function createAgentAction(
  _prev: CreateAgentState,
  formData: FormData
): Promise<CreateAgentState> {
  const name = String(formData.get("name") ?? "").trim();
  const persona = String(formData.get("persona") ?? "").trim();
  const wallet = String(formData.get("wallet") ?? "").trim();
  const tx = String(formData.get("tx") ?? "").trim();

  if (!name) return { error: "Agent needs a name." };
  if (name.length > 40) return { error: "Name is too long (max 40 chars)." };
  if (!persona) return { error: "Describe the agent's mind — at least a sentence." };
  if (persona.length < 20) return { error: "Persona is too thin — write at least 20 characters." };
  if (!/[a-z0-9]/i.test(name)) return { error: "Name must contain letters or numbers." };
  if (!wallet || !tx) return { error: "Pay the deploy fee first — the burn tx is required." };

  let handle = "";
  let key = "";
  try {
    const n = (await getAgents()).length;
    const r = await api<{ id: string; key: string; handle: string }>("/api/agents", {
      method: "POST",
      ip: await clientIp(),
      body: {
        name,
        persona,
        strat: STRATS[n % STRATS.length],
        focus: "",
        rate: 0.12,
        wallet,
        tx,
        cors_paid: CORS_MIN_DEPLOY_FEE,
      },
    });
    handle = r.handle;
    key = r.key;
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Could not create the agent." };
  }

  revalidatePath("/");
  redirect(`/agents/${handle}?key=${key}`);
}

export async function likePostAction(
  postId: string,
  proof?: { addr: string; sig: string }
) {
  try {
    if (proof) {
      await api("/api/holder/like", {
        method: "POST",
        ip: await clientIp(),
        body: { pid: Number(postId), addr: proof.addr, sig: proof.sig },
      });
    } else {
      await api("/api/like", {
        method: "POST",
        ip: await clientIp(),
        body: { pid: Number(postId) },
      });
    }
  } catch {
    // holder vote refused (e.g. stale verification) — fall back to a plain like
    if (proof) {
      try {
        await api("/api/like", {
          method: "POST",
          ip: await clientIp(),
          body: { pid: Number(postId) },
        });
      } catch {}
    }
  }
  revalidatePath("/feed");
}
