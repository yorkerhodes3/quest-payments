import type { Verifier, VerificationResult } from '../verifier.js';

export interface FeedbackEvidence {
  text: string;
  rating: number;
  submittedAt: string; // ISO-8601
}

export interface FeedbackAdapterOptions {
  minLength?: number;    // default 50
  deadline: Date;        // no feedback accepted after this date
}

export class FeedbackAdapter implements Verifier {
  readonly incentiveType = 'feedback';

  private readonly minLength: number;
  private readonly deadline: Date;

  constructor(options: FeedbackAdapterOptions) {
    this.minLength = options.minLength ?? 50;
    this.deadline = options.deadline;
  }

  async verify(_purchaseId: string, evidence: unknown): Promise<VerificationResult> {
    const e = evidence as FeedbackEvidence;

    if (!e?.text || typeof e.text !== 'string') {
      return { status: 'rejected', reason: 'Missing or invalid feedback text' };
    }

    if (e.text.trim().length < this.minLength) {
      return {
        status: 'rejected',
        reason: `Feedback must be at least ${this.minLength} characters`,
      };
    }

    if (typeof e.rating !== 'number' || e.rating < 1 || e.rating > 5) {
      return { status: 'rejected', reason: 'Rating must be between 1 and 5' };
    }

    if (!e.submittedAt) {
      return { status: 'rejected', reason: 'Missing submission timestamp' };
    }

    const submittedAt = new Date(e.submittedAt);
    if (isNaN(submittedAt.getTime())) {
      return { status: 'rejected', reason: 'Invalid submission timestamp' };
    }

    if (submittedAt > this.deadline) {
      return {
        status: 'rejected',
        reason: `Feedback submitted after deadline (${this.deadline.toISOString()})`,
      };
    }

    return {
      status: 'verified',
      reason: 'Feedback accepted',
      metadata: { rating: e.rating, length: e.text.trim().length },
    };
  }
}
