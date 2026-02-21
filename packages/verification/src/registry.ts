/**
 * Registry that maps verification method identifiers to adapter instances.
 * Use this to dispatch verification requests to the correct adapter.
 */

import type { Verifier, VerificationRequest, VerificationResponse } from "./verifier.js";

export class VerifierRegistry {
  private adapters = new Map<string, Verifier>();

  /** Register an adapter for a given verification method. */
  register(adapter: Verifier): void {
    if (this.adapters.has(adapter.method)) {
      throw new Error(`Verifier already registered for method: ${adapter.method}`);
    }
    this.adapters.set(adapter.method, adapter);
  }

  /** Look up and invoke the correct adapter for a verification request. */
  async verify(req: VerificationRequest): Promise<VerificationResponse> {
    const adapter = this.adapters.get(req.incentive.verificationMethod);
    if (!adapter) {
      return {
        verified: false,
        earnedBps: 0,
        reason: `No verifier registered for method: ${req.incentive.verificationMethod}`,
        metadata: null,
      };
    }
    return adapter.verify(req);
  }

  /** List all registered verification methods. */
  methods(): string[] {
    return Array.from(this.adapters.keys());
  }

  /** Check if a method has a registered adapter. */
  has(method: string): boolean {
    return this.adapters.has(method);
  }
}
