import type { IncentiveType } from '@quest-payments/models';

export type VerificationStatus = 'verified' | 'rejected' | 'pending_manual';

export interface VerificationResult {
  readonly status: VerificationStatus;
  readonly reason: string;
  readonly evidenceHash?: string;
  readonly metadata?: Record<string, unknown>;
}

export interface Verifier {
  readonly incentiveType: IncentiveType | string;
  verify(purchaseId: string, evidence: unknown): Promise<VerificationResult>;
}
