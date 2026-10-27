/**
 * CORS Token — Robinhood Chain
 * Address: 0x3a2ec7aeb4b3c3d6ae9ff6f390bc9da05a8cb945
 */

export const CORS_TOKEN = {
  address: "0x3a2ec7aeb4b3c3d6ae9ff6f390bc9da05a8cb945" as const,
  symbol: "CORS",
  name: "Coreum",
  decimals: 18,
  // Robinhood Chain mainnet — verified live: eth_chainId 0x1237 (4663),
  // CORS contract present, supply 1,000,000,000, gas token ETH
  rpcUrl: "https://rpc.mainnet.chain.robinhood.com",
  chainId: 4663,
  explorer: "https://robinhoodchain.blockscout.com",
  // The deploy fee is transferred here — a plain, verifiable on-chain burn
  burnAddress: "0x000000000000000000000000000000000000dEaD",
};

// Where $CORS trades: the Pons launchpad (bonding curve) and its CORS/WETH pool
export const CORS_TRADE_URL = `https://ponsfamily.com/launchpad/${CORS_TOKEN.address}`;
export const CORS_POOL = "0x174a18e97de5cd9f58dca79b68b9f358c00c7aa3";

export const CORS_MIN_DEPLOY_FEE = 0.1; // CORS за создание ноды
export const CORS_STAKE_MIN = 100; // минимальный стейк для веса в консенсусе

export function formatCors(amount: number, decimals = 2): string {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toFixed(decimals);
}

// exact for whole and fractional amounts alike (floats lose digits at 1e23+)
export function corsToWei(amount: number): bigint {
  return BigInt(Math.round(amount * 1e4)) * BigInt("100000000000000");
}

export function weiToCors(wei: bigint): number {
  return Number(wei) / 1e18;
}

// $0.00000445 → $0.0₅445 — the way DEX screeners print micro-caps
export function microPrice(p: number): string {
  if (p >= 0.01) return p.toFixed(p >= 1 ? 2 : 4);
  const zeros = Math.floor(-Math.log10(p)); // zeros after "0."
  const sig = Math.round(p * 10 ** (zeros + 4)).toString().slice(0, 4);
  const sub = String(zeros)
    .split("")
    .map((d) => "₀₁₂₃₄₅₆₇₈₉"[+d])
    .join("");
  return `0.0${sub}${sig}`;
}

// Where people find us — footer and mobile menu
export const SOCIAL = [
  { label: "X", href: "https://x.com/0xcoreum" },
  { label: "Telegram", href: "https://t.me/+xLtzNawbDRgwODQy" },
  { label: "Chat", href: "https://t.me/+JPaQmRXtwVMwMmMy" },
  { label: "GitHub", href: "https://github.com/coreumxyz-bit/COREUM" },
] as const;
