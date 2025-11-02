"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ethers } from "ethers"
import { MOCKX402_ABI } from "@/lib/contract-abis"

interface MockX402InterfaceProps {
  walletAddress: string
  contractAddress?: string
}

export default function MockX402Interface({ walletAddress, contractAddress = "0x" }: MockX402InterfaceProps) {
  const [balance, setBalance] = useState<string>("0")
  const [transferTo, setTransferTo] = useState("")
  const [transferAmount, setTransferAmount] = useState("")
  const [loading, setLoading] = useState(false)
  const [txHash, setTxHash] = useState<string>("")
  const [error, setError] = useState<string>("")

  useEffect(() => {
    const loadBalance = async () => {
      if (!contractAddress || contractAddress === "0x") {
        setError("Contract address not configured. Please deploy the contract first.")
        return
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const contract = new ethers.Contract(contractAddress, MOCKX402_ABI, provider)
        const balanceRaw = await contract.balanceOf(walletAddress)
        const decimals = await contract.decimals()
        const formattedBalance = ethers.formatUnits(balanceRaw, decimals)
        setBalance(formattedBalance)
      } catch (err: any) {
        console.error("Failed to load balance:", err)
        setError("Failed to load balance. Check contract address.")
      }
    }

    loadBalance()
  }, [walletAddress, contractAddress])

  const handleTransfer = async () => {
    if (!transferTo || !transferAmount) {
      setError("Please fill in all fields")
      return
    }

    if (!ethers.isAddress(transferTo)) {
      setError("Invalid recipient address")
      return
    }

    setLoading(true)
    setError("")
    try {
      const provider = new ethers.BrowserProvider(window.ethereum)
      const signer = await provider.getSigner()
      const contract = new ethers.Contract(contractAddress, MOCKX402_ABI, signer)

      const decimals = await contract.decimals()
      const amount = ethers.parseUnits(transferAmount, decimals)

      const tx = await contract.transfer(transferTo, amount)
      setTxHash(tx.hash)

      // Wait for confirmation
      await tx.wait()
      setTransferTo("")
      setTransferAmount("")

      // Reload balance
      const newBalance = await contract.balanceOf(walletAddress)
      const formattedBalance = ethers.formatUnits(newBalance, decimals)
      setBalance(formattedBalance)
    } catch (err: any) {
      console.error("Transfer failed:", err)
      setError(err.message || "Transfer failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="border-slate-800 bg-slate-900/50 lg:col-span-1">
        <CardHeader>
          <CardTitle className="text-blue-400">Token Balance</CardTitle>
          <CardDescription>Your X402 holdings</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">Balance</p>
              <p className="text-3xl font-bold text-white">{Number.parseFloat(balance).toFixed(4)} X402</p>
            </div>
            <div className="pt-4 border-t border-slate-700">
              <p className="text-xs text-slate-500">Wallet: {walletAddress.slice(0, 10)}...</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50 lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-blue-400">Transfer Tokens</CardTitle>
          <CardDescription>Send X402 to another address</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <Label htmlFor="recipient" className="text-slate-300">
                Recipient Address
              </Label>
              <Input
                id="recipient"
                placeholder="0x..."
                value={transferTo}
                onChange={(e) => setTransferTo(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-2"
              />
            </div>
            <div>
              <Label htmlFor="amount" className="text-slate-300">
                Amount (X402)
              </Label>
              <Input
                id="amount"
                type="number"
                placeholder="0.00"
                value={transferAmount}
                onChange={(e) => setTransferAmount(e.target.value)}
                className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 mt-2"
              />
            </div>
            <Button onClick={handleTransfer} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
              {loading ? "Processing..." : "Transfer"}
            </Button>
            {error && <p className="text-xs text-red-400">{error}</p>}
            {txHash && (
              <div className="p-3 rounded-lg bg-slate-800 border border-slate-700">
                <p className="text-xs text-slate-400 mb-1">Transaction Hash</p>
                <p className="text-xs font-mono text-green-400 break-all">{txHash}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-slate-900/50 lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-blue-400">Contract Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-slate-400 mb-1">Name</p>
              <p className="text-sm font-semibold text-white">X402 Stablecoin</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Symbol</p>
              <p className="text-sm font-semibold text-white">X402</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Decimals</p>
              <p className="text-sm font-semibold text-white">18</p>
            </div>
            <div>
              <p className="text-xs text-slate-400 mb-1">Contract</p>
              <p className="text-xs font-mono text-slate-400 break-all">{contractAddress.slice(0, 10)}...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
