import type { Verifier, VerificationResult } from '../verifier.js';

const ALLOWED_PLATFORMS = new Set([
  'twitter.com',
  'x.com',
  'instagram.com',
  'facebook.com',
  'linkedin.com',
  'threads.net',
]);

export interface SocialShareEvidence {
  url: string;
}

export interface SocialShareAdapterOptions {
  /** Inject a custom fetch function for testing */
  fetch?: typeof globalThis.fetch;
}

export class SocialShareAdapter implements Verifier {
  readonly incentiveType = 'social_share';

  private readonly fetch: typeof globalThis.fetch;

  constructor(options: SocialShareAdapterOptions = {}) {
    this.fetch = options.fetch ?? globalThis.fetch;
  }

  async verify(_purchaseId: string, evidence: unknown): Promise<VerificationResult> {
    const e = evidence as SocialShareEvidence;

    if (!e?.url || typeof e.url !== 'string') {
      return { status: 'rejected', reason: 'Missing or invalid URL' };
    }

    let parsed: URL;
    try {
      parsed = new URL(e.url);
    } catch {
      return { status: 'rejected', reason: 'URL is not parseable' };
    }

    const hostname = parsed.hostname.replace(/^www\./, '');
    if (!ALLOWED_PLATFORMS.has(hostname)) {
      return {
        status: 'rejected',
        reason: `Platform "${hostname}" is not on the allowlist`,
      };
    }

    try {
      const response = await this.fetch(e.url, { method: 'HEAD' });
      if (!response.ok) {
        return {
          status: 'rejected',
          reason: `URL returned HTTP ${response.status}; post may be private or deleted`,
        };
      }
    } catch {
      // Network errors treated as pending_manual (may be transient)
      return {
        status: 'pending_manual',
        reason: 'Could not reach URL; queued for manual review',
      };
    }

    return {
      status: 'verified',
      reason: 'Public post URL confirmed reachable on allowed platform',
      metadata: { platform: hostname, url: e.url },
    };
  }
}
