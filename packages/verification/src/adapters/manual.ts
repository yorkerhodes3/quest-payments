import type { Verifier, VerificationResult } from '../verifier.js';

export interface ManualReviewEvidence {
  description: string;
  evidenceUrl?: string;
}

export interface ReviewQueueItem {
  purchaseId: string;
  incentiveType: string;
  evidence: ManualReviewEvidence;
  submittedAt: Date;
}

export type EnqueueFn = (item: ReviewQueueItem) => Promise<void>;

export interface ManualAdapterOptions {
  incentiveType?: string;
  enqueue: EnqueueFn;
}

export class ManualAdapter implements Verifier {
  readonly incentiveType: string;
  private readonly enqueue: EnqueueFn;

  constructor(options: ManualAdapterOptions) {
    this.incentiveType = options.incentiveType ?? 'manual';
    this.enqueue = options.enqueue;
  }

  async verify(purchaseId: string, evidence: unknown): Promise<VerificationResult> {
    const e = evidence as ManualReviewEvidence;

    if (!e?.description || typeof e.description !== 'string') {
      return { status: 'rejected', reason: 'Missing or invalid description' };
    }

    const item: ReviewQueueItem = {
      purchaseId,
      incentiveType: this.incentiveType,
      evidence: {
        description: e.description,
        ...(e.evidenceUrl !== undefined ? { evidenceUrl: e.evidenceUrl } : {}),
      },
      submittedAt: new Date(),
    };

    try {
      await this.enqueue(item);
    } catch {
      return {
        status: 'pending_manual',
        reason: 'Enqueue failed; will retry',
      };
    }

    return {
      status: 'pending_manual',
      reason: 'Submitted for manual review',
      metadata: { queuedAt: item.submittedAt.toISOString() },
    };
  }
}
