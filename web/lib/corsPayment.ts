import { CORS_TOKEN, corsToWei } from "./cors";

declare global {
  interface Window {
    ethereum?: {
      request: (args: {
        method: string;
        params?: unknown[];
      }) => Promise<unknown>;
      on: (event: string, callback: (...args: unknown[]) => void) => void;
      removeListener: (
        event: string,
        callback: (...args: unknown[]) => void
      ) => void;
      isMetaMask?: boolean;
    };
  }
}

export async function isWalletConnected(): Promise<boolean> {
  if (!window.ethereum) return false;
  try {
    const accounts = (await window.ethereum.request({
      method: "eth_accounts",
    })) as string[];
    return accounts.length > 0;
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<string | null> {
  if (!window.ethereum) {
    alert("Please install MetaMask or another Web3 wallet");
    return null;
  }
  try {
    const accounts = (await window.ethereum.request({
      method: "eth_requestAccounts",
    })) as string[];
    return accounts[0] || null;
  } catch {
    return null;
  }
}

export async function getChainId(): Promise<string | null> {
  if (!window.ethereum) return null;
  try {
    return (await window.ethereum.request({
      method: "eth_chainId",
    })) as string;
  } catch {
    return null;
  }
}

export async function switchToRobinhoodChain(): Promise<boolean> {
  if (!window.ethereum) return false;
  const chainId = "0x" + CORS_TOKEN.chainId.toString(16); // 4663
  try {
    await window.ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId }],
    });
    return true;
  } catch {
    try {
      await window.ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId,
            chainName: "Robinhood Chain",
            nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
            rpcUrls: [CORS_TOKEN.rpcUrl],
            blockExplorerUrls: [CORS_TOKEN.explorer],
          },
        ],
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Pay the deploy fee: a plain ERC-20 transfer of `amount` CORS to the burn
 * address. Returns the tx hash — the server verifies the receipt on-chain
 * before the fee counts as paid.
 */
export async function payCors(
  from: string,
  amount: number
): Promise<string | null> {
  if (!window.ethereum) return null;

  const to = CORS_TOKEN.burnAddress.slice(2).toLowerCase().padStart(64, "0");
  const value = corsToWei(amount).toString(16).padStart(64, "0");
  const data = "0xa9059cbb" + to + value; // transfer(address,uint256)

  try {
    const txHash = (await window.ethereum.request({
      method: "eth_sendTransaction",
      params: [
        {
          from,
          to: CORS_TOKEN.address,
          data,
          value: "0x0",
        },
      ],
    })) as string;

    return txHash;
  } catch {
    return null;
  }
}
