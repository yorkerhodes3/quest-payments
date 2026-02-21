import { describe, it, expect, vi } from 'vitest';
import { CheckInAdapter } from './check-in.js';

describe('CheckInAdapter', () => {
  it('rejects missing evidence', async () => {
    const adapter = new CheckInAdapter(async () => true);
    const result = await adapter.verify('p1', null);
    expect(result.status).toBe('rejected');
  });

  it('rejects non-string code', async () => {
    const adapter = new CheckInAdapter(async () => true);
    const result = await adapter.verify('p1', { code: 42 });
    expect(result.status).toBe('rejected');
  });

  it('rejects invalid code', async () => {
    const validate = vi.fn().mockResolvedValue(false);
    const adapter = new CheckInAdapter(validate);
    const result = await adapter.verify('p1', { code: 'WRONG' });
    expect(result.status).toBe('rejected');
    expect(validate).toHaveBeenCalledWith('p1', 'WRONG');
  });

  it('verifies valid code', async () => {
    const validate = vi.fn().mockResolvedValue(true);
    const adapter = new CheckInAdapter(validate);
    const result = await adapter.verify('p1', { code: 'VALID' });
    expect(result.status).toBe('verified');
  });

  it('returns pending_manual when validator throws', async () => {
    const validate = vi.fn().mockRejectedValue(new Error('db down'));
    const adapter = new CheckInAdapter(validate);
    const result = await adapter.verify('p1', { code: 'VALID' });
    expect(result.status).toBe('pending_manual');
  });
});
