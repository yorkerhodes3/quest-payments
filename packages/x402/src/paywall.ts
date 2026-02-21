/**
 * Construct the HTTP 402 response payload that tells an x402-aware
 * client how to pay for a resource.
 *
 * Framework-agnostic: returns a plain object. Your HTTP framework
 * adapter (Express, Hono, Next.js, etc.) serialises it into the response.
 */

import type { Money } from "@quest-payments/models";
import type { NetworkConfig } from "./networks.js";

export interface X402PaywallConfig {
  /** USDC amount to charge. */
  price: Money;
  /** Wallet address that receives payment. */
  payTo: string;
  /** Network to settle on. */
  network: NetworkConfig;
  /** Human-readable description of what's being purchased. */
  description: string;
  /** Optional: maximum age of the payment signature in seconds. */
  maxAgeSeconds?: number;
}

export interface X402PaywallResponse {
  status: 402;
  headers: Record<string, string>;
  body: {
    error: string;
    accepts: Array<{
      scheme: "exact";
      network: string;
      token: string;
      amount: string;
      payTo: string;
      description: string;
      maxAgeSeconds: number;
    }>;
  };
}

/**
 * Build the 402 response payload for a given paywall config.
 * The caller is responsible for actually sending this as an HTTP response.
 */
export function createPaywallResponse(config: X402PaywallConfig): X402PaywallResponse {
  const amountStr = config.price.amount.toString();
  const maxAge = config.maxAgeSeconds ?? 300; // 5 minutes default

  return {
    status: 402,
    headers: {
      "Content-Type": "application/json",
      "X-Payment-Required": "true",
    },
    body: {
      error: "Payment Required",
      accepts: [
        {
          scheme: "exact",
          network: config.network.networkId,
          token: config.network.usdcAddress,
          amount: amountStr,
          payTo: config.payTo,
          description: config.description,
          maxAgeSeconds: maxAge,
        },
      ],
    },
  };
}
