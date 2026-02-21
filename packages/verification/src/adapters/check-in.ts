import type { Verifier, VerificationResult } from '../verifier.js';

export interface CheckInEvidence {
  code: string;
}

export type CodeValidator = (purchaseId: string, code: string) => Promise<boolean>;

export class CheckInAdapter implements Verifier {
  readonly incentiveType = 'check_in';

  constructor(private readonly validateCode: CodeValidator) {}

  async verify(purchaseId: string, evidence: unknown): Promise<VerificationResult> {
    const e = evidence as CheckInEvidence;

    if (!e?.code || typeof e.code !== 'string') {
      return { status: 'rejected', reason: 'Missing or invalid check-in code' };
    }

    let valid: boolean;
    try {
      valid = await this.validateCode(purchaseId, e.code);
    } catch {
      return {
        status: 'pending_manual',
        reason: 'Code validator unavailable; queued for manual review',
      };
    }

    if (!valid) {
      return { status: 'rejected', reason: 'Check-in code is invalid or already used' };
    }

    return { status: 'verified', reason: 'Check-in code accepted' };
  }
}
