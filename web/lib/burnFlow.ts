"use client";

// Burn $CORS from the visitor's own wallet and wait until the site has read the
// receipt on Robinhood Chain. The wallet signs the transfer; Coreum never holds
// the tokens — they go to 0x…dEaD for good.
import { connectWallet, payCors, switchToRobinhoodChain } from "@/lib/corsPayment";

export type BurnPurpose = "check" | "apikey" | "core";

export async function burnAndRecord(amount: number, purpose: BurnPurpose, onStep?: (s: string) => void): Promise<string> {
  onStep?.("Connecting your wallet…");
  const from = await connectWallet();
  if (!from) throw new Error("no wallet connected");
  if (!(await switchToRobinhoodChain())) throw new Error("switch your wallet to Robinhood Chain");
  onStep?.(`Confirm the burn of ${amount.toLocaleString("en-US")} $CORS in your wallet…`);
  const tx = await payCors(from, amount);
  if (!tx) throw new Error("the burn was cancelled");
  onStep?.("Waiting for Robinhood Chain to confirm the burn…");
  // the site reads the receipt; 202 means not mined yet
  for (let i = 0; i < 40; i++) {
    const r = await fetch("/api/cors/burn", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tx, purpose }),
    });
    if (r.status === 202) {
      await new Promise((ok) => setTimeout(ok, 2000));
      continue;
    }
    const j = await r.json();
    if (!r.ok) throw new Error(j.error ?? "the burn could not be verified");
    return tx;
  }
  throw new Error("the burn is taking long to confirm, try again with the same transaction in a minute");
}
