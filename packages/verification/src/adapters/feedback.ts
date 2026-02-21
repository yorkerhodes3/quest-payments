import type { Verifier, VerificationRequest, VerificationResponse } from "../verifier.js";

/**
 * Proof submitted for post-event feedback.
 */
interface FeedbackProof {
  /** The feedback text submitted by the buyer. */
  feedbackText: string;
  /** Optional numeric rating (1-5). */
  rating?: number;
}

interface FeedbackConfig {
  /** Minimum character count for feedback to be considered valid. */
  minLength?: number;
  /** Maximum allowed time after event end (ISO 8601 duration or milliseconds). */
  submissionWindowMs?: number;
}

export class FeedbackVerifier implements Verifier {
  readonly method = "feedback";

  async verify(req: VerificationRequest): Promise<VerificationResponse> {
    const proof = req.proof as FeedbackProof | null;
    if (!proof?.feedbackText) {
      return { verified: false, earnedBps: 0, reason: "Missing feedbackText in proof", metadata: null };
    }

    const config = req.incentive.verificationConfig as FeedbackConfig;
    const minLength = config.minLength ?? 50;

    // Length gate
    const trimmed = proof.feedbackText.trim();
    if (trimmed.length < minLength) {
      return {
        verified: false,
        earnedBps: 0,
        reason: `Feedback must be at least ${minLength} characters (got ${trimmed.length})`,
        metadata: null,
      };
    }

    // Submission window check
    if (config.submissionWindowMs) {
      const deadline = new Date(req.incentive.expiresAt);
      const submitted = new Date(req.submittedAt);
      if (submitted > deadline) {
        return { verified: false, earnedBps: 0, reason: "Feedback submitted after deadline", metadata: null };
      }
    }

    // Rating bounds check
    if (proof.rating !== undefined && (proof.rating < 1 || proof.rating > 5)) {
      return { verified: false, earnedBps: 0, reason: "Rating must be between 1 and 5", metadata: null };
    }

    return {
      verified: true,
      earnedBps: req.incentive.discountBps,
      reason: null,
      metadata: {
        feedbackLength: trimmed.length,
        rating: proof.rating ?? null,
        verifiedAt: new Date().toISOString(),
      },
    };
  }

  validateConfig?(config: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (config.minLength !== undefined && (typeof config.minLength !== "number" || config.minLength < 1)) {
      errors.push("minLength must be a positive number");
    }
    return errors;
  }
}
