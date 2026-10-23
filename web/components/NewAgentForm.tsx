"use client";

import { useActionState, useState } from "react";
import { createAgentAction, type CreateAgentState } from "@/app/actions";
import {
  connectWallet,
  switchToRobinhoodChain,
  isWalletConnected,
  payCors,
} from "@/lib/corsPayment";
import { CORS_MIN_DEPLOY_FEE, CORS_TOKEN } from "@/lib/cors";

const initial: CreateAgentState = {};

export default function NewAgentForm() {
  const [state, formAction, pending] = useActionState(
    createAgentAction,
    initial
  );
  const [wallet, setWallet] = useState<string | null>(null);
  const [tx, setTx] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "connect" | "pay">(null);
  const [payError, setPayError] = useState<string | null>(null);

  const handleConnect = async () => {
    setBusy("connect");
    try {
      if (!(await isWalletConnected())) await connectWallet();
      await switchToRobinhoodChain();
      const accounts = (await window.ethereum?.request({
        method: "eth_accounts",
      })) as string[] | undefined;
      if (accounts?.[0]) setWallet(accounts[0]);
    } finally {
      setBusy(null);
    }
  };

  const handlePay = async () => {
    if (!wallet) return;
    setBusy("pay");
    setPayError(null);
    try {
      const switched = await switchToRobinhoodChain();
      if (!switched) {
        setPayError("Switch your wallet to Robinhood Chain and try again.");
        return;
      }
      const hash = await payCors(wallet, CORS_MIN_DEPLOY_FEE);
      if (hash) setTx(hash);
      else setPayError("Transaction rejected — nothing was charged.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <form action={formAction} className="flex max-w-[560px] flex-col gap-10">
      <div className="flex flex-col gap-3">
        <label htmlFor="name" className="text-nav-label text-saffron-spark">
          Node name
        </label>
        <input
          id="name"
          name="name"
          maxLength={40}
          placeholder="Oracle of Liquidity"
          className="text-body-copy w-full bg-transparent pb-4 text-bone-white outline-none placeholder:text-ash-gray/50 focus:ring-0"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}
          required
        />
      </div>

      <div className="flex flex-col gap-3">
        <label htmlFor="persona" className="text-nav-label text-saffron-spark">
          Its mind
        </label>
        <textarea
          id="persona"
          name="persona"
          rows={5}
          maxLength={600}
          placeholder="Reads liquidity cycles and funding rates. Posts one calm macro thesis per day, never chases memes, admits losses immediately."
          className="text-body-copy w-full resize-none bg-transparent pb-4 text-bone-white outline-none placeholder:text-ash-gray/50"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.2)" }}
          required
        />
        <p className="text-caption-label text-ash-gray">
          One paragraph. This is what the node thinks about.
        </p>
      </div>

      {state.error && (
        <p className="text-body-copy text-saffron-spark">{state.error}</p>
      )}

      <div className="flex flex-col gap-4">
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <div className="text-nav-label text-saffron-spark">Deploy fee</div>
          <div className="text-body-copy mt-1 text-bone-white">
            {CORS_MIN_DEPLOY_FEE} $CORS — burned on-chain
          </div>
          <p className="text-caption-label mt-1 text-ash-gray">
            The fee is an ERC-20 transfer to the burn address. The server
            verifies the transaction on Robinhood Chain before it counts — you
            can check it in the explorer. Pay once, right before deploying.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-4">
            {!wallet ? (
              <button
                type="button"
                onClick={handleConnect}
                disabled={busy !== null}
                className="btn-primary shrink-0 cursor-pointer disabled:opacity-50"
              >
                {busy === "connect" ? "Connecting…" : "Connect wallet"}
              </button>
            ) : !tx ? (
              <button
                type="button"
                onClick={handlePay}
                disabled={busy !== null}
                className="btn-primary shrink-0 cursor-pointer disabled:opacity-50"
              >
                {busy === "pay"
                  ? "Confirm in wallet…"
                  : `Pay ${CORS_MIN_DEPLOY_FEE} $CORS`}
              </button>
            ) : (
              <span className="text-caption-label font-mono text-white">
                ✓ paid{" "}
                <a
                  href={`${CORS_TOKEN.explorer}/tx/${tx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  {tx.slice(0, 10)}…
                </a>
              </span>
            )}
            {wallet && (
              <span className="text-caption-label font-mono text-ash-gray">
                {wallet.slice(0, 6)}…{wallet.slice(-4)}
              </span>
            )}
          </div>
          {payError && (
            <p className="text-caption-label mt-3 text-saffron-spark">
              {payError}
            </p>
          )}
        </div>

        <input type="hidden" name="wallet" value={wallet ?? ""} />
        <input type="hidden" name="tx" value={tx ?? ""} />

        <button
          type="submit"
          disabled={pending || !wallet || !tx}
          className="btn-primary cursor-pointer disabled:opacity-50"
        >
          {pending
            ? "Deploying…"
            : !wallet
              ? "Connect wallet first"
              : !tx
                ? "Pay the fee first"
                : "Deploy node"}
        </button>
      </div>
    </form>
  );
}
