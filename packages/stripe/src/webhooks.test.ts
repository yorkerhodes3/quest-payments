import { describe, it, expect, vi } from 'vitest';
import { QuestWebhookHandler } from './webhooks.js';
import type { StripeWebhookClient } from './webhooks.js';
import { purchaseId } from '@quest-payments/models';

const pid = purchaseId('pur_abc');

function makeStripeWebhook(eventToReturn: object): StripeWebhookClient {
  return {
    webhooks: {
      constructEvent: vi.fn().mockReturnValue(eventToReturn),
    },
  };
}

function makeHandler(eventToReturn: object, secret = 'whsec_test') {
  const stripe = makeStripeWebhook(eventToReturn);
  const handler = new QuestWebhookHandler({ stripe, webhookSecret: secret });
  return { handler, stripe };
}

describe('QuestWebhookHandler', () => {
  describe('handle', () => {
    it('throws when signature verification fails', () => {
      const stripe: StripeWebhookClient = {
        webhooks: {
          constructEvent: vi.fn().mockImplementation(() => {
            throw new Error('invalid signature');
          }),
        },
      };
      const handler = new QuestWebhookHandler({ stripe, webhookSecret: 'whsec_test' });

      expect(() => handler.handle('body', 'bad-sig')).toThrow(
        'Webhook signature verification failed',
      );
    });

    it('passes raw body, signature, and secret to constructEvent', () => {
      const { handler, stripe } = makeHandler({
        type: 'unknown.event',
        data: { object: {} },
      });

      handler.handle('raw_body', 'stripe-sig-header');

      expect(stripe.webhooks.constructEvent).toHaveBeenCalledWith(
        'raw_body',
        'stripe-sig-header',
        'whsec_test',
      );
    });
  });

  describe('payment_intent.amount_capturable_updated → payment.authorized', () => {
    it('maps to QuestPaymentAuthorized', () => {
      const { handler } = makeHandler({
        type: 'payment_intent.amount_capturable_updated',
        data: {
          object: {
            id: 'pi_auth',
            amount: 5000,
            amount_received: 0,
            metadata: { purchaseId: pid },
          },
        },
      });

      const event = handler.handle('body', 'sig');

      expect(event).toEqual({
        type: 'payment.authorized',
        purchaseId: pid,
        paymentIntentId: 'pi_auth',
        amountCents: 5000,
      });
    });

    it('returns null when purchaseId metadata is missing', () => {
      const { handler } = makeHandler({
        type: 'payment_intent.amount_capturable_updated',
        data: {
          object: { id: 'pi_auth', amount: 5000, amount_received: 0, metadata: {} },
        },
      });

      expect(handler.handle('body', 'sig')).toBeNull();
    });
  });

  describe('payment_intent.succeeded → payment.captured', () => {
    it('maps to QuestPaymentCaptured', () => {
      const { handler } = makeHandler({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_cap',
            amount: 5000,
            amount_received: 4000,
            metadata: { purchaseId: pid },
          },
        },
      });

      const event = handler.handle('body', 'sig');

      expect(event).toEqual({
        type: 'payment.captured',
        purchaseId: pid,
        paymentIntentId: 'pi_cap',
        capturedAmountCents: 4000,
      });
    });

    it('returns null when purchaseId metadata is missing', () => {
      const { handler } = makeHandler({
        type: 'payment_intent.succeeded',
        data: {
          object: { id: 'pi_cap', amount: 5000, amount_received: 5000, metadata: {} },
        },
      });

      expect(handler.handle('body', 'sig')).toBeNull();
    });
  });

  describe('charge.refunded → payment.refunded', () => {
    it('maps to QuestPaymentRefunded', () => {
      const { handler } = makeHandler({
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_refund',
            payment_intent: 'pi_test',
            amount_refunded: 1000,
            metadata: { purchaseId: pid },
          },
        },
      });

      const event = handler.handle('body', 'sig');

      expect(event).toEqual({
        type: 'payment.refunded',
        purchaseId: pid,
        paymentIntentId: 'pi_test',
        refundId: 'ch_refund',
        refundAmountCents: 1000,
      });
    });

    it('returns null when purchaseId metadata is missing', () => {
      const { handler } = makeHandler({
        type: 'charge.refunded',
        data: {
          object: {
            id: 'ch_refund',
            payment_intent: 'pi_test',
            amount_refunded: 1000,
            metadata: {},
          },
        },
      });

      expect(handler.handle('body', 'sig')).toBeNull();
    });
  });

  describe('payment_intent.canceled → payment.cancelled', () => {
    it('maps to QuestPaymentCancelled', () => {
      const { handler } = makeHandler({
        type: 'payment_intent.canceled',
        data: {
          object: {
            id: 'pi_cancel',
            amount: 5000,
            amount_received: 0,
            metadata: { purchaseId: pid },
          },
        },
      });

      const event = handler.handle('body', 'sig');

      expect(event).toEqual({
        type: 'payment.cancelled',
        purchaseId: pid,
        paymentIntentId: 'pi_cancel',
      });
    });

    it('returns null when purchaseId metadata is missing', () => {
      const { handler } = makeHandler({
        type: 'payment_intent.canceled',
        data: {
          object: { id: 'pi_cancel', amount: 5000, amount_received: 0, metadata: {} },
        },
      });

      expect(handler.handle('body', 'sig')).toBeNull();
    });
  });

  describe('payment_intent.payment_failed → payment.failed', () => {
    it('maps to QuestPaymentFailed with error message', () => {
      const { handler } = makeHandler({
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_fail',
            amount: 5000,
            amount_received: 0,
            last_payment_error: { message: 'Card declined' },
            metadata: { purchaseId: pid },
          },
        },
      });

      const event = handler.handle('body', 'sig');

      expect(event).toEqual({
        type: 'payment.failed',
        purchaseId: pid,
        paymentIntentId: 'pi_fail',
        error: 'Card declined',
      });
    });

    it('uses default error message when last_payment_error is absent', () => {
      const { handler } = makeHandler({
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_fail',
            amount: 5000,
            amount_received: 0,
            metadata: { purchaseId: pid },
          },
        },
      });

      const event = handler.handle('body', 'sig');

      expect(event).toEqual(
        expect.objectContaining({ type: 'payment.failed', error: 'Payment failed' }),
      );
    });

    it('returns null when purchaseId metadata is missing', () => {
      const { handler } = makeHandler({
        type: 'payment_intent.payment_failed',
        data: {
          object: { id: 'pi_fail', amount: 5000, amount_received: 0, metadata: {} },
        },
      });

      expect(handler.handle('body', 'sig')).toBeNull();
    });
  });

  describe('unhandled event types', () => {
    it('returns null for unknown event types', () => {
      const { handler } = makeHandler({
        type: 'customer.created',
        data: { object: { id: 'cus_123', metadata: {} } },
      });

      expect(handler.handle('body', 'sig')).toBeNull();
    });
  });
});
