// lib/x402Client.ts
import { wrapFetchWithPayment } from "x402-fetch";
import { createWalletClient, custom, defineChain } from "viem";

/**
 * Makes a fetch() that automatically handles the x402 flow:
 * - sees 402 + `accepts` from your backend
 * - opens wallet to pay USDC on Base
 * - retries with X-PAYMENT
 * - returns the final 200 OK response
 */
export async function makeX402Fetch() {
  const eth = (window as any).ethereum;
  if (!eth) throw new Error("No injected wallet found (window.ethereum)");

  // Ensure we have a connected account
  const accounts: string[] = await eth.request({ method: "eth_requestAccounts" });
  if (!accounts?.length) throw new Error("No accounts returned from wallet");
  const address = accounts[0] as `0x${string}`;

  // Detect current chain ID (works with Base Sepolia/Mainnet/etc.)
  const chainIdHex: string = await eth.request({ method: "eth_chainId" });
  const chainId = parseInt(chainIdHex, 16);

  const chain = defineChain({
    id: chainId,
    name: "Detected Chain",
    nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
    rpcUrls: { default: { http: [] }, public: { http: [] } },
  });

  // Create a viem wallet client bound to the selected account
  const walletClient = createWalletClient({
    account: address,
    chain,
    transport: custom(eth),
  });

  // NOTE: x402-fetch’s types expect a “Signer-like” client; the viem client works at runtime.
  // Cast is safe here and resolves TypeScript noise.
  const wallet: any = walletClient;

  // If you want to pin a facilitator explicitly:
  // const facilitatorUrl = process.env.NEXT_PUBLIC_FACILITATOR_URL || "https://x402.org/facilitator";
  // return wrapFetchWithPayment(fetch, wallet, { facilitatorUrl });

  return wrapFetchWithPayment(fetch, wallet);
}
