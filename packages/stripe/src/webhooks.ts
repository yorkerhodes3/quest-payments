import type { PurchaseId } from '@quest-payments/models';

// ─── Quest domain events (typed output from webhook handler) ─────────────────

export type QuestPaymentEvent =
  | QuestPaymentAuthorized
  | QuestPaymentCaptured
  | QuestPaymentRefunded
  | QuestPaymentCancelled
  | QuestPaymentFailed;

export interface QuestPaymentAuthorized {
  type: 'payment.authorized';
  purchaseId: PurchaseId;
  paymentIntentId: string;
  amountCents: number;
}

export interface QuestPaymentCaptured {
  type: 'payment.captured';
  purchaseId: PurchaseId;
  paymentIntentId: string;
  capturedAmountCents: number;
}

export interface QuestPaymentRefunded {
  type: 'payment.refunded';
  purchaseId: PurchaseId;
  paymentIntentId: string;
  refundId: string;
  refundAmountCents: number;
}

export interface QuestPaymentCancelled {
  type: 'payment.cancelled';
  purchaseId: PurchaseId;
  paymentIntentId: string;
}

export interface QuestPaymentFailed {
  type: 'payment.failed';
  purchaseId: PurchaseId;
  paymentIntentId: string;
  error: string;
}

// ─── Minimal Stripe event shapes ─────────────────────────────────────────────

interface StripeObject {
  id: string;
  metadata: Record<string, string>;
}

interface StripePaymentIntentEvent {
  type: string;
  data: {
    object: StripeObject & {
      amount: number;
      amount_received: number;
      last_payment_error?: { message?: string };
    };
  };
}

interface StripeChargeEvent {
  type: string;
  data: {
    object: StripeObject & {
      payment_intent: string;
      amount_refunded: number;
    };
  };
}

interface StripeRefundEvent {
  type: string;
  data: {
    object: StripeObject & {
      payment_intent: string;
      amount: number;
    };
  };
}

type StripeEvent = StripePaymentIntentEvent | StripeChargeEvent | StripeRefundEvent;

// ─── Minimal Stripe webhook construction interface ───────────────────────────

export interface StripeWebhookClient {
  webhooks: {
    constructEvent(body: string, signature: string, secret: string): StripeEvent;
  };
}

export interface QuestWebhookHandlerOptions {
  stripe: StripeWebhookClient;
  webhookSecret: string;
}

/**
 * QuestWebhookHandler parses Stripe webhook events into typed Quest domain
 * events.  Pass raw body (string) and Stripe-Signature header directly from
 * your HTTP framework.
 */
export class QuestWebhookHandler {
  private readonly stripe: StripeWebhookClient;
  private readonly webhookSecret: string;

  constructor(options: QuestWebhookHandlerOptions) {
    this.stripe = options.stripe;
    this.webhookSecret = options.webhookSecret;
  }

  /**
   * Parse and validate a raw Stripe webhook.
   * Returns a typed QuestPaymentEvent or null if the event type is unhandled.
   */
  handle(rawBody: string, stripeSignature: string): QuestPaymentEvent | null {
    let event: StripeEvent;
    try {
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        stripeSignature,
        this.webhookSecret,
      );
    } catch {
      throw new Error('Webhook signature verification failed');
    }

    return this.map(event);
  }

  private map(event: StripeEvent): QuestPaymentEvent | null {
    switch (event.type) {
      case 'payment_intent.amount_capturable_updated': {
        const pi = (event as StripePaymentIntentEvent).data.object;
        const purchaseId = pi.metadata['purchaseId'] as PurchaseId | undefined;
        if (!purchaseId) return null;
        return {
          type: 'payment.authorized',
          purchaseId,
          paymentIntentId: pi.id,
          amountCents: pi.amount,
        };
      }

      case 'payment_intent.succeeded': {
        const pi = (event as StripePaymentIntentEvent).data.object;
        const purchaseId = pi.metadata['purchaseId'] as PurchaseId | undefined;
        if (!purchaseId) return null;
        return {
          type: 'payment.captured',
          purchaseId,
          paymentIntentId: pi.id,
          capturedAmountCents: pi.amount_received,
        };
      }

      case 'charge.refunded': {
        const charge = (event as StripeChargeEvent).data.object;
        const purchaseId = charge.metadata['purchaseId'] as PurchaseId | undefined;
        if (!purchaseId) return null;
        return {
          type: 'payment.refunded',
          purchaseId,
          paymentIntentId: charge.payment_intent,
          refundId: charge.id,
          refundAmountCents: charge.amount_refunded,
        };
      }

      case 'payment_intent.canceled': {
        const pi = (event as StripePaymentIntentEvent).data.object;
        const purchaseId = pi.metadata['purchaseId'] as PurchaseId | undefined;
        if (!purchaseId) return null;
        return {
          type: 'payment.cancelled',
          purchaseId,
          paymentIntentId: pi.id,
        };
      }

      case 'payment_intent.payment_failed': {
        const pi = (event as StripePaymentIntentEvent).data.object;
        const purchaseId = pi.metadata['purchaseId'] as PurchaseId | undefined;
        if (!purchaseId) return null;
        return {
          type: 'payment.failed',
          purchaseId,
          paymentIntentId: pi.id,
          error: pi.last_payment_error?.message ?? 'Payment failed',
        };
      }

      default:
        return null;
    }
  }
}
