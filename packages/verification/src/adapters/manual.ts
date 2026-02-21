import type { Verifier, VerificationRequest, VerificationResponse } from "../verifier.js";

/**
 * Proof for manual verification -- an admin/organizer approves or rejects.
 */
interface ManualProof {
  /** Free-form evidence (text, URLs, screenshots, etc.). */
  evidence: string;
}

/**
 * Callback invoked to record a pending manual review request.
 * The adapter itself does NOT approve -- it queues the request.
 * A separate admin flow calls back with the decision.
 */
export type ManualReviewSubmitter = (
  purchaseId: string,
  incentiveId: string,
  evidence: string,
) => Promise<{ queued: boolean }>;

/**
 * Fallback verifier for incentive types that can't be automated.
 * Queues a manual review request and returns a "pending" result.
 * The caller should set the IncentiveResult status to "verifying"
 * and wait for an admin callback to finalize.
 */
export class ManualVerifier implements Verifier {
  readonly method = "manual";

  constructor(private readonly submitForReview: ManualReviewSubmitter) {}

  async verify(req: VerificationRequest): Promise<VerificationResponse> {
    const proof = req.proof as ManualProof | null;
    if (!proof?.evidence) {
      return { verified: false, earnedBps: 0, reason: "Missing evidence in proof", metadata: null };
    }

    const result = await this.submitForReview(
      req.purchaseId,
      req.incentive.id,
      proof.evidence,
    );

    if (!result.queued) {
      return { verified: false, earnedBps: 0, reason: "Failed to queue manual review", metadata: null };
    }

    // Return not-yet-verified; the admin callback will finalize.
    return {
      verified: false,
      earnedBps: 0,
      reason: "Queued for manual review",
      metadata: { pendingReview: true, queuedAt: new Date().toISOString() },
    };
  }
}
