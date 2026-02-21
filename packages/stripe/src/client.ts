/**
 * Quest-specific Stripe client wrapper.
 *
 * Encapsulates the three payment flows relevant to Quest Payments:
 *   1. Auth-then-capture (manual capture PaymentIntents)
 *   2. Immediate charge (automatic capture)
 *   3. Refund / partial refund
 *
 * Uses the Stripe SDK as a peer dependency so callers control the
 * version and initialisation (API key, etc.).
 */

import type { Money, Purchase, PurchaseId } from "@quest-payments/models";
import { netPrice } from "@quest-payments/models";

// ── Stripe SDK types (minimal surface to avoid tight coupling) ─────
// Callers pass in an initialised Stripe instance.

interface StripePaymentIntent {
  id: string;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
  client_secret: string | null;
}

interface StripeRefund {
  id: string;
  status: string;
  amount: number;
}

interface StripeClient {
  paymentIntents: {
    create(params: Record<string, unknown>): Promise<StripePaymentIntent>;
    capture(id: string, params?: Record<string, unknown>): Promise<StripePaymentIntent>;
    cancel(id: string): Promise<StripePaymentIntent>;
  };
  refunds: {
    create(params: Record<string, unknown>): Promise<StripeRefund>;
  };
}

// ── Public API ─────────────────────────────────────────────────────

export interface CreatePaymentOptions {
  /** Unique Quest purchase ID (stored in Stripe metadata for reconciliation). */
  purchaseId: PurchaseId;
  /** Amount to authorise. */
  amount: Money;
  /** "manual" for auth-then-capture, "automatic" for immediate charge. */
  captureMethod: "manual" | "automatic";
  /** Optional Stripe Customer ID for returning buyers. */
  customerId?: string;
  /** Arbitrary metadata passed through to Stripe. */
  metadata?: Record<string, string>;
}

export interface CaptureOptions {
  /** Stripe PaymentIntent ID to capture. */
  paymentIntentId: string;
  /** Amount to capture in smallest currency unit. If omitted, captures the full authorised amount. */
  amountToCapture?: number;
}

export interface RefundOptions {
  /** Stripe PaymentIntent ID to refund against. */
  paymentIntentId: string;
  /** Amount to refund in smallest currency unit. If omitted, refunds the full charge. */
  amount?: number;
  /** Reason for refund shown to the customer. */
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}

export class QuestStripeClient {
  constructor(private readonly stripe: StripeClient) {}

  /**
   * Create a PaymentIntent for a ticket purchase.
   *
   * With captureMethod="manual", the funds are held (authorized)
   * but not captured. Call `capture()` later with the net amount
   * after incentives are resolved.
   *
   * Note: manual-capture auths expire in ~7 days on most card
   * networks. If your incentive window is longer, use
   * captureMethod="automatic" and issue refunds instead.
   */
  async createPayment(opts: CreatePaymentOptions): Promise<StripePaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: Number(opts.amount.amount),
      currency: opts.amount.currency.toLowerCase(),
      capture_method: opts.captureMethod,
      customer: opts.customerId,
      metadata: {
        quest_purchase_id: opts.purchaseId,
        ...opts.metadata,
      },
    });
  }

  /**
   * Capture an authorized PaymentIntent.
   *
   * Pass `amountToCapture` to capture less than the authorized amount
   * (the remainder is automatically released to the cardholder).
   * This is the cleanest path for the auth-then-capture strategy.
   */
  async capture(opts: CaptureOptions): Promise<StripePaymentIntent> {
    const params: Record<string, unknown> = {};
    if (opts.amountToCapture !== undefined) {
      params.amount_to_capture = opts.amountToCapture;
    }
    return this.stripe.paymentIntents.capture(opts.paymentIntentId, params);
  }

  /**
   * Capture with the net price after incentives for a given purchase.
   * Convenience method that computes the capture amount from the
   * purchase's verified discount basis points.
   */
  async captureForPurchase(paymentIntentId: string, purchase: Purchase): Promise<StripePaymentIntent> {
    const net = netPrice(purchase);
    return this.capture({
      paymentIntentId,
      amountToCapture: Number(net.amount),
    });
  }

  /**
   * Cancel an uncaptured authorization (release the hold).
   */
  async cancelAuth(paymentIntentId: string): Promise<StripePaymentIntent> {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  /**
   * Issue a refund (full or partial) against a captured PaymentIntent.
   *
   * Important: as of 2023, Stripe does NOT return the original
   * processing fee (2.9% + $0.30) on refunds. This is a real cost
   * that makes the charge-then-refund strategy more expensive than
   * auth-then-capture for discount-heavy scenarios.
   */
  async refund(opts: RefundOptions): Promise<StripeRefund> {
    return this.stripe.refunds.create({
      payment_intent: opts.paymentIntentId,
      amount: opts.amount,
      reason: opts.reason,
    });
  }
}
