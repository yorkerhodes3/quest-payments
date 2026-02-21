# Incentive Verification System Design

> Research for Quest Payments — Issue #2

## Overview

Quest Payments requires a reliable, tamper-resistant system to verify that buyers have completed each incentive action before applying discounts. This document designs the verification architecture.

---

## Core Design Principles

1. **Pluggable adapters** — each incentive type has its own verifier implementation behind a common interface
2. **Fail-safe** — unverifiable actions fall back to manual review rather than being silently rejected
3. **Anti-gaming** — each adapter must address the most obvious gaming vectors
4. **Auditable** — every verification decision is logged with reason and evidence hash

---

## Verifier Interface

```typescript
export type VerificationStatus = 'verified' | 'rejected' | 'pending_manual';

export interface VerificationResult {
  status: VerificationStatus;
  reason: string;
  evidenceHash?: string;  // SHA-256 of submitted evidence
  metadata?: Record<string, unknown>;
}

export interface Verifier {
  readonly incentiveType: string;
  verify(purchaseId: string, evidence: unknown): Promise<VerificationResult>;
}
```

The `VerifierRegistry` dispatches to the correct adapter by `incentiveType`:

```typescript
class VerifierRegistry {
  private adapters = new Map<string, Verifier>();
  register(verifier: Verifier): void;
  async verify(incentiveType: string, purchaseId: string, evidence: unknown): Promise<VerificationResult>;
}
```

---

## Adapter Designs

### 1. Social Share Adapter

**Trigger:** Buyer submits a public post URL (Twitter/X, Facebook, Instagram, LinkedIn).

**Verification flow:**
1. Extract platform and post ID from submitted URL
2. Validate URL is on an allowlisted platform domain
3. HTTP GET the URL to confirm it is reachable and public (not 404/403)
4. (Optional) Check OpenGraph tags for event name or hashtag match

**Anti-gaming:**
- Platform allowlist prevents submission of arbitrary URLs
- Reachability check prevents submission of unpublished/deleted posts
- Rate limit: one social share per purchase (no double-dipping across platforms)

**Platform allowlist:** `twitter.com`, `x.com`, `instagram.com`, `facebook.com`, `linkedin.com`, `threads.net`

**Limitations:** The verifier cannot confirm the *content* of a post without a social API integration (requires OAuth tokens per platform). The reachability check is a best-effort proxy. Full verification requires platform API access.

```typescript
interface SocialShareEvidence {
  url: string;
  platform: string;
}
```

---

### 2. Check-in Adapter

**Trigger:** Buyer presents QR code or enters check-in code at the venue.

**Verification flow:**
1. Organizer scans buyer's QR code → generates a short-lived one-time code (OTP)
2. OTP is submitted to the API as evidence
3. Adapter calls the injected `validateCode(code)` function (supplied by organizer system)
4. `validateCode` returns `true` if code is valid and unused, marks it consumed

**Anti-gaming:**
- OTP is single-use (consumed on first verification)
- OTP has TTL of 60 seconds (prevents replay attacks)
- Check-in code is tied to the specific `purchaseId`

**Dependency injection:**
```typescript
interface CheckInEvidence {
  code: string;
}

type CodeValidator = (purchaseId: string, code: string) => Promise<boolean>;

class CheckInAdapter implements Verifier {
  constructor(private readonly validateCode: CodeValidator) {}
}
```

This keeps the adapter framework-agnostic — organizers can implement `CodeValidator` against their own event system.

---

### 3. Referral Adapter

**Trigger:** A referred buyer completes their purchase.

**Verification flow:**
1. Referrer's `purchaseId` is recorded in the referred buyer's purchase as `referredBy`
2. When referred purchase reaches `authorized` state, referral adapter fires
3. Adapter checks the referee `purchaseId` exists and is in a valid state
4. Marks referral as verified for the referrer's purchase

**Anti-gaming:**
- Self-referral check: `referrerId !== refereeId`
- Deduplication: each `purchaseId` can only be used as a referral source once per referrer
- Minimum purchase value: referee must purchase a ticket of equal or greater tier to count
- Circular referral detection: A→B→A referral chain is rejected

```typescript
interface ReferralEvidence {
  refereeePurchaseId: string;
}
```

---

### 4. Feedback Adapter

**Trigger:** Buyer submits a post-event feedback form.

**Verification flow:**
1. Buyer submits feedback text and rating
2. Adapter checks:
   - `feedback.text.length >= minLength` (default: 50 characters)
   - `feedback.submittedAt <= deadline` (default: 48 hours after event end)
   - Rating is in valid range (1–5)
3. Stores feedback and marks incentive verified

**Anti-gaming:**
- Minimum length gate prevents empty/trivial submissions
- Hard deadline prevents retroactive submissions
- Rate limit: one feedback per purchase

```typescript
interface FeedbackEvidence {
  text: string;
  rating: number;
  submittedAt: string; // ISO-8601
}
```

---

### 5. Manual Review Adapter

**Trigger:** Any incentive type that cannot be automatically verified (e.g., sponsor session attendance without a scan system, post-event survey bonus, etc.).

**Verification flow:**
1. Buyer submits evidence (text, photo hash, or external link)
2. Adapter enqueues a review task for a human reviewer
3. Returns `pending_manual` status immediately
4. Reviewer approves or rejects via an admin interface
5. Approval/rejection triggers a webhook that updates the purchase state

```typescript
interface ManualReviewEvidence {
  description: string;
  evidenceUrl?: string;
}

interface ReviewQueueItem {
  purchaseId: string;
  incentiveType: string;
  evidence: ManualReviewEvidence;
  submittedAt: Date;
}
```

---

## On-Chain Attestations (EAS on Base)

For high-value or auditable incentives, verifications can be anchored on-chain using [Ethereum Attestation Service (EAS)](https://attest.org/) on Base.

**Schema example (check-in attestation):**
```
bytes32 purchaseId
address buyer
uint64 checkedInAt
bytes32 eventId
```

**Attestation flow:**
1. Verifier generates an EAS attestation after successful check
2. Attester is the Quest Payments backend wallet (operator key)
3. Attestation UID is stored in `VerificationResult.metadata`
4. Smart contract escrow can read attestations via `IEAS.getAttestation(uid)` before releasing funds

This is optional — it provides an immutable audit trail but adds gas cost (~$0.002 on Base per attestation).

---

## Anti-Gaming Summary

| Incentive | Primary Vector | Mitigation |
|---|---|---|
| Social share | Submit any public URL | Platform allowlist + reachability check |
| Check-in | Replay valid code | OTP with 60s TTL + single-use consumption |
| Referral | Self-referral | `referrerId !== refereeId` check |
| Referral | Circular chain | Graph cycle detection (A→B→A) |
| Feedback | Empty submission | Minimum 50-character gate |
| Feedback | Late submission | Hard deadline (48h post-event) |
| All | Duplicate claims | Per-purchase idempotency on all adapters |

---

## Failure Modes

| Scenario | Handling |
|---|---|
| Social URL unreachable at verification time | Retry 3× with 10s backoff; escalate to manual if all fail |
| Code validator service unavailable | Return `pending_manual`, retry when service recovers |
| Referee purchase in contested state | Hold referral in `pending_manual` until resolved |
| Manual review queue not drained | Incentive window extended by 24h, buyer notified |
