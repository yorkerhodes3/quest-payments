/**
 * Core domain types for Quest Payments.
 *
 * This package is framework-agnostic. It defines the data shapes and
 * state machines used across all other Quest Payments modules.
 */

// ── Identifiers ────────────────────────────────────────────────────

/** Branded string types for type-safe IDs. */
export type EventId = string & { readonly __brand: "EventId" };
export type TicketId = string & { readonly __brand: "TicketId" };
export type IncentiveId = string & { readonly __brand: "IncentiveId" };
export type PurchaseId = string & { readonly __brand: "PurchaseId" };
export type BuyerId = string & { readonly __brand: "BuyerId" };

// ── Money ──────────────────────────────────────────────────────────

/** Monetary amount in the smallest unit (cents for USD, 6-decimal for USDC). */
export interface Money {
  /** Amount in smallest denomination (e.g. 10000 = $100.00 USD). */
  amount: bigint;
  /** ISO 4217 currency code or token symbol. */
  currency: "USD" | "USDC";
  /** Decimal places: 2 for USD, 6 for USDC. */
  decimals: number;
}

export function usd(cents: number): Money {
  return { amount: BigInt(cents), currency: "USD", decimals: 2 };
}

export function usdc(microUnits: bigint): Money {
  return { amount: microUnits, currency: "USDC", decimals: 6 };
}

// ── Events ─────────────────────────────────────────────────────────

export interface QuestEvent {
  id: EventId;
  name: string;
  description: string;
  venue: string;
  startsAt: Date;
  endsAt: Date;
  organizer: string;
  ticketTiers: TicketTier[];
  incentives: IncentiveDefinition[];
}

export interface TicketTier {
  name: string;
  price: Money;
  maxQuantity: number;
  /** Maximum aggregate discount percentage (0-100). */
  maxDiscountPct: number;
}

// ── Incentives ─────────────────────────────────────────────────────

export type IncentiveType =
  | "social_share"
  | "referral"
  | "check_in"
  | "sponsor_session"
  | "feedback"
  | "custom";

export interface IncentiveDefinition {
  id: IncentiveId;
  eventId: EventId;
  type: IncentiveType;
  name: string;
  description: string;
  /** Discount in basis points (500 = 5%). */
  discountBps: number;
  /** Verification method identifier (maps to a verifier adapter). */
  verificationMethod: string;
  /** Arbitrary config consumed by the verifier adapter. */
  verificationConfig: Record<string, unknown>;
  /** Deadline after which this incentive can no longer be claimed. */
  expiresAt: Date;
}

// ── Purchases ──────────────────────────────────────────────────────

export type PurchaseStatus =
  | "authorized"
  | "active"
  | "settling"
  | "settled"
  | "refunded"
  | "expired";

export interface Purchase {
  id: PurchaseId;
  eventId: EventId;
  buyerId: BuyerId;
  tierName: string;
  /** Original ticket price. */
  basePrice: Money;
  /** Current status in the purchase lifecycle. */
  status: PurchaseStatus;
  /** Payment method used on the frontend. */
  paymentMethod: PaymentMethod;
  /** Backend settlement details. */
  settlement: SettlementInfo | null;
  /** Incentive completion records. */
  incentiveResults: IncentiveResult[];
  createdAt: Date;
  settledAt: Date | null;
}

export type PaymentMethodType = "credit_card" | "usdc_direct";

export interface PaymentMethod {
  type: PaymentMethodType;
  /** Stripe PaymentIntent ID, or on-chain tx hash. */
  externalId: string;
}

export interface SettlementInfo {
  /** Chain identifier (e.g. "eip155:8453" for Base). */
  network: string;
  /** USDC amount settled to organizer. */
  amountSettled: Money;
  /** Transaction hash on the settlement chain. */
  txHash: string;
  settledAt: Date;
}

// ── Incentive Results ──────────────────────────────────────────────

export type IncentiveResultStatus =
  | "pending"
  | "submitted"
  | "verifying"
  | "verified"
  | "rejected"
  | "expired";

export interface IncentiveResult {
  incentiveId: IncentiveId;
  purchaseId: PurchaseId;
  status: IncentiveResultStatus;
  /** Discount earned in basis points (0 if not verified). */
  earnedBps: number;
  /** Proof payload submitted by the buyer (type depends on verifier). */
  proof: unknown | null;
  /** Reason for rejection, if applicable. */
  rejectionReason: string | null;
  submittedAt: Date | null;
  resolvedAt: Date | null;
}

// ── Computed helpers ───────────────────────────────────────────────

/** Sum of verified discount basis points for a purchase. */
export function totalDiscountBps(purchase: Purchase): number {
  return purchase.incentiveResults
    .filter((r) => r.status === "verified")
    .reduce((sum, r) => sum + r.earnedBps, 0);
}

/** Calculate net price after verified discounts. */
export function netPrice(purchase: Purchase): Money {
  const bps = totalDiscountBps(purchase);
  const discountFraction = BigInt(bps);
  const net =
    purchase.basePrice.amount -
    (purchase.basePrice.amount * discountFraction) / 10000n;
  return { ...purchase.basePrice, amount: net };
}

/** Whether all incentives for a purchase are in a terminal state. */
export function allIncentivesResolved(purchase: Purchase): boolean {
  return purchase.incentiveResults.every((r) =>
    ["verified", "rejected", "expired"].includes(r.status),
  );
}
