// lib/contract-abis.ts
// ✅ ABIs aligned with your Hardhat artifact

export const MOCKX402_ABI = [
  { type: "function", name: "name", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "symbol", inputs: [], outputs: [{ type: "string" }], stateMutability: "view" },
  { type: "function", name: "decimals", inputs: [], outputs: [{ type: "uint8" }], stateMutability: "view" },
  { type: "function", name: "totalSupply", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  { type: "function", name: "balanceOf", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function",
    name: "transfer",
    inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "approve",
    inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }],
    outputs: [{ type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [{ name: "owner", type: "address" }, { name: "spender", type: "address" }],
    outputs: [{ type: "uint256" }],
    stateMutability: "view",
  },
];

export const DATAMARKET_ABI = [
  // Reads
  { type: "function", name: "getTotalListings", inputs: [], outputs: [{ type: "uint256" }], stateMutability: "view" },
  {
    type: "function", name: "getActiveListings",
    inputs: [{ type: "uint256", name: "offset" }, { type: "uint256", name: "limit" }],
    outputs: [{ type: "bytes32[]" }], stateMutability: "view",
  },
  {
    type: "function", name: "listings", stateMutability: "view",
    inputs: [{ type: "bytes32", name: "" }],
    outputs: [
      { type: "bytes32", name: "listingId" },
      { type: "address", name: "seller" },
      { type: "bytes32", name: "objectId" },
      { type: "uint256", name: "price" },
      { type: "uint256", name: "createdAt" },
      { type: "bool",    name: "active" },
      {
        type: "tuple", name: "labels", components: [
          { type: "string",   name: "taskType" },
          { type: "string",   name: "dataType" },
          { type: "uint8",    name: "qualityScore" },
          { type: "string[]", name: "categories" },
          { type: "string",   name: "annotations" },
          { type: "uint256",  name: "sampleCount" },
          { type: "string",   name: "privacy" },
          { type: "bytes32",  name: "contentHash" },
        ]
      },
      { type: "string",  name: "authTicket" },
    ],
  },
  { type: "function", name: "getSellerListings", inputs: [{ type: "address", name: "seller" }], outputs: [{ type: "bytes32[]" }], stateMutability: "view" },
  { type: "function", name: "getBuyerPurchases", inputs: [{ type: "address", name: "buyer" }],  outputs: [{ type: "bytes32[]" }], stateMutability: "view" },
  { type: "function", name: "hasPurchased", inputs: [{ type: "bytes32", name: "listingId" }, { type: "address", name: "buyer" }], outputs: [{ type: "bool" }], stateMutability: "view" },
  { type: "function", name: "getAuthTicket", inputs: [{ type: "bytes32", name: "listingId" }], outputs: [{ type: "string" }], stateMutability: "view" },

  // Writes
  {
    type: "function", name: "listData", stateMutability: "nonpayable",
    inputs: [
      { type: "bytes32", name: "objectId" },
      { type: "uint256", name: "price" },
      {
        type: "tuple", name: "labels", components: [
          { type: "string",   name: "taskType" },
          { type: "string",   name: "dataType" },
          { type: "uint8",    name: "qualityScore" },
          { type: "string[]", name: "categories" },
          { type: "string",   name: "annotations" },
          { type: "uint256",  name: "sampleCount" },
          { type: "string",   name: "privacy" },
          { type: "bytes32",  name: "contentHash" },
        ]
      },
      { type: "string", name: "authTicket" },
    ],
    outputs: [{ type: "bytes32", name: "listingId" }],
  },
  {
    type: "function", name: "purchaseData", stateMutability: "nonpayable",
    inputs: [{ type: "bytes32", name: "listingId" }],
    outputs: [{ type: "bytes32", name: "purchaseId" }],
  },

  // Events (optional for UI to listen)
  {
    type: "event", name: "DataListed", inputs: [
      { indexed: true,  type: "bytes32", name: "listingId" },
      { indexed: true,  type: "address", name: "seller" },
      { indexed: false, type: "bytes32", name: "objectId" },
      { indexed: false, type: "uint256", name: "price" },
      { indexed: false, type: "string",  name: "taskType" },
      { indexed: false, type: "string",  name: "dataType" },
      { indexed: false, type: "uint8",   name: "qualityScore" },
    ]
  },
  {
    type: "event", name: "DataPurchased", inputs: [
      { indexed: true,  type: "bytes32", name: "purchaseId" },
      { indexed: true,  type: "bytes32", name: "listingId" },
      { indexed: true,  type: "address", name: "buyer" },
      { indexed: false, type: "uint256", name: "amount" },
    ]
  },
];

export const NETWORKS = {
  sepolia: {
    chainId: 11155111,
    name: "Sepolia Testnet",
    rpcUrl: "https://eth-sepolia.g.alchemy.com/v2/YOUR_ALCHEMY_KEY",
    explorerUrl: "https://sepolia.etherscan.io",
  },
  localhost: {
    chainId: 31337,
    name: "Localhost",
    rpcUrl: "http://127.0.0.1:8545",
    explorerUrl: "http://localhost:8545",
  },
} as const;
