import type { Verifier, VerificationResult } from './verifier.js';

export class VerifierRegistry {
  private readonly adapters = new Map<string, Verifier>();

  register(verifier: Verifier): void {
    this.adapters.set(verifier.incentiveType, verifier);
  }

  async verify(
    incentiveType: string,
    purchaseId: string,
    evidence: unknown,
  ): Promise<VerificationResult> {
    const adapter = this.adapters.get(incentiveType);
    if (!adapter) {
      return {
        status: 'pending_manual',
        reason: `No adapter registered for incentive type "${incentiveType}"`,
      };
    }
    return adapter.verify(purchaseId, evidence);
  }
}
