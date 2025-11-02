"use client"

import { useEffect, useState } from "react"
import { Card, CardContent } from "@/components/ui/card"

interface ContractDashboardProps {
  walletAddress: string
}

type Stat = {
  label: string
  value: string | number
  icon: string
  color: string
}

export default function ContractDashboard({ walletAddress }: ContractDashboardProps) {
  const [stats, setStats] = useState<Stat[]>([
    { label: "Active Listings", value: "—", icon: "📊", color: "from-cyan-600 to-cyan-400" },
    { label: "Total Purchases", value: "—", icon: "🛒", color: "from-green-600 to-green-400" },
  ])

  useEffect(() => {
    let cancelled = false

    async function loadStats() {
      if (!walletAddress) return
      try {
        const base = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4021"
        const res = await fetch(`${base.replace(/\/+$/, "")}/stats/${walletAddress}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data?.error || "Failed to fetch stats")

        if (cancelled) return
        setStats([
          {
            label: "Active Listings",
            value: data.activeListings ?? 0,
            icon: "📊",
            color: "from-cyan-600 to-cyan-400",
          },
          {
            label: "Total Purchases",
            value: data.totalPurchases ?? 0,
            icon: "🛒",
            color: "from-green-600 to-green-400",
          },
        ])
      } catch (err) {
        console.error("Error fetching stats:", err)
        if (cancelled) return
        setStats([
          { label: "Active Listings", value: "0", icon: "📊", color: "from-cyan-600 to-cyan-400" },
          { label: "Total Purchases", value: "0", icon: "🛒", color: "from-green-600 to-green-400" },
        ])
      }
    }

    loadStats()
    return () => {
      cancelled = true
    }
  }, [walletAddress])

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((stat, index) => (
        <Card key={index} className="border-slate-800 bg-slate-900/50 overflow-hidden">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-slate-400 mb-1">{stat.label}</p>
                <p className="text-2xl font-bold text-white">{stat.value}</p>
              </div>
              <div
                className={`text-3xl p-2 rounded-lg bg-gradient-to-br ${stat.color} bg-opacity-10`}
              >
                {stat.icon}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
