import { describe, it, expect, vi } from 'vitest';
import { SocialShareAdapter } from './social-share.js';

function makeFetch(status: number, ok: boolean) {
  return vi.fn().mockResolvedValue({ status, ok } as Response);
}

describe('SocialShareAdapter', () => {
  it('rejects missing evidence', async () => {
    const adapter = new SocialShareAdapter();
    const result = await adapter.verify('p1', null);
    expect(result.status).toBe('rejected');
  });

  it('rejects non-string url', async () => {
    const adapter = new SocialShareAdapter();
    const result = await adapter.verify('p1', { url: 123 });
    expect(result.status).toBe('rejected');
  });

  it('rejects unparseable url', async () => {
    const adapter = new SocialShareAdapter();
    const result = await adapter.verify('p1', { url: 'not a url' });
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/parseable/i);
  });

  it('rejects disallowed platform', async () => {
    const adapter = new SocialShareAdapter();
    const result = await adapter.verify('p1', { url: 'https://example.com/post/1' });
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/allowlist/i);
  });

  it('verifies a reachable Twitter URL', async () => {
    const fetch = makeFetch(200, true);
    const adapter = new SocialShareAdapter({ fetch });
    const result = await adapter.verify('p1', { url: 'https://twitter.com/user/status/1' });
    expect(result.status).toBe('verified');
    expect(result.metadata?.platform).toBe('twitter.com');
  });

  it('verifies a reachable x.com URL', async () => {
    const fetch = makeFetch(200, true);
    const adapter = new SocialShareAdapter({ fetch });
    const result = await adapter.verify('p1', { url: 'https://x.com/user/status/1' });
    expect(result.status).toBe('verified');
  });

  it('strips www. from hostname before platform check', async () => {
    const fetch = makeFetch(200, true);
    const adapter = new SocialShareAdapter({ fetch });
    const result = await adapter.verify('p1', { url: 'https://www.instagram.com/p/abc' });
    expect(result.status).toBe('verified');
    expect(result.metadata?.platform).toBe('instagram.com');
  });

  it('rejects when URL returns non-ok HTTP status', async () => {
    const fetch = makeFetch(404, false);
    const adapter = new SocialShareAdapter({ fetch });
    const result = await adapter.verify('p1', { url: 'https://twitter.com/user/status/1' });
    expect(result.status).toBe('rejected');
    expect(result.reason).toMatch(/404/);
  });

  it('returns pending_manual when fetch throws (network error)', async () => {
    const fetch = vi.fn().mockRejectedValue(new Error('network error'));
    const adapter = new SocialShareAdapter({ fetch });
    const result = await adapter.verify('p1', { url: 'https://twitter.com/user/status/1' });
    expect(result.status).toBe('pending_manual');
  });
});
