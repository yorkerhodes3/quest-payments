// ─── Branded ID types ────────────────────────────────────────────────────────

declare const _brand: unique symbol;
type Brand<T, B> = T & { readonly [_brand]: B };

export type EventId = Brand<string, 'EventId'>;
export type PurchaseId = Brand<string, 'PurchaseId'>;
export type TicketTierId = Brand<string, 'TicketTierId'>;
export type IncentiveId = Brand<string, 'IncentiveId'>;

export function eventId(s: string): EventId { return s as EventId; }
export function purchaseId(s: string): PurchaseId { return s as PurchaseId; }
export function ticketTierId(s: string): TicketTierId { return s as TicketTierId; }
export function incentiveId(s: string): IncentiveId { return s as IncentiveId; }

// ─── Money ───────────────────────────────────────────────────────────────────

export type Currency = 'USD' | 'USDC';

export interface Money {
  readonly amount: number;  // smallest unit (cents for USD, 6-decimal units for USDC)
  readonly currency: Currency;
}

export function usd(cents: number): Money {
  return { amount: cents, currency: 'USD' };
}

export function usdc(units: number): Money {
  return { amount: units, currency: 'USDC' };
}

// ─── Event & Ticket Tier ─────────────────────────────────────────────────────

export interface TicketTier {
  readonly id: TicketTierId;
  readonly name: string;
  readonly basePrice: Money;
  readonly capacity: number;
  readonly questEnabled: boolean;
}

export interface QuestEvent {
  readonly id: EventId;
  readonly name: string;
  readonly startsAt: Date;
  readonly endsAt: Date;
  readonly tiers: readonly TicketTier[];
  readonly incentives: readonly IncentiveDefinition[];
}

// ─── Incentive ───────────────────────────────────────────────────────────────

export type IncentiveType =
  | 'social_share'
  | 'referral'
  | 'check_in'
  | 'sponsor_session'
  | 'feedback'
  | 'manual';

export interface IncentiveDefinition {
  readonly id: IncentiveId;
  readonly type: IncentiveType;
  readonly discountBps: number;  // basis points, 1–10000
  readonly description: string;
  readonly expiresAt: Date;
}

// ─── Purchase state machine ───────────────────────────────────────────────────
//
//  authorized ──► active ──► settling ──► settled
//       └─────────────────────────────────► cancelled

export type PurchaseState =
  | 'authorized'   // card auth (or USDC deposit) held; quest not yet started
  | 'active'       // quest window open; incentives can be submitted
  | 'settling'     // quest window closed; final amount being calculated
  | 'settled'      // capture/transfer complete; purchase finished
  | 'cancelled';   // auth released / escrow refunded; no charge

export interface IncentiveRecord {
  readonly incentiveId: IncentiveId;
  readonly type: IncentiveType;
  readonly discountBps: number;
  readonly status: 'pending' | 'verified' | 'rejected' | 'pending_manual';
  readonly verifiedAt?: Date;
  readonly evidenceHash?: string;
}

export interface Purchase {
  readonly id: PurchaseId;
  readonly eventId: EventId;
  readonly tierId: TicketTierId;
  readonly buyerEmail: string;
  readonly buyerWallet?: string;  // optional; required for USDC cashback
  readonly basePrice: Money;
  readonly state: PurchaseState;
  readonly incentives: readonly IncentiveRecord[];
  readonly createdAt: Date;
  readonly updatedAt: Date;
  /** Payment provider reference (Stripe PaymentIntent ID or tx hash) */
  readonly paymentRef?: string;
  /** Referral source */
  readonly referredBy?: PurchaseId;
}

// ─── Computed helpers ────────────────────────────────────────────────────────

/** Sum of basis points for all verified incentives (capped at 10000). */
export function totalDiscountBps(purchase: Purchase): number {
  const total = purchase.incentives
    .filter(i => i.status === 'verified')
    .reduce((sum, i) => sum + i.discountBps, 0);
  return Math.min(total, 10_000);
}

/** Net price after applying all verified discounts. */
export function netPrice(purchase: Purchase): Money {
  const bps = totalDiscountBps(purchase);
  const discountAmount = Math.round((purchase.basePrice.amount * bps) / 10_000);
  return {
    amount: purchase.basePrice.amount - discountAmount,
    currency: purchase.basePrice.currency,
  };
}

/** Returns true when every incentive has reached a terminal state. */
export function allIncentivesResolved(purchase: Purchase): boolean {
  return purchase.incentives.every(
    i => i.status === 'verified' || i.status === 'rejected',
  );
}
