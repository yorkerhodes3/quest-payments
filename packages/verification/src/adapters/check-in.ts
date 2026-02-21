import type { Verifier, VerificationRequest, VerificationResponse } from "../verifier.js";

/**
 * Proof submitted by a buyer to verify event check-in.
 */
interface CheckInProof {
  /** Single-use code scanned from QR / tapped via NFC at the venue. */
  checkInCode: string;
}

/**
 * Config on the IncentiveDefinition for check-in verification.
 */
interface CheckInConfig {
  /** The event-level secret used to generate valid check-in codes. */
  eventSecret?: string;
  /** Whether check-in must occur before event start time. */
  requireOnTime?: boolean;
}

/**
 * Callback to validate a check-in code against the event's registry.
 * Injected so the adapter doesn't depend on any specific database.
 * Should return { valid, usedAt } -- valid means the code exists and
 * hasn't been used, usedAt is non-null if already redeemed.
 */
export type CheckInCodeValidator = (
  code: string,
  eventId: string,
) => Promise<{ valid: boolean; alreadyUsed: boolean }>;

export class CheckInVerifier implements Verifier {
  readonly method = "check_in";

  constructor(private readonly validateCode: CheckInCodeValidator) {}

  async verify(req: VerificationRequest): Promise<VerificationResponse> {
    const proof = req.proof as CheckInProof | null;
    if (!proof?.checkInCode) {
      return { verified: false, earnedBps: 0, reason: "Missing checkInCode in proof", metadata: null };
    }

    const config = req.incentive.verificationConfig as CheckInConfig;

    // Check timing if on-time check-in is required
    if (config.requireOnTime) {
      const submittedAt = new Date(req.submittedAt);
      const deadline = new Date(req.incentive.expiresAt);
      if (submittedAt > deadline) {
        return { verified: false, earnedBps: 0, reason: "Check-in submitted after deadline", metadata: null };
      }
    }

    // Validate the code against the event registry
    const result = await this.validateCode(proof.checkInCode, req.incentive.eventId);

    if (result.alreadyUsed) {
      return { verified: false, earnedBps: 0, reason: "Check-in code already used", metadata: null };
    }

    if (!result.valid) {
      return { verified: false, earnedBps: 0, reason: "Invalid check-in code", metadata: null };
    }

    return {
      verified: true,
      earnedBps: req.incentive.discountBps,
      reason: null,
      metadata: { checkInCode: proof.checkInCode, verifiedAt: new Date().toISOString() },
    };
  }
}
