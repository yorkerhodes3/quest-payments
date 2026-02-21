import type { NetworkConfig } from './networks.js';
import type { Money } from '@quest-payments/models';

export interface SettlementRequest {
  /** x402 payment payload from the buyer's wallet. */
  payload: string;
  /** Amount expected (in USDC base units, 6 decimals). */
  expectedAmount: string;
  /** Address expected to receive the payment. */
  expectedPayTo: string;
  /** Arbitrary reference (e.g. purchaseId) for idempotency checks. */
  reference: string;
}

export interface SettlementResult {
  readonly success: boolean;
  readonly txHash?: string;
  readonly error?: string;
}

export interface FacilitatorResponse {
  success: boolean;
  txHash?: string;
  error?: string;
}

export type FetchFn = typeof globalThis.fetch;

export interface QuestSettlementOptions {
  network: NetworkConfig;
  fetch?: FetchFn;
}

/**
 * QuestSettlement wraps the x402 facilitator to verify and settle
 * USDC payments.  It is framework-agnostic — inject a custom `fetch`
 * for testing or alternate HTTP clients.
 */
export class QuestSettlement {
  private readonly network: NetworkConfig;
  private readonly fetch: FetchFn;

  constructor(options: QuestSettlementOptions) {
    this.network = options.network;
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  /**
   * Verify and settle a payment through the x402 facilitator.
   * Returns a SettlementResult indicating success or failure.
   */
  async settle(request: SettlementRequest): Promise<SettlementResult> {
    let response: Response;
    try {
      response = await this.fetch(`${this.network.facilitatorUrl}/settle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payload: request.payload,
          network: this.network.name,
          chainId: this.network.chainId,
          expectedAmount: request.expectedAmount,
          expectedPayTo: request.expectedPayTo,
          reference: request.reference,
        }),
      });
    } catch (err) {
      return {
        success: false,
        error: `Network error contacting facilitator: ${String(err)}`,
      };
    }

    let body: FacilitatorResponse;
    try {
      body = (await response.json()) as FacilitatorResponse;
    } catch {
      return {
        success: false,
        error: `Facilitator returned non-JSON response (HTTP ${response.status})`,
      };
    }

    if (!response.ok || !body.success) {
      return {
        success: false,
        error: body.error ?? `Facilitator error (HTTP ${response.status})`,
      };
    }

    return { success: true, ...(body.txHash !== undefined ? { txHash: body.txHash } : {}) };
  }

  /**
   * Convert a Money value (USD cents or USDC base units) to the
   * USDC base-unit string expected by the x402 facilitator.
   */
  static toBaseUnits(money: Money): string {
    if (money.currency === 'USDC') {
      return money.amount.toString();
    }
    // USD cents → USDC base units (assume 1 USD = 1 USDC, 6 decimals)
    // cents / 100 * 1_000_000 = cents * 10_000
    return (money.amount * 10_000).toString();
  }
}
