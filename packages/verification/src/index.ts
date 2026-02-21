/**
 * Incentive verification framework for Quest Payments.
 *
 * Provides a pluggable adapter interface so each incentive type
 * can have its own verification logic. Framework-agnostic -- adapters
 * can be used in any server runtime or testing harness.
 */

export { Verifier, VerificationRequest, VerificationResponse } from "./verifier.js";
export { VerifierRegistry } from "./registry.js";
export { SocialShareVerifier } from "./adapters/social-share.js";
export { CheckInVerifier } from "./adapters/check-in.js";
export { ReferralVerifier } from "./adapters/referral.js";
export { FeedbackVerifier } from "./adapters/feedback.js";
export { ManualVerifier } from "./adapters/manual.js";
