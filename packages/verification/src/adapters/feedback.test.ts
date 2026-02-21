import { describe, it, expect } from 'vitest';
import { FeedbackAdapter } from './feedback.js';

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 86_400_000);

function evidence(overrides: Partial<{ text: string; rating: number; submittedAt: string }> = {}) {
  return {
    text: 'A'.repeat(60),
    rating: 4,
    submittedAt: new Date(Date.now() - 1000).toISOString(),
    ...overrides,
  };
}

describe('FeedbackAdapter', () => {
  it('rejects missing evidence', async () => {
    const adapter = new FeedbackAdapter({ deadline: FUTURE });
    const result = await adapter.verify('p1', null);
    expect(result.status).toBe('rejected');
  });

  it('rejects text that is too short', async () => {
    const adapter = new FeedbackAdapter({ deadline: FUTURE, minLength: 100 });
    const result = await adapter.verify('p1', evidence({ text: 'Short' }));
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/100 characters/i);
  });

  it('uses default minLength of 50', async () => {
    const adapter = new FeedbackAdapter({ deadline: FUTURE });
    const result = await adapter.verify('p1', evidence({ text: 'A'.repeat(49) }));
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/50 characters/i);
  });

  it('rejects rating below 1', async () => {
    const adapter = new FeedbackAdapter({ deadline: FUTURE });
    const result = await adapter.verify('p1', evidence({ rating: 0 }));
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/rating/i);
  });

  it('rejects rating above 5', async () => {
    const adapter = new FeedbackAdapter({ deadline: FUTURE });
    const result = await adapter.verify('p1', evidence({ rating: 6 }));
    expect(result.status).toBe('rejected');
  });

  it('rejects invalid timestamp', async () => {
    const adapter = new FeedbackAdapter({ deadline: FUTURE });
    const result = await adapter.verify('p1', evidence({ submittedAt: 'not-a-date' }));
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/invalid/i);
  });

  it('rejects submission after deadline', async () => {
    const adapter = new FeedbackAdapter({ deadline: PAST });
    const result = await adapter.verify('p1', evidence());
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/deadline/i);
  });

  it('verifies valid feedback', async () => {
    const adapter = new FeedbackAdapter({ deadline: FUTURE });
    const result = await adapter.verify('p1', evidence());
    expect(result.status).toBe('verified');
    expect(result.metadata?.rating).toBe(4);
  });

  it('includes trimmed length in metadata', async () => {
    const adapter = new FeedbackAdapter({ deadline: FUTURE });
    const result = await adapter.verify('p1', evidence({ text: '  ' + 'A'.repeat(60) + '  ' }));
    expect(result.status).toBe('verified');
    expect(result.metadata?.length).toBe(60);
  });
});
