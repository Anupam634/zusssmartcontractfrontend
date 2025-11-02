"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ethers } from "ethers";
import { makeX402Fetch } from "@/lib/x402Client";
import { DATAMARKET_ABI, MOCKX402_ABI } from "@/lib/contract-abis";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type ListingStruct = {
  listingId: `0x${string}`;
  seller: string;
  objectId: `0x${string}`;
  price: bigint;
  createdAt: bigint;
  active: boolean;
  labels: {
    taskType: string;
    dataType: string;
    qualityScore: number;
    categories: string[];
    annotations: string;
    sampleCount: bigint;
    privacy: string;
    contentHash: `0x${string}`;
  };
  authTicket: string;
};

interface DataMarketInterfaceProps {
  walletAddress: string;
  contractAddress?: string;
  x402Address?: string;
}

/** ENV */
const DM_ENV = process.env.NEXT_PUBLIC_DATAMARKET_ADDRESS || "";
const RAW_API_BASE = (process.env.NEXT_PUBLIC_API_BASE || "").replace(/\/+$/, "");
const X402_ENV = process.env.NEXT_PUBLIC_MOCKX402_ADDRESS || "0x";

function toBytes32(value: string) {
  if (/^0x[0-9a-fA-F]{64}$/.test(value)) return value as `0x${string}`;
  return ethers.id(value) as `0x${string}`;
}
function short(addr: string, left = 6, right = 4) {
  if (!addr) return "";
  return `${addr.slice(0, left)}…${addr.slice(-right)}`;
}
function fmtUSDC(v?: bigint) {
  try { return ethers.formatUnits(v ?? 0n, 6); } catch { return "0"; }
}
function getParam(name: string) {
  if (typeof window === "undefined") return null;
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}
function tryPrettyJSON(s?: string) {
  if (!s) return "";
  try { return JSON.stringify(JSON.parse(s), null, 2); } catch { return s; }
}

export default function DataMarketInterface({
  walletAddress,
  contractAddress = DM_ENV,
  x402Address = X402_ENV,
}: DataMarketInterfaceProps) {
  const [focusedListing, setFocusedListing] = useState<ListingStruct | null>(null);
  const [focusedError, setFocusedError] = useState("");
  const [focusedInput, setFocusedInput] = useState("");

  const [myListings, setMyListings] = useState<ListingStruct[]>([]);
  const [loadingMy, setLoadingMy] = useState(false);

  const [txHash, setTxHash] = useState("");
  const [globalError, setGlobalError] = useState("");

  // x402 / access state
  const [payingListing, setPayingListing] = useState<`0x${string}` | "">("");
  const [accessGranted, setAccessGranted] = useState(false);
  const [accessMap, setAccessMap] = useState<Record<string, boolean>>({});
  const [accessLast, setAccessLast] = useState<any>(null);
  const [accessErr, setAccessErr] = useState<string>("");

  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // show/hide auth ticket
  const [revealAuth, setRevealAuth] = useState(false);

  // new listing form
  const [objectIdInput, setObjectIdInput] = useState("dataset-001");
  const [priceUSDC, setPriceUSDC] = useState("0.05");
  const [taskType, setTaskType] = useState("classification");
  const [dataType, setDataType] = useState("image");
  const [qualityScore, setQualityScore] = useState(95);
  const [sampleCount, setSampleCount] = useState(5000);
  const [categories, setCategories] = useState("medical,ct-scan");
  const [annotations, setAnnotations] = useState('{"bounding_boxes":true}');
  const [privacy, setPrivacy] = useState("true");
  const [contentHashInput, setContentHashInput] = useState("content-hash-v1");
  const [authTicket, setAuthTicket] = useState("encryptedAuthToken123456789==");

  const [newListingId, setNewListingId] = useState<`0x${string}` | "">("");

  const ready = useMemo(() => {
    return (
      typeof window !== "undefined" &&
      // @ts-ignore
      !!window.ethereum &&
      contractAddress &&
      contractAddress !== "0x"
    );
  }, [contractAddress]);

  // Insecure API warning when app runs under HTTPS
  const API_BASE = RAW_API_BASE;
  const insecureUnderHttps =
    typeof window !== "undefined" &&
    window.location.protocol === "https:" &&
    API_BASE.startsWith("http:");

  /** utils **/
  const getProvider = () => {
    // @ts-ignore
    return new ethers.BrowserProvider(window.ethereum);
  };
  const getContract = async (withSigner = false) => {
    const provider = getProvider();
    const signer = withSigner ? await provider.getSigner() : undefined;
    return new ethers.Contract(contractAddress, DATAMARKET_ABI, signer ?? provider);
  };

  /** ------- ACCESS CHECK (centralized) ------- */
  const checkAccessOnce = async (listingId: `0x${string}`, buyer?: string) => {
    setAccessErr("");
    setAccessLast(null);
    if (!buyer) return false;

    try {
      const url = `${API_BASE}/access/${encodeURIComponent(listingId)}/${encodeURIComponent(buyer)}?t=${Date.now()}`;
      const r = await fetch(url, {
        method: "GET",
        headers: { "Accept": "application/json", "Cache-Control": "no-cache" },
        cache: "no-store",
      });
      const j = await r.json().catch(() => ({}));
      setAccessLast(j);
      if (!r.ok) {
        throw new Error(j?.error || `Access API error (${r.status})`);
      }
      const ok = !!j?.hasAccess;
      if (ok) {
        setAccessGranted(true);
        setAccessMap((m) => ({ ...m, [listingId]: true }));
      }
      return ok;
    } catch (e: any) {
      setAccessErr(e?.message || "Failed to check access");
      return false;
    }
  };

  const startAccessPolling = (listingId: `0x${string}`, buyer: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    // poll every 3s for up to 3 minutes
    const started = Date.now();
    pollRef.current = setInterval(async () => {
      const ok = await checkAccessOnce(listingId, buyer);
      if (ok) {
        if (pollRef.current) clearInterval(pollRef.current);
      } else if (Date.now() - started > 180_000) {
        if (pollRef.current) clearInterval(pollRef.current);
        setAccessErr((s) => s || "Timed out waiting for access. If you just paid, your facilitator may not be setting access yet or API is unreachable.");
      }
    }, 3000);
  };

  /** Load "My Listings" */
  const loadMyListings = async () => {
    if (!ready || !walletAddress) return;
    setLoadingMy(true);
    setGlobalError("");
    try {
      const dm = await getContract(false);
      const ids: `0x${string}`[] = await dm.getSellerListings(walletAddress);
      const rows = await Promise.all(ids.map((id) => dm.listings(id)));
      rows.reverse();
      setMyListings(rows as unknown as ListingStruct[]);
    } catch (err: any) {
      console.error("loadMyListings failed:", err);
      setGlobalError(err?.shortMessage || err?.message || "Failed to load your listings");
    } finally {
      setLoadingMy(false);
    }
  };

  /** Focus a listing by ID */
  const fetchListingById = async (idRaw: string) => {
    setFocusedError("");
    setFocusedListing(null);
    setRevealAuth(false);
    setAccessErr("");
    setAccessLast(null);
    try {
      if (!idRaw) throw new Error("Enter a listing ID (bytes32 0x…)");

      const id = idRaw.trim() as `0x${string}`;
      if (!/^0x[0-9a-fA-F]{64}$/.test(id)) throw new Error("Invalid bytes32 listingId");

      const dm = await getContract(false);
      const l = await dm.listings(id);
      if (!l?.seller || l.seller === ethers.ZeroAddress) throw new Error("Listing not found");
      setFocusedListing(l as unknown as ListingStruct);

      // auto-check prior access for this buyer
      if (walletAddress) {
        await checkAccessOnce(id, walletAddress);
      }
    } catch (err: any) {
      setFocusedError(err?.shortMessage || err?.message || "Failed to fetch listing");
    }
  };

  /** URL param ?lid=... */
  useEffect(() => {
    if (!ready) return;
    const lid = getParam("lid");
    if (lid) {
      setFocusedInput(lid);
      fetchListingById(lid).catch(() => {});
    }
  }, [ready]); // eslint-disable-line

  /** Keep "My Listings" updated */
  useEffect(() => {
    if (!ready) return;
    loadMyListings();
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [ready, walletAddress, contractAddress]); // eslint-disable-line

  /** Create listing */
  const handleCreateListing = async () => {
    try {
      setGlobalError(""); setTxHash(""); setNewListingId("");
      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const dm = new ethers.Contract(contractAddress, DATAMARKET_ABI, signer);

      const objectId = toBytes32(objectIdInput || "dataset-001");
      const price = ethers.parseUnits(priceUSDC || "0.05", 6);
      const labels = {
        taskType,
        dataType,
        qualityScore,
        categories: categories.split(",").map((s) => s.trim()).filter(Boolean),
        annotations,
        sampleCount: BigInt(sampleCount || 0),
        privacy,
        contentHash: toBytes32(contentHashInput || "content-hash-v1"),
      };

      const tx = await dm.listData(objectId, price, labels, authTicket);
      setTxHash(tx.hash);
      const receipt = await tx.wait();

      let createdId: `0x${string}` | "" = "";
      try {
        const iface = new ethers.Interface(DATAMARKET_ABI);
        for (const log of receipt.logs) {
          try {
            const parsed = iface.parseLog({ topics: log.topics as string[], data: log.data });
            if (parsed?.name === "DataListed") {
              createdId = parsed.args?.listingId as `0x${string}`;
              break;
            }
          } catch {}
        }
      } catch {}

      if (!createdId) {
        const ids: `0x${string}`[] = await dm.getSellerListings(walletAddress);
        if (ids.length > 0) createdId = ids[ids.length - 1];
      }

      if (createdId) {
        setNewListingId(createdId);
        await loadMyListings();
        setFocusedInput(createdId);
        await fetchListingById(createdId);
      }
    } catch (err: any) {
      console.error("Listing failed:", err);
      setGlobalError(err?.shortMessage || err?.message || "Listing failed");
    }
  };

  /** Buy via x402 */
  const handleBuyX402 = async (l: ListingStruct) => {
    try {
      setGlobalError(""); setTxHash(""); setAccessGranted(false);
      setAccessErr(""); setAccessLast(null);
      setPayingListing(l.listingId);

      if (!walletAddress) { setGlobalError("Connect your wallet first."); return; }
      if (insecureUnderHttps) {
        setGlobalError("Your API base is HTTP while the app runs under HTTPS. Browser will block the request. Fix NEXT_PUBLIC_API_BASE to use HTTPS.");
        return;
      }

      try {
        const fetchWithPayment = await makeX402Fetch();
        const r = await fetchWithPayment(`${API_BASE}/purchase`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: l.listingId, buyer: walletAddress }),
        });
        const out = await r.json();
        if (!r.ok) throw new Error(out?.error || "x402 purchase failed");
        if (out?.txHash) setTxHash(out.txHash);
      } catch (progErr: any) {
        console.warn("Programmatic x402 flow failed, falling back to intent URL:", progErr?.message);
        const i = await fetch(`${API_BASE}/purchase/intent`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listingId: l.listingId, buyer: walletAddress }),
        });
        const out = await i.json();
        if (!i.ok) throw new Error(out?.error || "intent failed");
        if (out?.paymentUrl) {
          window.open(out.paymentUrl, "_blank", "noopener,noreferrer");
        } else {
          throw new Error("No paymentUrl returned by facilitator.");
        }
      }

      // start polling for unlock
      startAccessPolling(l.listingId, walletAddress);
    } catch (err: any) {
      console.error("x402 purchase failed:", err);
      setGlobalError(err?.message || "x402 purchase failed");
    }
  };

  /** Legacy token path (optional) */
  const handleBuyLegacyToken = async (l: ListingStruct) => {
    try {
      setGlobalError(""); setTxHash("");
      // @ts-ignore
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();

      const x402 = new ethers.Contract(x402Address, MOCKX402_ABI, signer);
      const dm = new ethers.Contract(contractAddress, DATAMARKET_ABI, signer);

      const allowance: bigint = await x402.allowance(walletAddress, contractAddress);
      if (allowance < l.price) {
        const aTx = await x402.approve(contractAddress, l.price);
        await aTx.wait();
      }

      const tx = await dm.purchaseData(l.listingId);
      setTxHash(tx.hash);
      await tx.wait();

      if (focusedListing?.listingId === l.listingId) await fetchListingById(l.listingId);
      await loadMyListings();
      setAccessGranted(true);
      setAccessMap((m) => ({ ...m, [l.listingId]: true }));
    } catch (err: any) {
      console.error("Purchase failed:", err);
      setGlobalError(err?.shortMessage || err?.message || "Purchase failed");
    }
  };

  /** Receipt helpers */
  const buildReceiptJSON = (l: ListingStruct) => {
    const nowISO = new Date().toISOString();
    return {
      listingId: l.listingId,
      objectId: l.objectId,
      seller: l.seller,
      buyer: walletAddress || "",
      priceUSDC: fmtUSDC(l.price),
      txHash: txHash || undefined,
      createdAt: typeof l.createdAt === "bigint" ? Number(l.createdAt) : l.createdAt,
      savedAt: nowISO,
      labels: l.labels,
    };
  };
  const downloadReceipt = (l: ListingStruct) => {
    try {
      const blob = new Blob([JSON.stringify(buildReceiptJSON(l), null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `purchase-${l.listingId}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const shareUrl =
    typeof window !== "undefined" && newListingId
      ? `${window.location.origin}${window.location.pathname}?lid=${newListingId}`
      : "";

  const canViewFocused = focusedListing?.listingId
    ? !!accessMap[focusedListing.listingId] || accessGranted
    : false;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="open" className="w-full">
        <TabsList className="grid w-full grid-cols-3 bg-slate-800/50 border border-slate-700">
          <TabsTrigger value="open" className="data-[state=active]:bg-cyan-600">Open Private Listing</TabsTrigger>
          <TabsTrigger value="my" className="data-[state=active]:bg-cyan-600">My Listings</TabsTrigger>
          <TabsTrigger value="list" className="data-[state=active]:bg-cyan-600">List Data</TabsTrigger>
        </TabsList>

        {/* -------- OPEN BY ID -------- */}
        <TabsContent value="open" className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-cyan-400">Open a Private Listing</CardTitle>
              <CardDescription>Paste the Listing ID (bytes32) or use a shared link.</CardDescription>
            </CardHeader>
            <CardContent>
              {!ready && (
                <p className="text-xs text-yellow-400 mb-3">
                  Connect wallet & set NEXT_PUBLIC_DATAMARKET_ADDRESS (and NEXT_PUBLIC_API_BASE if backend isn’t on localhost:4021).
                </p>
              )}
              {insecureUnderHttps && (
                <p className="text-xs text-red-400 mb-3">
                  WARNING: App is on HTTPS but NEXT_PUBLIC_API_BASE is HTTP ({API_BASE}). Browser will block requests.
                  Use an HTTPS API base.
                </p>
              )}

              <div className="flex gap-2 mb-3">
                <Input
                  placeholder="0x…listingId"
                  value={focusedInput}
                  onChange={(e) => setFocusedInput(e.target.value)}
                  className="bg-slate-800 border-slate-700 text-white"
                />
                <Button onClick={() => fetchListingById(focusedInput)} className="bg-cyan-600 hover:bg-cyan-700">
                  Open
                </Button>
              </div>

              {focusedError && <p className="text-xs text-red-400 mb-2">{focusedError}</p>}

              {focusedListing && (
                <div className="p-4 rounded-lg border border-slate-700 bg-slate-800/50">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <p className="text-sm font-mono text-cyan-400">
                        ID: {short(focusedListing.listingId)} · {focusedListing.labels?.taskType}/{focusedListing.labels?.dataType}
                      </p>
                      <p className="text-xs text-slate-400 mt-1">Seller: {short(focusedListing.seller)}</p>
                      <p className="text-xs text-slate-400">
                        Samples: {focusedListing.labels?.sampleCount?.toString?.() ?? "-"} · Quality: {Number(focusedListing.labels?.qualityScore ?? 0)}
                      </p>
                      <p className="text-xs text-slate-400">
                        Categories: {(focusedListing.labels?.categories ?? []).join(", ")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-white">{fmtUSDC(focusedListing.price)} USDC</p>
                      <div className="flex flex-col gap-2 mt-2">
                        <Button
                          onClick={() => handleBuyX402(focusedListing)}
                          disabled={!focusedListing.active || !ready}
                          className="w-full bg-cyan-600 hover:bg-cyan-700"
                          size="sm"
                        >
                          {focusedListing.active ? "Buy with x402" : "Inactive"}
                        </Button>
                        {/* <Button
                          onClick={() => handleBuyLegacyToken(focusedListing)}
                          disabled={!focusedListing.active || !ready}
                          className="w-full bg-slate-700 hover:bg-slate-600"
                          size="sm"
                        >
                          Legacy Token Flow
                        </Button> */}
                      </div>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500">ObjectId: {short(focusedListing.objectId)}</p>

                  {payingListing === focusedListing.listingId && (
                    <div className="mt-3 p-3 rounded-md bg-slate-800 border border-slate-700 text-xs">
                      {!accessGranted ? (
                        <>
                          <p className="text-slate-300">Processing payment and waiting for unlock…</p>
                          {accessErr && <p className="text-red-400 mt-2">Access error: {accessErr}</p>}
                          {accessLast && (
                            <pre className="mt-2 text-[11px] leading-relaxed bg-slate-950/50 border border-slate-800 rounded p-2 text-slate-200 whitespace-pre-wrap">
                              {JSON.stringify(accessLast, null, 2)}
                            </pre>
                          )}
                          <div className="mt-2 flex gap-2">
                            <Button
                              size="sm"
                              className="bg-slate-700 hover:bg-slate-600"
                              onClick={() => checkAccessOnce(focusedListing.listingId, walletAddress)}
                            >
                              Refresh access now
                            </Button>
                            <Button
                              size="sm"
                              className="bg-slate-700 hover:bg-slate-600"
                              onClick={() => startAccessPolling(focusedListing.listingId, walletAddress!)}
                            >
                              Re-start polling
                            </Button>
                          </div>
                        </>
                      ) : (
                        <p className="text-green-400">✅ Access granted! You can now retrieve the purchase details.</p>
                      )}
                    </div>
                  )}

                  {/* -------- Buyer details -------- */}
                  {canViewFocused ? (
                    <div className="mt-4 p-4 rounded-md bg-slate-900/50 border border-slate-700">
                      <div className="flex items-center justify-between">
                        <h4 className="text-sm font-semibold text-white">Purchase Details</h4>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600"
                            onClick={() => downloadReceipt(focusedListing)}
                          >
                            Download Receipt (.json)
                          </Button>
                          <Button
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600"
                            onClick={async () => {
                              try {
                                await navigator.clipboard.writeText(JSON.stringify(buildReceiptJSON(focusedListing), null, 2));
                              } catch {}
                            }}
                          >
                            Copy Summary
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-3 text-xs">
                        <div className="space-y-1">
                          <p className="text-slate-400">Task Type</p>
                          <p className="text-white">{focusedListing.labels?.taskType}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-400">Data Type</p>
                          <p className="text-white">{focusedListing.labels?.dataType}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-400">Quality Score</p>
                          <p className="text-white">{focusedListing.labels?.qualityScore}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-400">Sample Count</p>
                          <p className="text-white">{focusedListing.labels?.sampleCount?.toString?.() ?? "-"}</p>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <p className="text-slate-400">Categories</p>
                          <p className="text-white break-words">{(focusedListing.labels?.categories ?? []).join(", ")}</p>
                        </div>
                        <div className="space-y-1 md:col-span-2">
                          <p className="text-slate-400">Annotations</p>
                          <pre className="text-[11px] leading-relaxed bg-slate-950/50 border border-slate-800 rounded p-2 text-slate-200 whitespace-pre-wrap">
                            {tryPrettyJSON(focusedListing.labels?.annotations)}
                          </pre>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-400">Privacy</p>
                          <p className="text-white">{focusedListing.labels?.privacy}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-slate-400">Content Hash</p>
                          <p className="text-white font-mono break-all">{focusedListing.labels?.contentHash}</p>
                        </div>
                      </div>

                      <div className="mt-4">
                        <p className="text-slate-400 text-xs mb-1">Auth Ticket</p>
                        <div className="flex items-center gap-2">
                          <Input
                            readOnly
                            type={revealAuth ? "text" : "password"}
                            value={focusedListing.authTicket || ""}
                            className="bg-slate-900 border-slate-700 text-white text-xs"
                          />
                          <Button size="sm" className="bg-slate-700 hover:bg-slate-600" onClick={() => setRevealAuth((v) => !v)}>
                            {revealAuth ? "Hide" : "Reveal"}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600"
                            onClick={async () => { try { await navigator.clipboard.writeText(focusedListing.authTicket || ""); } catch {} }}
                          >
                            Copy
                          </Button>
                        </div>
                        <p className="text-[11px] text-slate-500 mt-1">Keep this token safe.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-4 p-3 rounded-md bg-slate-900/40 border border-slate-800 text-xs text-slate-400">
                      Purchase to unlock full details and the auth ticket.
                    </div>
                  )}
                </div>
              )}

              {txHash && (
                <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 mt-4">
                  <p className="text-xs text-slate-400 mb-1">Transaction Hash</p>
                  <p className="text-xs font-mono text-green-400 break-all">{txHash}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- MY LISTINGS -------- */}
        <TabsContent value="my" className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-cyan-400">My Listings</CardTitle>
              <CardDescription>Only you can see this list. Share a private link with buyers.</CardDescription>
            </CardHeader>
            <CardContent>
              {globalError && <p className="text-xs text-red-400 mb-3">{globalError}</p>}
              {loadingMy && <p className="text-slate-400 text-sm">Loading…</p>}
              {!loadingMy && myListings.length === 0 ? (
                <p className="text-slate-400 text-sm">You have no listings yet.</p>
              ) : (
                <div className="space-y-3">
                  {myListings.map((l, idx) => {
                    const link = typeof window !== "undefined"
                      ? `${window.location.origin}${window.location.pathname}?lid=${l.listingId}`
                      : "";
                    return (
                      <div key={idx} className="p-4 rounded-lg border border-slate-700 bg-slate-800/50 hover:bg-slate-800 transition">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <p className="text-sm font-mono text-cyan-400">
                              ID: {short(l.listingId)} · {l.labels?.taskType}/{l.labels?.dataType}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">Seller: {short(l.seller)}</p>
                            <p className="text-xs text-slate-400">
                              Samples: {l.labels?.sampleCount?.toString?.() ?? "-"} · Quality: {Number(l.labels?.qualityScore ?? 0)}
                            </p>
                            <p className="text-xs text-slate-400">
                              Categories: {(l.labels?.categories ?? []).join(", ")}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-white">{fmtUSDC(l.price)} USDC</p>
                            <p className="text-xs mt-1">
                              Status: {l.active ? <span className="text-green-400">Active</span> : <span className="text-slate-400">Inactive</span>}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Input readOnly value={link} className="bg-slate-900 border-slate-700 text-white text-xs" />
                          <Button
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600"
                            onClick={async () => { try { await navigator.clipboard.writeText(link); } catch {} }}
                          >
                            Copy Link
                          </Button>
                          <Button
                            size="sm"
                            className="bg-slate-700 hover:bg-slate-600"
                            onClick={() => {
                              setFocusedInput(l.listingId);
                              setFocusedListing(l);
                              setRevealAuth(false);
                              setAccessErr(""); setAccessLast(null);
                            }}
                          >
                            Open
                          </Button>
                        </div>

                        <p className="text-xs text-slate-500 mt-2">ObjectId: {short(l.objectId)}</p>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* -------- LIST NEW -------- */}
        <TabsContent value="list" className="space-y-4">
          <Card className="border-slate-800 bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-cyan-400">List Your Data (Private)</CardTitle>
              <CardDescription>Not shown publicly. Share the link with buyers to purchase.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="objectId" className="text-slate-300">Object ID (string or 0x…32)</Label>
                  <Input id="objectId" placeholder="dataset-001" value={objectIdInput} onChange={(e) => setObjectIdInput(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-2" />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="taskType" className="text-slate-300">Task Type</Label>
                    <select id="taskType" value={taskType} onChange={(e) => setTaskType(e.target.value)} className="w-full mt-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm">
                      <option>classification</option>
                      <option>detection</option>
                      <option>segmentation</option>
                    </select>
                  </div>
                  <div>
                    <Label htmlFor="dataType" className="text-slate-300">Data Type</Label>
                    <select id="dataType" value={dataType} onChange={(e) => setDataType(e.target.value)} className="w-full mt-2 px-3 py-2 rounded-lg bg-slate-800 border border-slate-700 text-white text-sm">
                      <option>image</option>
                      <option>text</option>
                      <option>video</option>
                      <option>audio</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="quality" className="text-slate-300">Quality Score (1–100)</Label>
                    <Input id="quality" type="number" min={1} max={100} value={qualityScore} onChange={(e) => setQualityScore(parseInt(e.target.value || "0", 10))} className="bg-slate-800 border-slate-700 text-white mt-2" />
                  </div>
                  <div>
                    <Label htmlFor="samples" className="text-slate-300">Sample Count</Label>
                    <Input id="samples" type="number" placeholder="5000" value={sampleCount} onChange={(e) => setSampleCount(parseInt(e.target.value || "0", 10))} className="bg-slate-800 border-slate-700 text-white mt-2" />
                  </div>
                </div>

                <div>
                  <Label className="text-slate-300">Categories (comma separated)</Label>
                  <Input value={categories} onChange={(e) => setCategories(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-2" />
                </div>

                <div>
                  <Label className="text-slate-300">Annotations (JSON string)</Label>
                  <Input value={annotations} onChange={(e) => setAnnotations(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-2" />
                </div>

                <div>
                  <Label className="text-slate-300">Privacy (string)</Label>
                  <Input value={privacy} onChange={(e) => setPrivacy(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-2" />
                </div>

                <div>
                  <Label className="text-slate-300">Content Hash (string or 0x…32)</Label>
                  <Input value={contentHashInput} onChange={(e) => setContentHashInput(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-2" />
                </div>

                <div>
                  <Label className="text-slate-300">Price (USDC)</Label>
                  <Input type="number" step="0.000001" placeholder="0.05" value={priceUSDC} onChange={(e) => setPriceUSDC(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-2" />
                </div>

                <div>
                  <Label className="text-slate-300">Auth Ticket</Label>
                  <Input value={authTicket} onChange={(e) => setAuthTicket(e.target.value)} className="bg-slate-800 border-slate-700 text-white mt-2" />
                </div>

                <Button onClick={handleCreateListing} disabled={!ready} className="w-full bg-cyan-600 hover:bg-cyan-700">
                  Create Private Listing
                </Button>

                {globalError && <p className="text-xs text-red-400">{globalError}</p>}

                {txHash && (
                  <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 mt-3">
                    <p className="text-xs text-slate-400 mb-1">Transaction Hash</p>
                    <p className="text-xs font-mono text-green-400 break-all">{txHash}</p>
                  </div>
                )}

                {newListingId && (
                  <div className="p-3 rounded-lg bg-slate-800 border border-slate-700 mt-3">
                    <p className="text-xs text-slate-400 mb-2">Private Share Link</p>
                    <div className="flex gap-2">
                      <Input readOnly value={shareUrl} className="bg-slate-900 border-slate-700 text-white text-xs" />
                      <Button size="sm" className="bg-slate-700 hover:bg-slate-600" onClick={async () => { try { await navigator.clipboard.writeText(shareUrl); } catch {} }}>
                        Copy Link
                      </Button>
                    </div>
                    <p className="text-[11px] text-slate-500 mt-2 break-all">Listing ID: {newListingId}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
