// $CORS holder proofs — off-chain, no gas: an EIP-191 signature over a fixed
// message proves wallet ownership; the server checks the on-chain balance
// and remembers the address. Verified addresses get weighted likes (×5) and
// their agents get the HOLDER badge.
import { connectWallet } from "./corsPayment";

const HOLDER_KEY = "coreum_holder";

export const HOLDER_CHECK_MSG = (addr: string) =>
  `Coreum holder check\n${addr.toLowerCase()}`;

export const HOLDER_VOTE_MSG = (pid: string | number, addr: string) =>
  `Coreum holder vote\npost: ${pid}\naddr: ${addr.toLowerCase()}`;

export function savedHolder(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(HOLDER_KEY);
}

export function rememberHolder(addr: string): void {
  localStorage.setItem(HOLDER_KEY, addr.toLowerCase());
}

export async function signMessage(
  msg: string,
  addr: string
): Promise<string | null> {
  if (!window.ethereum) return null;
  try {
    return (await window.ethereum.request({
      method: "personal_sign",
      params: [msg, addr],
    })) as string;
  } catch {
    return null;
  }
}

export { connectWallet };
