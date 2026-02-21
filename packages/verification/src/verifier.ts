/**
 * Core verifier interface. Every incentive type implements this contract.
 * Framework-agnostic -- no dependency on Express, Hono, or any runtime.
 */

import type {
  IncentiveDefinition,
  IncentiveResult,
  PurchaseId,
} from "@quest-payments/models";

/** Payload submitted by a buyer claiming an incentive. */
export interface VerificationRequest {
  purchaseId: PurchaseId;
  incentive: IncentiveDefinition;
  /** Arbitrary proof data (URL, code, signature, etc.). Shape depends on the adapter. */
  proof: unknown;
  /** ISO-8601 timestamp of submission. */
  submittedAt: string;
}

/** Result returned by a verifier adapter after evaluation. */
export interface VerificationResponse {
  verified: boolean;
  /** Discount basis points awarded (0 if not verified). */
  earnedBps: number;
  /** Human-readable reason when rejected. */
  reason: string | null;
  /** Optional metadata the adapter wants to persist (e.g. attestation UID). */
  metadata: Record<string, unknown> | null;
}

/**
 * Adapter interface that each incentive type must implement.
 *
 * Verifiers are stateless -- they receive all context via the request
 * and return a decision. Persistence is handled by the caller.
 */
export interface Verifier {
  /** Identifier matching IncentiveDefinition.verificationMethod. */
  readonly method: string;

  /**
   * Validate the proof and return a verification decision.
   * Implementations should be idempotent.
   */
  verify(req: VerificationRequest): Promise<VerificationResponse>;

  /**
   * Optional: check whether the adapter can handle a given incentive
   * config before the event goes live (fail-fast on misconfiguration).
   */
  validateConfig?(config: Record<string, unknown>): string[];
}
