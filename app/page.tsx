"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import WalletConnect from "@/components/wallet-connect"
// import MockX402Interface from "@/components/mock-x402-interface"
import DataMarketInterface from "@/components/data-market-interface"
import ContractDashboard from "@/components/contract-dashboard"

export default function Home() {
  const [walletConnected, setWalletConnected] = useState(false)
  const [walletAddress, setWalletAddress] = useState<string>("")
  const [chainId, setChainId] = useState<number>(0)

  const CONTRACT_ADDRESSES = {
    mockX402: process.env.NEXT_PUBLIC_MOCKX402_ADDRESS || "0x",
    dataMarket: process.env.NEXT_PUBLIC_DATAMARKET_ADDRESS || "0x",
    lock: process.env.NEXT_PUBLIC_LOCK_ADDRESS || "0x",
  }

  useEffect(() => {
    const originalError = console.error
    console.error = (...args: any[]) => {
      const errorMessage = args[0]?.toString() || ""
      if (errorMessage.includes("origins don't match") || errorMessage.includes("CORS")) {
        return
      }
      originalError.apply(console, args)
    }

    return () => {
      console.error = originalError
    }
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-950/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
              <span className="text-white font-bold text-lg">⚙️</span>
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Smart Contract Tester</h1>
              <p className="text-sm text-slate-400">Real contract testing on Bse Sepolia Testnet</p>
            </div>
          </div>
          <WalletConnect
            onConnect={(address, chainId) => {
              setWalletConnected(true)
              setWalletAddress(address)
              setChainId(chainId)
            }}
            onDisconnect={() => {
              setWalletConnected(false)
              setWalletAddress("")
              setChainId(0)
            }}
          />
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!walletConnected ? (
          <Card className="border-slate-800 bg-slate-900/50">
            <CardContent className="pt-12 pb-12 text-center">
              <div className="mb-4 text-4xl">🔗</div>
              <h2 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h2>
              <p className="text-slate-400 mb-6">
                Connect MetaMask to start testing smart contracts on Sepolia Testnet
              </p>
              <div className="space-y-2 text-sm text-slate-500">
                <p>1. Install MetaMask if you haven't already</p>
                <p>2. Get Sepolia testnet ETH from a faucet</p>
                <p>3. Deploy your contracts to Sepolia</p>
                <p>4. Add contract addresses to environment variables</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-8">
            {/* Dashboard Overview */}
            <ContractDashboard walletAddress={walletAddress} />

            {/* Contract Interfaces */}
            <Tabs defaultValue="x402" className="w-full">
              <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border border-slate-700">
                {/* <TabsTrigger value="x402" className="data-[state=active]:bg-blue-600">
                  MockX402 Token
                </TabsTrigger> */}
                <TabsTrigger value="datamarket" className="data-[state=active]:bg-cyan-600">
                  DataMarket
                </TabsTrigger>
                <TabsTrigger value="lock" className="data-[state=active]:bg-purple-600">
                  Lock Contract
                </TabsTrigger>
              </TabsList>

              

              <TabsContent value="datamarket" className="space-y-4">
                <DataMarketInterface walletAddress={walletAddress} contractAddress={CONTRACT_ADDRESSES.dataMarket} />
              </TabsContent>

              <TabsContent value="lock" className="space-y-4">
              </TabsContent>
            </Tabs>

            {/* Contract Address Configuration */}
            <Card className="border-slate-800 bg-slate-900/50">
              <CardContent className="pt-6">
                <h3 className="text-sm font-semibold text-slate-300 mb-4">Contract Addresses</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div>
                    <p className="text-slate-400 mb-1">MockX402</p>
                    <p className="font-mono text-slate-300 break-all">{CONTRACT_ADDRESSES.mockX402}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">DataMarket</p>
                    <p className="font-mono text-slate-300 break-all">{CONTRACT_ADDRESSES.dataMarket}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-1">Lock</p>
                    <p className="font-mono text-slate-300 break-all">{CONTRACT_ADDRESSES.lock}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  )
}
