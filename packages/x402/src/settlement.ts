/**
 * Settlement service for Quest Payments via x402.
 *
 * Handles the flow: purchase resolved -> calculate net price -> settle
 * USDC to the organizer via the x402 facilitator.
 *
 * Framework-agnostic. Depends only on a fetch-like function and
 * the @quest-payments/models types.
 */

import type { Purchase, Money, SettlementInfo } from "@quest-payments/models";
import { netPrice } from "@quest-payments/models";
import type { NetworkConfig } from "./networks.js";

export interface SettlementRequest {
  purchase: Purchase;
  /** Organizer's wallet address that receives the net payment. */
  organizerAddress: string;
  /** Network to settle on. */
  network: NetworkConfig;
  /** Signed payment payload from the buyer (produced by x402 client SDK). */
  paymentPayload: string;
}

export interface SettlementResult {
  success: boolean;
  /** On-chain transaction hash if settlement succeeded. */
  txHash: string | null;
  /** Final USDC amount settled. */
  amountSettled: Money | null;
  /** Error message if settlement failed. */
  error: string | null;
}

type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export class QuestSettlement {
  constructor(
    private readonly facilitatorUrl: string,
    private readonly fetch: FetchFn = globalThis.fetch,
  ) {}

  /**
   * Verify a payment payload with the facilitator before serving the resource.
   */
  async verifyPayment(paymentPayload: string, network: NetworkConfig): Promise<boolean> {
    const res = await this.fetch(`${this.facilitatorUrl}/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: paymentPayload,
        network: network.networkId,
      }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as { valid: boolean };
    return data.valid;
  }

  /**
   * Request the facilitator to settle (broadcast) the payment on-chain.
   */
  async settle(req: SettlementRequest): Promise<SettlementResult> {
    const amount = netPrice(req.purchase);

    try {
      const res = await this.fetch(`${this.facilitatorUrl}/settle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payload: req.paymentPayload,
          network: req.network.networkId,
          amount: amount.amount.toString(),
          payTo: req.organizerAddress,
        }),
      });

      if (!res.ok) {
        const errBody = await res.text();
        return { success: false, txHash: null, amountSettled: null, error: `Facilitator error (${res.status}): ${errBody}` };
      }

      const data = (await res.json()) as { txHash: string };
      return {
        success: true,
        txHash: data.txHash,
        amountSettled: amount,
        error: null,
      };
    } catch (err) {
      return {
        success: false,
        txHash: null,
        amountSettled: null,
        error: err instanceof Error ? err.message : "Unknown settlement error",
      };
    }
  }
}
