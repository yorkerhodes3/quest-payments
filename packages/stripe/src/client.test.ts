import { describe, it, expect, vi } from 'vitest';
import { QuestStripeClient } from './client.js';
import type { StripeClient, StripePaymentIntent, StripeRefund } from './client.js';
import { purchaseId, usd } from '@quest-payments/models';

const MOCK_PI: StripePaymentIntent = {
  id: 'pi_test123',
  status: 'requires_capture',
  amount: 5000,
  amount_received: 0,
  currency: 'usd',
  metadata: { purchaseId: 'pur_abc' },
};

const MOCK_REFUND: StripeRefund = {
  id: 're_test123',
  amount: 1000,
  status: 'succeeded',
  payment_intent: 'pi_test123',
};

function makeStripe(): StripeClient {
  return {
    paymentIntents: {
      create: vi.fn().mockResolvedValue(MOCK_PI),
      capture: vi.fn().mockResolvedValue({ ...MOCK_PI, status: 'succeeded', amount_received: 5000 }),
      cancel: vi.fn().mockResolvedValue({ ...MOCK_PI, status: 'canceled' }),
      retrieve: vi.fn().mockResolvedValue(MOCK_PI),
    },
    refunds: {
      create: vi.fn().mockResolvedValue(MOCK_REFUND),
    },
  };
}

describe('QuestStripeClient', () => {
  const pid = purchaseId('pur_abc');

  describe('authorize', () => {
    it('creates a manual-capture PaymentIntent', async () => {
      const stripe = makeStripe();
      const client = new QuestStripeClient({ stripe });

      const result = await client.authorize({
        purchaseId: pid,
        amount: usd(5000),
        paymentMethodId: 'pm_card_visa',
      });

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'usd',
          capture_method: 'manual',
          confirm: true,
          payment_method: 'pm_card_visa',
          metadata: expect.objectContaining({ strategy: 'auth_then_capture', purchaseId: pid }),
        }),
      );
      expect(result.id).toBe('pi_test123');
    });

    it('uses custom description when provided', async () => {
      const stripe = makeStripe();
      const client = new QuestStripeClient({ stripe });

      await client.authorize({
        purchaseId: pid,
        amount: usd(5000),
        paymentMethodId: 'pm_card_visa',
        description: 'Custom description',
      });

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ description: 'Custom description' }),
      );
    });

    it('uses currency override from constructor', async () => {
      const stripe = makeStripe();
      const client = new QuestStripeClient({ stripe, currency: 'gbp' });

      await client.authorize({
        purchaseId: pid,
        amount: usd(5000),
        paymentMethodId: 'pm_card_visa',
      });

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({ currency: 'gbp' }),
      );
    });
  });

  describe('charge', () => {
    it('creates an automatic-capture PaymentIntent', async () => {
      const stripe = makeStripe();
      const client = new QuestStripeClient({ stripe });

      const result = await client.charge({
        purchaseId: pid,
        amount: usd(5000),
        paymentMethodId: 'pm_card_visa',
      });

      expect(stripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'usd',
          capture_method: 'automatic',
          confirm: true,
          metadata: expect.objectContaining({ strategy: 'charge_then_refund' }),
        }),
      );
      expect(result.id).toBe('pi_test123');
    });
  });

  describe('captureNet', () => {
    it('captures the net-of-discounts amount on an existing authorization', async () => {
      const stripe = makeStripe();
      const client = new QuestStripeClient({ stripe });

      const result = await client.captureNet({
        paymentIntentId: 'pi_test123',
        netAmount: usd(4000),
      });

      expect(stripe.paymentIntents.capture).toHaveBeenCalledWith('pi_test123', {
        amount_to_capture: 4000,
      });
      expect(result.status).toBe('succeeded');
    });
  });

  describe('cancel', () => {
    it('cancels an authorization without charging', async () => {
      const stripe = makeStripe();
      const client = new QuestStripeClient({ stripe });

      const result = await client.cancel('pi_test123');

      expect(stripe.paymentIntents.cancel).toHaveBeenCalledWith('pi_test123');
      expect(result.status).toBe('canceled');
    });
  });

  describe('refund', () => {
    it('issues a partial refund for an incentive discount', async () => {
      const stripe = makeStripe();
      const client = new QuestStripeClient({ stripe });

      const result = await client.refund({
        paymentIntentId: 'pi_test123',
        amount: usd(1000),
        purchaseId: pid,
      });

      expect(stripe.refunds.create).toHaveBeenCalledWith(
        expect.objectContaining({
          payment_intent: 'pi_test123',
          amount: 1000,
          reason: 'requested_by_customer',
          metadata: expect.objectContaining({
            purchaseId: pid,
            type: 'incentive_discount',
          }),
        }),
      );
      expect(result.id).toBe('re_test123');
    });
  });
});
