import { describe, it, expect, vi } from 'vitest';
import { VerifierRegistry } from './registry.js';
import type { Verifier, VerificationResult } from './verifier.js';

function makeVerifier(incentiveType: string, result: VerificationResult): Verifier {
  return {
    incentiveType,
    verify: vi.fn().mockResolvedValue(result),
  };
}

describe('VerifierRegistry', () => {
  it('returns pending_manual for unregistered incentive type', async () => {
    const registry = new VerifierRegistry();
    const result = await registry.verify('unknown', 'p1', {});
    expect(result.status).toBe('pending_manual');
    expect(result.reason).toMatch(/no adapter/i);
  });

  it('routes to registered adapter and returns its result', async () => {
    const registry = new VerifierRegistry();
    const verifier = makeVerifier('social_share', {
      status: 'verified',
      reason: 'ok',
    });
    registry.register(verifier);
    const result = await registry.verify('social_share', 'p1', { url: 'https://twitter.com/x' });
    expect(result.status).toBe('verified');
    expect(verifier.verify).toHaveBeenCalledWith('p1', { url: 'https://twitter.com/x' });
  });

  it('overwrites an existing adapter when registering the same type', async () => {
    const registry = new VerifierRegistry();
    const first = makeVerifier('check_in', { status: 'rejected', reason: 'first' });
    const second = makeVerifier('check_in', { status: 'verified', reason: 'second' });
    registry.register(first);
    registry.register(second);
    const result = await registry.verify('check_in', 'p1', { code: 'X' });
    expect(result.reason).toBe('second');
    expect(first.verify).not.toHaveBeenCalled();
  });

  it('supports multiple distinct adapters', async () => {
    const registry = new VerifierRegistry();
    registry.register(makeVerifier('social_share', { status: 'verified', reason: 'a' }));
    registry.register(makeVerifier('referral', { status: 'rejected', reason: 'b' }));

    const r1 = await registry.verify('social_share', 'p1', {});
    const r2 = await registry.verify('referral', 'p2', {});
    expect(r1.reason).toBe('a');
    expect(r2.reason).toBe('b');
  });
});
