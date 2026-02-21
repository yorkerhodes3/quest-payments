/**
 * Webhook handler for Stripe events relevant to Quest Payments.
 *
 * Framework-agnostic: accepts the raw request body and signature
 * header, verifies the webhook, and dispatches to typed callbacks.
 * Your HTTP framework adapter passes these values in.
 */

import type { PurchaseId } from "@quest-payments/models";

// ── Stripe webhook types (minimal) ────────────────────────────────

interface StripeWebhookEvent {
  id: string;
  type: string;
  data: {
    object: Record<string, unknown>;
  };
}

interface StripeWebhookVerifier {
  constructEvent(payload: string | Buffer, signature: string, secret: string): StripeWebhookEvent;
}

// ── Public API ─────────────────────────────────────────────────────

/** Subset of Stripe events that Quest Payments cares about. */
export type WebhookEvent =
  | { type: "payment_intent.succeeded"; purchaseId: PurchaseId; paymentIntentId: string; amount: number }
  | { type: "payment_intent.payment_failed"; purchaseId: PurchaseId; paymentIntentId: string; error: string }
  | { type: "charge.refunded"; purchaseId: PurchaseId; paymentIntentId: string; amountRefunded: number }
  | { type: "payment_intent.canceled"; purchaseId: PurchaseId; paymentIntentId: string };

export interface WebhookHandlerConfig {
  /** Stripe webhook signing secret (whsec_...). */
  signingSecret: string;
  /** Callback invoked for each parsed Quest-relevant event. */
  onEvent: (event: WebhookEvent) => Promise<void>;
}

export class QuestWebhookHandler {
  constructor(
    private readonly stripeWebhooks: StripeWebhookVerifier,
    private readonly config: WebhookHandlerConfig,
  ) {}

  /**
   * Process a raw webhook request.
   * Call this from your HTTP framework's webhook route handler.
   *
   * @param rawBody  - The raw request body as a string or Buffer.
   * @param signature - The `stripe-signature` header value.
   * @returns true if the event was handled, false if it was ignored (not Quest-relevant).
   */
  async handle(rawBody: string | Buffer, signature: string): Promise<boolean> {
    const event = this.stripeWebhooks.constructEvent(rawBody, signature, this.config.signingSecret);

    const questEvent = this.parseEvent(event);
    if (!questEvent) return false;

    await this.config.onEvent(questEvent);
    return true;
  }

  private parseEvent(event: StripeWebhookEvent): WebhookEvent | null {
    const obj = event.data.object;
    const metadata = (obj.metadata ?? {}) as Record<string, string>;
    const purchaseId = metadata.quest_purchase_id as PurchaseId | undefined;

    // Ignore events not associated with a Quest purchase.
    if (!purchaseId) return null;

    const piId = (obj.id as string) ?? "";

    switch (event.type) {
      case "payment_intent.succeeded":
        return {
          type: "payment_intent.succeeded",
          purchaseId,
          paymentIntentId: piId,
          amount: (obj.amount_received as number) ?? 0,
        };

      case "payment_intent.payment_failed":
        return {
          type: "payment_intent.payment_failed",
          purchaseId,
          paymentIntentId: piId,
          error: ((obj.last_payment_error as Record<string, unknown>)?.message as string) ?? "Unknown error",
        };

      case "charge.refunded":
        return {
          type: "charge.refunded",
          purchaseId,
          paymentIntentId: (obj.payment_intent as string) ?? piId,
          amountRefunded: (obj.amount_refunded as number) ?? 0,
        };

      case "payment_intent.canceled":
        return {
          type: "payment_intent.canceled",
          purchaseId,
          paymentIntentId: piId,
        };

      default:
        return null;
    }
  }
}
