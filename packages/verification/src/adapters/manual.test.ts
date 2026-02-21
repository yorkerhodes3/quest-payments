import { describe, it, expect, vi } from 'vitest';
import { ManualAdapter } from './manual.js';

describe('ManualAdapter', () => {
  it('defaults incentiveType to "manual"', () => {
    const adapter = new ManualAdapter({ enqueue: async () => {} });
    expect(adapter.incentiveType).toBe('manual');
  });

  it('uses custom incentiveType when provided', () => {
    const adapter = new ManualAdapter({ incentiveType: 'sponsor_session', enqueue: async () => {} });
    expect(adapter.incentiveType).toBe('sponsor_session');
  });

  it('rejects missing description', async () => {
    const enqueue = vi.fn();
    const adapter = new ManualAdapter({ enqueue });
    const result = await adapter.verify('p1', null);
    expect(result.status).toBe('rejected');
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('rejects non-string description', async () => {
    const enqueue = vi.fn();
    const adapter = new ManualAdapter({ enqueue });
    const result = await adapter.verify('p1', { description: 42 });
    expect(result.status).toBe('rejected');
  });

  it('enqueues and returns pending_manual', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const adapter = new ManualAdapter({ enqueue });
    const result = await adapter.verify('p1', { description: 'Please review my submission' });
    expect(result.status).toBe('pending_manual');
    expect(enqueue).toHaveBeenCalledOnce();
    const item = enqueue.mock.calls[0]![0];
    expect(item.purchaseId).toBe('p1');
    expect(item.evidence.description).toBe('Please review my submission');
    expect(item.submittedAt).toBeInstanceOf(Date);
  });

  it('includes evidenceUrl in queued item when provided', async () => {
    const enqueue = vi.fn().mockResolvedValue(undefined);
    const adapter = new ManualAdapter({ enqueue });
    await adapter.verify('p1', { description: 'check this', evidenceUrl: 'https://example.com/ev' });
    const item = enqueue.mock.calls[0]![0];
    expect(item.evidence.evidenceUrl).toBe('https://example.com/ev');
  });

  it('returns pending_manual with reason when enqueue throws', async () => {
    const enqueue = vi.fn().mockRejectedValue(new Error('queue down'));
    const adapter = new ManualAdapter({ enqueue });
    const result = await adapter.verify('p1', { description: 'review me' });
    expect(result.status).toBe('pending_manual');
    expect(result.reason).toMatch(/retry/i);
  });
});
