# Payment Strategy Comparison

> Research for Quest Payments — Issue #1

## Overview

Quest Payments requires a settlement strategy that can hold the full ticket price while the buyer completes incentive actions, then capture only the net amount. This document compares four approaches.

---

## Strategy 1: Auth-then-Capture

**Mechanism:** Issue a credit card authorization for the full ticket price at purchase time. The authorization places a hold on the funds but does not move money. Once all incentive windows have closed, capture only the net-of-discounts amount.

### Hold Windows

| Card Network | Typical Auth Window | Max Extension |
|---|---|---|
| Visa | 7 days | 30 days (Visa Checkout) |
| Mastercard | 30 days | 30 days |
| Amex | 7 days | 30 days |
| Discover | 7 days | 30 days |

The 7-day default is the critical constraint. For events where incentive completion windows exceed 7 days (e.g., a referral that must result in a confirmed purchase), re-authorization is required.

### Re-Auth Risk

Re-authorization is not guaranteed to succeed:
- Card may have been closed, replaced, or over-limit
- Customer may dispute the hold before re-auth
- Issuers may decline extended auths on debit cards

**Mitigation:** Set incentive expiry to ≤5 days (safe buffer under 7-day window) or require event-day completion only. Alternatively, fall back to charge-then-refund on re-auth failure.

### Stripe Implementation

```typescript
// Create auth-only PaymentIntent
const intent = await stripe.paymentIntents.create({
  amount: fullAmountCents,
  currency: 'usd',
  capture_method: 'manual',   // key: do NOT auto-capture
  confirm: true,
  payment_method: paymentMethodId,
});

// Later: capture net amount after incentives settle
await stripe.paymentIntents.capture(intent.id, {
  amount_to_capture: netAmountCents,
});
```

### Tradeoffs

| Factor | Assessment |
|---|---|
| User experience | Clean — buyer never sees a real charge |
| Organizer cash flow | Delayed until capture |
| Fee structure | Stripe charges ~2.9% + $0.30 on the *captured* amount |
| Auth expiry risk | High for long incentive windows |
| Chargeback risk | Moderate — hold may confuse cardholders |

**Best for:** Short-window incentive programs (same-day check-in, event-day actions). Not suitable for programs with multi-week incentive windows.

---

## Strategy 2: Charge-then-Refund

**Mechanism:** Charge the full ticket price immediately. As each incentive action is verified, issue a partial refund for the corresponding discount amount. At event end, issue any remaining uncaptured discount as a final refund.

### Fee Analysis

Stripe's refund policy: the processing fee (~2.9% + $0.30) on the original charge is **not** returned when a refund is issued. Only the refund amount itself is returned.

**Example — $100 ticket, 25% total discount earned:**
- Charge: $100, fee ~$3.20, net to organizer: $96.80
- Refund: $25.00, fee recovered: $0 (fee on $25 not returned)
- **Effective cost to organizer for $25 refund: $25.00 + lost portion of ~$0.73 = $25.73**

At scale (1,000 tickets, 25% average discount):
- Lost fees from refunded amounts ≈ $730 per 1,000 tickets

### Chargeback Timing

If a chargeback is filed after a partial refund, the disputed amount is the *net remaining* charge. The partial refund complicates chargeback resolution — processors see the original charge and the subsequent refund, which can flag the transaction as suspicious.

### Tradeoffs

| Factor | Assessment |
|---|---|
| User experience | Charge appears immediately, may confuse buyers |
| Organizer cash flow | Immediate full amount received |
| Fee structure | Non-recoverable processing fees on refunded amounts |
| Auth expiry risk | None |
| Chargeback risk | Moderate — partial refunds can complicate disputes |

**Best for:** Organizers who need immediate cash flow and are willing to absorb ~0.7% higher effective fee cost on discounted amounts.

---

## Strategy 3: Stablecoin Escrow

**Mechanism:** Buyer deposits full ticket price in USDC into a smart contract. The contract holds funds until the incentive window closes, then releases the net amount to the organizer and refunds earned discounts to the buyer.

### Smart Contract Architecture

```solidity
interface IQuestEscrow {
    function deposit(bytes32 purchaseId, uint256 amount) external;
    function applyDiscount(bytes32 purchaseId, uint16 discountBps) external;
    function settle(bytes32 purchaseId) external;
    function refundAll(bytes32 purchaseId) external; // timeout path
}
```

Key properties:
- Discount accumulates in `discountBps` (basis points, max 10,000)
- Only authorized `verifier` address can call `applyDiscount`
- `settle` callable only after incentive window expires or organizer confirms event completion
- `refundAll` callable after timeout (e.g., 90 days if event cancelled)

### Cost Comparison (Base L2)

| Operation | Estimated Gas | Cost at 0.001 gwei base fee |
|---|---|---|
| Deposit | ~65,000 gas | ~$0.001 |
| applyDiscount (per incentive) | ~30,000 gas | <$0.001 |
| Settle | ~55,000 gas | ~$0.001 |
| Total per purchase | ~200,000 gas | <$0.01 |

vs Stripe on $100 ticket: ~$3.20

### User Experience Challenge

Buyers must either:
1. Already hold USDC on Base, or
2. Go through a fiat on-ramp (Coinbase, MoonPay, etc.) — adds 1-2% on-ramp fee and friction

**Mitigation:** Sponsor on-ramp fees from the gas savings or offer a hybrid flow where the organizer accepts card and internally converts to USDC for settlement.

### Tradeoffs

| Factor | Assessment |
|---|---|
| User experience | High friction unless buyer is crypto-native |
| Organizer cash flow | Delayed until settlement |
| Fee structure | <$0.01 total (vs $3+ on cards) |
| Auth expiry risk | None — escrow has no expiry constraint |
| Chargeback risk | None — no card network involved |

**Best for:** Crypto-native event communities or when organizer provides on-ramp. Most cost-efficient at scale.

---

## Strategy 4: Hybrid (Recommended)

**Mechanism:** Charge full price via credit card immediately. After event and incentive completion, issue a stablecoin cashback to the buyer's wallet for earned discounts.

### Flow

1. **Buyer pays** full price by card → organizer receives net of card fees immediately
2. **Quest window** runs (check-in, referral, social share, etc.)
3. **Cashback settlement**: Organizer sends earned discount in USDC to buyer's wallet via x402

### Why This Works

- Organizer retains familiar card processing workflow
- Buyer experience is standard card checkout (no crypto friction at purchase)
- Cashback is a crypto "bonus" — many buyers will find it delightful
- x402 USDC transfer costs <$0.01 regardless of amount
- No re-auth risk (charge is already captured)
- No partial refund fee loss (refund is replaced by a direct USDC transfer)

### Fee Analysis at $100 ticket, 25% discount earned

| Component | Hybrid | Charge-then-Refund |
|---|---|---|
| Card processing | ~$3.20 | ~$3.20 |
| Discount delivery | ~$0.01 (USDC via x402) | $0.73 lost fees |
| **Total cost** | **~$3.21** | **~$3.93** |

Savings: ~$0.72 per discounted ticket. At 1,000 tickets with 25% discount: **~$720 saved**.

### Tradeoffs

| Factor | Assessment |
|---|---|
| User experience | Familiar card checkout + crypto bonus |
| Organizer cash flow | Immediate |
| Fee structure | Near-optimal |
| Complexity | Requires organizer to hold USDC for cashback pool |
| Chargeback risk | Standard card chargeback risk; no partial refund complications |

---

## Recommendation Matrix

| Use Case | Recommended Strategy |
|---|---|
| Same-day / event-day incentives only | Auth-then-Capture |
| Immediate cash flow needed, short incentive window | Charge-then-Refund |
| Crypto-native audience, maximum cost efficiency | Stablecoin Escrow |
| General-purpose, best economics | **Hybrid (card charge + USDC cashback)** |
| Long incentive windows (>7 days) | Hybrid or Charge-then-Refund |

The **Hybrid strategy** is recommended as the default implementation for Quest Payments. It provides the best user experience for mainstream audiences while capturing most of the fee savings of stablecoin settlement.
