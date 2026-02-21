import type { Money, PurchaseId } from '@quest-payments/models';

/** Minimal interface for the Stripe SDK — allows injection of mocks in tests. */
export interface StripeClient {
  paymentIntents: {
    create(params: StripePaymentIntentCreateParams): Promise<StripePaymentIntent>;
    capture(id: string, params?: StripePaymentIntentCaptureParams): Promise<StripePaymentIntent>;
    cancel(id: string): Promise<StripePaymentIntent>;
    retrieve(id: string): Promise<StripePaymentIntent>;
  };
  refunds: {
    create(params: StripeRefundCreateParams): Promise<StripeRefund>;
  };
}

// ─── Minimal Stripe type shapes ──────────────────────────────────────────────

export interface StripePaymentIntentCreateParams {
  amount: number;
  currency: string;
  capture_method: 'manual' | 'automatic';
  confirm?: boolean;
  payment_method?: string;
  metadata?: Record<string, string>;
  description?: string;
}

export interface StripePaymentIntentCaptureParams {
  amount_to_capture?: number;
}

export interface StripePaymentIntent {
  id: string;
  status: string;
  amount: number;
  amount_received: number;
  currency: string;
  metadata: Record<string, string>;
}

export interface StripeRefundCreateParams {
  payment_intent: string;
  amount?: number;
  reason?: 'duplicate' | 'fraudulent' | 'requested_by_customer';
  metadata?: Record<string, string>;
}

export interface StripeRefund {
  id: string;
  amount: number;
  status: string;
  payment_intent: string;
}

// ─── QuestStripeClient ────────────────────────────────────────────────────────

export interface CreateAuthorizationOptions {
  purchaseId: PurchaseId;
  amount: Money;
  paymentMethodId: string;
  description?: string;
}

export interface CaptureOptions {
  paymentIntentId: string;
  netAmount: Money;
}

export interface RefundOptions {
  paymentIntentId: string;
  amount: Money;
  purchaseId: PurchaseId;
}

export interface QuestStripeClientOptions {
  stripe: StripeClient;
  currency?: string; // default 'usd'
}

/**
 * QuestStripeClient wraps Stripe PaymentIntent create/capture/cancel/refund
 * flows with Quest-domain semantics.
 *
 * Accepts a Stripe SDK instance via constructor — fully framework-agnostic.
 */
export class QuestStripeClient {
  private readonly stripe: StripeClient;
  private readonly currency: string;

  constructor(options: QuestStripeClientOptions) {
    this.stripe = options.stripe;
    this.currency = options.currency ?? 'usd';
  }

  /**
   * Create a manual-capture PaymentIntent (authorization hold) for the full
   * ticket price.  Call `captureNet` later once incentives are resolved.
   */
  async authorize(options: CreateAuthorizationOptions): Promise<StripePaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: options.amount.amount,
      currency: this.currency,
      capture_method: 'manual',
      confirm: true,
      payment_method: options.paymentMethodId,
      description: options.description ?? `Quest ticket — ${options.purchaseId}`,
      metadata: {
        purchaseId: options.purchaseId,
        strategy: 'auth_then_capture',
      },
    });
  }

  /**
   * Create an automatic-capture PaymentIntent (immediate charge) for the full
   * ticket price.  Used in the charge-then-refund or hybrid strategies.
   */
  async charge(options: CreateAuthorizationOptions): Promise<StripePaymentIntent> {
    return this.stripe.paymentIntents.create({
      amount: options.amount.amount,
      currency: this.currency,
      capture_method: 'automatic',
      confirm: true,
      payment_method: options.paymentMethodId,
      description: options.description ?? `Quest ticket — ${options.purchaseId}`,
      metadata: {
        purchaseId: options.purchaseId,
        strategy: 'charge_then_refund',
      },
    });
  }

  /**
   * Capture a net-of-discounts amount on an existing authorization.
   * `netAmount` should be the base price minus all earned discounts.
   */
  async captureNet(options: CaptureOptions): Promise<StripePaymentIntent> {
    return this.stripe.paymentIntents.capture(options.paymentIntentId, {
      amount_to_capture: options.netAmount.amount,
    });
  }

  /**
   * Cancel an authorization without capturing any funds.
   */
  async cancel(paymentIntentId: string): Promise<StripePaymentIntent> {
    return this.stripe.paymentIntents.cancel(paymentIntentId);
  }

  /**
   * Issue a partial refund for an earned incentive discount.
   */
  async refund(options: RefundOptions): Promise<StripeRefund> {
    return this.stripe.refunds.create({
      payment_intent: options.paymentIntentId,
      amount: options.amount.amount,
      reason: 'requested_by_customer',
      metadata: {
        purchaseId: options.purchaseId,
        type: 'incentive_discount',
      },
    });
  }
}
