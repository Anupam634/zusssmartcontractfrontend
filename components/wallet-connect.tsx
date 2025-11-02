"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";

let CoinbaseWalletSDK: any;
if (typeof window !== "undefined") {
  CoinbaseWalletSDK = require("@coinbase/wallet-sdk").CoinbaseWalletSDK;
}

interface WalletConnectProps {
  onConnect: (address: string, chainId: number) => void;
  onDisconnect: () => void;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

export default function WalletConnect({ onConnect, onDisconnect }: WalletConnectProps) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string>("");
  const [chainId, setChainId] = useState<number>(0);
  const [walletType, setWalletType] = useState<"MetaMask" | "Coinbase" | "Unknown">("Unknown");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>("");

  // --- SAFELY create Coinbase Wallet provider (client-only) ---
  const coinbaseProvider = useMemo(() => {
    if (typeof window === "undefined" || !CoinbaseWalletSDK) return null;

    try {
      const cb = new CoinbaseWalletSDK({
        appName: "DataMarket x402",
        appLogoUrl: "https://x402.org/icon.png",
        appChainId: 84532, // Base Sepolia
      });

      const provider = cb.makeWeb3Provider("https://sepolia.base.org", 84532);
      return provider;
    } catch (err) {
      console.warn("Coinbase Wallet SDK init failed:", err);
      return null;
    }
  }, []);

  /** Pick wallet provider (MetaMask > Coinbase fallback) */
  const getProvider = () => {
    if (typeof window === "undefined") return null;
    const eth = window.ethereum;
    if (eth?.providers?.length) {
      const mm = eth.providers.find((p: any) => p.isMetaMask);
      const cb = eth.providers.find((p: any) => p.isCoinbaseWallet);
      if (mm) {
        setWalletType("MetaMask");
        return mm;
      } else if (cb) {
        setWalletType("Coinbase");
        return cb;
      }
      setWalletType("Unknown");
      return eth.providers[0];
    } else if (eth?.isMetaMask) {
      setWalletType("MetaMask");
      return eth;
    } else if (eth?.isCoinbaseWallet) {
      setWalletType("Coinbase");
      return eth;
    } else if (coinbaseProvider) {
      setWalletType("Coinbase");
      return coinbaseProvider;
    } else {
      setWalletType("Unknown");
      return null;
    }
  };

  /** Connect wallet */
  const connectWallet = async () => {
    setLoading(true);
    setError("");

    try {
      const provider = getProvider();
      if (!provider) {
        setError("No wallet detected. Install MetaMask or Coinbase Wallet.");
        setLoading(false);
        return;
      }

      const accounts: string[] = await provider.request({ method: "eth_requestAccounts" });
      if (!accounts?.length) {
        setError("No accounts available in wallet.");
        setLoading(false);
        return;
      }

      const chainHex = await provider.request({ method: "eth_chainId" });
      const currentChainId = parseInt(chainHex, 16);
      const user = accounts[0];

      setAddress(user);
      setChainId(currentChainId);
      setConnected(true);
      onConnect(user, currentChainId);
    } catch (err: any) {
      console.error("Wallet connect error:", err);
      if (err.code === 4001) setError("Connection rejected by user.");
      else if (err.code === -32002) setError("Connection request already pending.");
      else setError(err?.message || "Failed to connect wallet.");
    } finally {
      setLoading(false);
    }
  };

  /** Disconnect wallet */
  const disconnectWallet = () => {
    setConnected(false);
    setAddress("");
    setChainId(0);
    setError("");
    setWalletType("Unknown");
    onDisconnect();
  };

  /** React to account / chain changes */
  useEffect(() => {
    const provider = getProvider();
    if (!provider) return;

    const handleAccountsChanged = (accs: string[]) => {
      if (!accs?.length) {
        disconnectWallet();
        return;
      }
      const user = accs[0];
      setAddress(user);
      if (connected) onConnect(user, chainId);
    };

    const handleChainChanged = (hexId: string) => {
      const dec = parseInt(hexId, 16);
      setChainId(dec);
      if (connected && address) onConnect(address, dec);
    };

    provider.on?.("accountsChanged", handleAccountsChanged);
    provider.on?.("chainChanged", handleChainChanged);

    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, [connected, address, chainId]);

  /** UI */
  if (connected) {
    return (
      <div className="flex items-center gap-3">
        <div className="px-4 py-2 rounded-lg bg-slate-800 border border-slate-700">
          <p className="text-sm text-slate-300 font-mono">
            {address.slice(0, 6)}...{address.slice(-4)}
          </p>
          <p className="text-[10px] text-slate-500 text-right">
            Chain ID: {chainId} · {walletType}
          </p>
        </div>
        <Button
          onClick={disconnectWallet}
          variant="outline"
          className="border-slate-700 hover:bg-slate-800 bg-transparent"
        >
          Disconnect
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <Button
        onClick={connectWallet}
        disabled={loading}
        className="bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700"
      >
        {loading ? "Connecting..." : "Connect Wallet"}
      </Button>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <p className="text-xs text-slate-400">
        Supports MetaMask and Coinbase Wallet. No network switching.
      </p>
    </div>
  );
}
