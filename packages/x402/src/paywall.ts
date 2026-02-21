import type { NetworkConfig } from './networks.js';

/**
 * Builds a standards-compliant HTTP 402 Payment Required response body
 * per the x402 protocol specification.
 *
 * @see https://github.com/coinbase/x402
 */

export interface PaywallOptions {
  network: NetworkConfig;
  /** Amount in USDC (human-readable, e.g. 99.00 for $99). */
  amount: number;
  /** Address that will receive the payment (organizer's wallet). */
  payTo: string;
  /** Resource being purchased (e.g. the purchase ID or resource URL). */
  resource: string;
  /** Memo included in the payment (e.g. event name + ticket tier). */
  memo?: string;
}

export interface PaywallResponse {
  status: 402;
  accepts: PaymentAcceptance[];
}

export interface PaymentAcceptance {
  scheme: 'exact';
  network: string;
  chainId: number;
  maxAmountRequired: string;  // in USDC base units (6 decimals)
  resource: string;
  description: string;
  mimeType: 'application/json';
  outputSchema: null;
  payTo: string;
  asset: string;
  extra: {
    name: string;
    version: string;
  };
}

/** Convert a human-readable USDC amount to base units (6 decimals). */
export function toUsdcBaseUnits(amount: number): string {
  return Math.round(amount * 1_000_000).toString();
}

/** Build the x402 paywall response body for a given purchase. */
export function buildPaywallResponse(options: PaywallOptions): PaywallResponse {
  const { network, amount, payTo, resource, memo } = options;

  return {
    status: 402,
    accepts: [
      {
        scheme: 'exact',
        network: network.name.toLowerCase().replace(/\s+/g, '-'),
        chainId: network.chainId,
        maxAmountRequired: toUsdcBaseUnits(amount),
        resource,
        description: memo ?? `Payment for ${resource}`,
        mimeType: 'application/json',
        outputSchema: null,
        payTo,
        asset: network.usdcAddress,
        extra: {
          name: 'USDC',
          version: '1',
        },
      },
    ],
  };
}
