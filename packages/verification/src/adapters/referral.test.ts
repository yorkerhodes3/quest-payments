import { describe, it, expect, vi } from 'vitest';
import { ReferralAdapter } from './referral.js';

describe('ReferralAdapter', () => {
  it('rejects missing evidence', async () => {
    const adapter = new ReferralAdapter({ validatePurchaseExists: async () => true });
    const result = await adapter.verify('p1', null);
    expect(result.status).toBe('rejected');
  });

  it('rejects non-string refereePurchaseId', async () => {
    const adapter = new ReferralAdapter({ validatePurchaseExists: async () => true });
    const result = await adapter.verify('p1', { refereePurchaseId: 99 });
    expect(result.status).toBe('rejected');
  });

  it('rejects self-referral', async () => {
    const adapter = new ReferralAdapter({ validatePurchaseExists: async () => true });
    const result = await adapter.verify('p1', { refereePurchaseId: 'p1' });
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/self-referral/i);
  });

  it('rejects duplicate referee', async () => {
    const validate = vi.fn().mockResolvedValue(true);
    const adapter = new ReferralAdapter({ validatePurchaseExists: validate });
    await adapter.verify('p1', { refereePurchaseId: 'p2' });
    const result = await adapter.verify('p3', { refereePurchaseId: 'p2' });
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/already been used/i);
  });

  it('rejects when referee purchase does not exist', async () => {
    const adapter = new ReferralAdapter({ validatePurchaseExists: async () => false });
    const result = await adapter.verify('p1', { refereePurchaseId: 'p2' });
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/does not exist/i);
  });

  it('verifies valid referral', async () => {
    const adapter = new ReferralAdapter({ validatePurchaseExists: async () => true });
    const result = await adapter.verify('p1', { refereePurchaseId: 'p2' });
    expect(result.status).toBe('verified');
    expect(result.metadata?.refereePurchaseId).toBe('p2');
  });

  it('returns pending_manual when validator throws', async () => {
    const validate = vi.fn().mockRejectedValue(new Error('db error'));
    const adapter = new ReferralAdapter({ validatePurchaseExists: validate });
    const result = await adapter.verify('p1', { refereePurchaseId: 'p2' });
    expect(result.status).toBe('pending_manual');
  });
});
