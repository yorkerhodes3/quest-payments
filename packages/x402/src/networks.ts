/**
 * Supported L2 networks for USDC settlement via x402.
 * Network identifiers follow the CAIP-2 format: "eip155:<chainId>".
 */

export interface NetworkConfig {
  /** CAIP-2 network identifier. */
  networkId: string;
  /** Human-readable name. */
  name: string;
  /** Chain ID (decimal). */
  chainId: number;
  /** USDC contract address on this network. */
  usdcAddress: string;
  /** x402 facilitator URL (Coinbase-hosted or self-hosted). */
  facilitatorUrl: string;
  /** Typical gas cost for a USDC transfer in USD. */
  typicalGasCostUsd: number;
}

export const SUPPORTED_NETWORKS: Record<string, NetworkConfig> = {
  base: {
    networkId: "eip155:8453",
    name: "Base",
    chainId: 8453,
    usdcAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    facilitatorUrl: "https://x402.org/facilitator",
    typicalGasCostUsd: 0.001,
  },
  baseSepolia: {
    networkId: "eip155:84532",
    name: "Base Sepolia",
    chainId: 84532,
    usdcAddress: "0x036CbD53842c5426634e7929541eC2318f3dCF7e",
    facilitatorUrl: "https://x402.org/facilitator",
    typicalGasCostUsd: 0,
  },
  arbitrum: {
    networkId: "eip155:42161",
    name: "Arbitrum One",
    chainId: 42161,
    usdcAddress: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    facilitatorUrl: "https://x402.org/facilitator",
    typicalGasCostUsd: 0.005,
  },
} as const;
