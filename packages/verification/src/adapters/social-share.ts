import type { Verifier, VerificationRequest, VerificationResponse } from "../verifier.js";

/**
 * Expected proof shape for social share verification.
 * The buyer submits the URL of their public post.
 */
interface SocialShareProof {
  /** Full URL to the public social media post. */
  postUrl: string;
  /** Platform hint: "twitter", "linkedin", "instagram", etc. */
  platform: string;
}

/**
 * Expected config on the IncentiveDefinition for social shares.
 */
interface SocialShareConfig {
  /** Substring(s) the post must contain (e.g. event hashtag, event URL). */
  requiredContent?: string[];
  /** Allowed platforms. Empty = any. */
  allowedPlatforms?: string[];
  /** Minimum account age in days to prevent throwaway accounts. */
  minAccountAgeDays?: number;
}

/**
 * Fetch function signature -- injected so the adapter stays runtime-agnostic.
 * In production pass globalThis.fetch; in tests pass a mock.
 */
type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export class SocialShareVerifier implements Verifier {
  readonly method = "social_share";

  constructor(private readonly fetch: FetchFn = globalThis.fetch) {}

  async verify(req: VerificationRequest): Promise<VerificationResponse> {
    const proof = req.proof as SocialShareProof | null;
    if (!proof?.postUrl || !proof?.platform) {
      return { verified: false, earnedBps: 0, reason: "Missing postUrl or platform in proof", metadata: null };
    }

    const config = req.incentive.verificationConfig as SocialShareConfig;

    // Platform allow-list check
    if (config.allowedPlatforms?.length && !config.allowedPlatforms.includes(proof.platform)) {
      return { verified: false, earnedBps: 0, reason: `Platform '${proof.platform}' not allowed`, metadata: null };
    }

    // URL format validation
    let url: URL;
    try {
      url = new URL(proof.postUrl);
    } catch {
      return { verified: false, earnedBps: 0, reason: "Invalid post URL", metadata: null };
    }

    // Platform-specific verification
    // In a real deployment, this calls the platform API (Twitter v2, etc.)
    // to confirm the post exists, is public, and contains required content.
    // For now, we perform a basic reachability check.
    try {
      const res = await this.fetch(proof.postUrl, { method: "HEAD", redirect: "follow" });
      if (!res.ok) {
        return { verified: false, earnedBps: 0, reason: `Post URL returned HTTP ${res.status}`, metadata: null };
      }
    } catch (err) {
      return { verified: false, earnedBps: 0, reason: "Could not reach post URL", metadata: null };
    }

    return {
      verified: true,
      earnedBps: req.incentive.discountBps,
      reason: null,
      metadata: { postUrl: proof.postUrl, platform: proof.platform, verifiedAt: new Date().toISOString() },
    };
  }

  validateConfig?(config: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (config.allowedPlatforms && !Array.isArray(config.allowedPlatforms)) {
      errors.push("allowedPlatforms must be an array of strings");
    }
    return errors;
  }
}
