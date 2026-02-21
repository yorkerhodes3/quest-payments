import type { Verifier, VerificationResult } from '../verifier.js';

export interface ReferralEvidence {
  refereePurchaseId: string;
}

export type PurchaseExistsValidator = (purchaseId: string) => Promise<boolean>;

export interface ReferralAdapterOptions {
  validatePurchaseExists: PurchaseExistsValidator;
}

export class ReferralAdapter implements Verifier {
  readonly incentiveType = 'referral';

  private readonly validatePurchaseExists: PurchaseExistsValidator;
  /** Track which referee IDs have already been claimed (in-memory dedup). */
  private readonly claimed = new Set<string>();

  constructor(options: ReferralAdapterOptions) {
    this.validatePurchaseExists = options.validatePurchaseExists;
  }

  async verify(purchaseId: string, evidence: unknown): Promise<VerificationResult> {
    const e = evidence as ReferralEvidence;

    if (!e?.refereePurchaseId || typeof e.refereePurchaseId !== 'string') {
      return { status: 'rejected', reason: 'Missing or invalid referee purchase ID' };
    }

    if (e.refereePurchaseId === purchaseId) {
      return { status: 'rejected', reason: 'Self-referral is not allowed' };
    }

    if (this.claimed.has(e.refereePurchaseId)) {
      return {
        status: 'rejected',
        reason: 'This referee purchase ID has already been used for a referral',
      };
    }

    let exists: boolean;
    try {
      exists = await this.validatePurchaseExists(e.refereePurchaseId);
    } catch {
      return {
        status: 'pending_manual',
        reason: 'Could not verify referee purchase; queued for manual review',
      };
    }

    if (!exists) {
      return {
        status: 'rejected',
        reason: 'Referee purchase does not exist or is not in a confirmed state',
      };
    }

    this.claimed.add(e.refereePurchaseId);
    return {
      status: 'verified',
      reason: 'Referee purchase confirmed',
      metadata: { refereePurchaseId: e.refereePurchaseId },
    };
  }
}
