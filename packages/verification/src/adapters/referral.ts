import type { Verifier, VerificationRequest, VerificationResponse } from "../verifier.js";

/**
 * Proof submitted for a referral incentive.
 */
interface ReferralProof {
  /** The referral code the referred buyer used at checkout. */
  referralCode: string;
  /** Purchase ID of the referred buyer's completed purchase. */
  referredPurchaseId: string;
}

/**
 * Callback to validate that a referral resulted in a real purchase.
 * Injected so the adapter doesn't depend on any specific database.
 */
export type ReferralValidator = (
  referralCode: string,
  referrerPurchaseId: string,
  referredPurchaseId: string,
) => Promise<{
  valid: boolean;
  /** True if the same referral was already credited. */
  alreadyClaimed: boolean;
  /** True if referrer and referred appear to be the same person. */
  selfReferral: boolean;
}>;

export class ReferralVerifier implements Verifier {
  readonly method = "referral";

  constructor(private readonly validateReferral: ReferralValidator) {}

  async verify(req: VerificationRequest): Promise<VerificationResponse> {
    const proof = req.proof as ReferralProof | null;
    if (!proof?.referralCode || !proof?.referredPurchaseId) {
      return { verified: false, earnedBps: 0, reason: "Missing referralCode or referredPurchaseId", metadata: null };
    }

    const result = await this.validateReferral(
      proof.referralCode,
      req.purchaseId,
      proof.referredPurchaseId,
    );

    if (result.selfReferral) {
      return { verified: false, earnedBps: 0, reason: "Self-referrals are not allowed", metadata: null };
    }

    if (result.alreadyClaimed) {
      return { verified: false, earnedBps: 0, reason: "Referral already claimed", metadata: null };
    }

    if (!result.valid) {
      return { verified: false, earnedBps: 0, reason: "Referral could not be verified", metadata: null };
    }

    return {
      verified: true,
      earnedBps: req.incentive.discountBps,
      reason: null,
      metadata: {
        referralCode: proof.referralCode,
        referredPurchaseId: proof.referredPurchaseId,
        verifiedAt: new Date().toISOString(),
      },
    };
  }
}
