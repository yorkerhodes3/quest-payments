# Payment Strategy Comparison: Quest Payments

**Project:** Quest Payments -- Incentive-Based Event Ticket Payment Mechanism
**Date:** 2026-02-21
**Status:** Research / Decision Document
**Settlement Layer:** USDC on Base L2 via x402 protocol

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Strategy 1: Auth-then-Capture](#strategy-1-auth-then-capture)
4. [Strategy 2: Charge-then-Refund](#strategy-2-charge-then-refund)
5. [Strategy 3: Stablecoin Escrow (Smart Contract)](#strategy-3-stablecoin-escrow-smart-contract)
6. [Strategy 4: Hybrid -- Immediate Charge + Stablecoin Cashback (Recommended)](#strategy-4-hybrid----immediate-charge--stablecoin-cashback-recommended)
7. [Comparison Matrix](#comparison-matrix)
8. [Recommendation](#recommendation)
9. [Appendix: Stripe API Reference](#appendix-stripe-api-reference)

---

## Executive Summary

Quest Payments allows event ticket buyers to reduce their ticket price by completing verifiable actions -- social shares, referrals, check-ins, early arrivals, and other engagement quests. The core architectural question is: **how do we collect the full ticket price up front while allowing dynamic, post-purchase discounts to be applied as the buyer completes incentives?**

This document evaluates four strategies for handling this payment flow, comparing them across fee efficiency, time constraints, user experience, implementation complexity, regulatory risk, and revenue certainty. The analysis concludes with a recommendation for **Strategy 4 (Hybrid: Immediate Charge + Stablecoin Cashback)** as the primary approach, with **Strategy 3 (Stablecoin Escrow)** as a stretch goal for crypto-native audiences.

---

## Problem Statement

### The Core Tension

A buyer purchases a $100 event ticket. Over the following days or weeks, they complete quests:

| Quest | Discount Earned |
|-------|----------------|
| Share event on Twitter/X | 5% ($5.00) |
| Refer a friend who buys a ticket | 10% ($10.00) |
| Check in at the venue on event day | 5% ($5.00) |
| Arrive in the first hour | 5% ($5.00) |

**Maximum discount: 25% ($25.00). Effective price: $75.00.**

The challenge: the buyer pays at purchase time, but the final effective price is not known until the event concludes. We need a payment mechanism that:

1. **Guarantees revenue capture** -- the organizer gets paid even if the buyer never completes any quests.
2. **Returns earned discounts** -- the buyer receives the value of completed quests.
3. **Minimizes fees** -- processing fees should not eat into margins.
4. **Handles variable timelines** -- the purchase-to-event window may be days, weeks, or months.
5. **Provides good UX** -- the buyer should not see confusing pending charges, double authorizations, or delayed refunds.

### Timeline Assumptions

- **Short window:** Purchase 1-3 days before event (all quests resolve within auth hold window).
- **Medium window:** Purchase 1-4 weeks before event (exceeds auth hold on most card networks).
- **Long window:** Purchase 1-3 months before event (far exceeds any auth hold).

The system must handle all three scenarios.

---

## Strategy 1: Auth-then-Capture

### How It Works

1. At purchase time, place an **authorization hold** on the buyer's card for the full ticket price ($100).
2. The buyer completes quests over the following days.
3. When all quest windows close (or at a defined cutoff), **capture only the net amount** ($75 if 25% discount earned).
4. The remaining $25 authorization is released back to the buyer's available credit.

### Authorization Hold Windows by Card Network

Authorization holds are not indefinite. Each card network defines a maximum window after which the auth expires and the held funds are released:

| Card Network | Online Transactions | Card-Present | Notes |
|-------------|-------------------|--------------|-------|
| **Visa** | 7 days | 7 days | Visa requires capture within 7 days for all channels. After 7 days the auth expires and a new authorization is required. |
| **Mastercard** | 7 days | 7 days | Same 7-day window. Mastercard also enforces that the captured amount must not exceed the authorized amount. |
| **American Express** | 7 days | 7 days | Amex generally aligns with the 7-day standard for e-commerce. Some merchant category codes have extended windows (up to 30 days for hotels/car rentals). Event tickets do not qualify for extended holds. |
| **Discover** | 7 days (online) | 10 days (card-present) | Discover allows slightly longer holds for card-present but aligns with 7 days for card-not-present (online). |

**Critical constraint: the effective maximum auth hold window for online event ticket sales is 7 days across all major networks.**

### What Happens When an Auth Expires

When an authorization hold expires without capture:

1. **The held funds are released** back to the buyer's available credit/balance. This typically takes 1-3 business days to reflect on the buyer's statement, though some issuers release immediately.
2. **The merchant cannot capture** -- attempting to capture an expired auth will fail with a decline.
3. **Re-authorization is required** -- the merchant must create a new PaymentIntent and re-authorize the card. This requires either:
   - Silently charging in the background using a saved payment method (via Stripe's `off_session` parameter), which may trigger 3D Secure challenges or soft declines, OR
   - Contacting the buyer to re-authorize, which creates friction and dropout risk.
4. **Double pending charges** -- if re-authorization occurs before the original hold fully drops off the buyer's statement, the buyer sees **two** pending charges for the full amount. This is a top driver of support tickets and chargebacks.

### Misuse Fees from Card Networks

Card networks penalize merchants who systematically create authorizations without capturing them. This is designed to prevent merchants from using auth holds as a way to "reserve" buyer funds without transacting:

- **Visa:** The Authorization Misuse Fee applies when a merchant's auth-to-capture ratio falls below Visa's threshold. As of recent network updates, Visa monitors the percentage of authorizations that result in a capture within the permitted window. Merchants with high void/expiry rates may incur fees of **$0.05-$0.10 per uncaptured auth** (exact amounts vary by acquiring bank agreement).
- **Mastercard:** Similar monitoring under their Authorization Performance Standards. Mastercard tracks the "final auth" ratio and may levy assessments on merchants with excessive uncaptured authorizations.
- **Impact for Quest Payments:** If the typical flow involves authorizing $100 and capturing $75, the $25 difference is a partial capture -- this is generally fine. But if a significant percentage of authorizations expire entirely (e.g., because the event is more than 7 days out and re-auth fails), the merchant's auth-to-capture ratio deteriorates, and network fees apply.

### When This Strategy Works

Auth-then-capture is viable when **all incentives resolve within 7 days of purchase**:

- **Day-of purchases:** Buyer purchases a ticket on the morning of the event, completes check-in and early arrival quests that same day. Capture happens that evening. Auth hold was active for <24 hours.
- **Week-of purchases:** Buyer purchases on Monday for a Saturday event. Social share and referral quests resolve by Thursday. Capture on Friday. Auth hold was active for 4-5 days.
- **Pre-event-only incentives:** If all quests are designed to resolve before the event (no day-of quests like check-in), and the purchase-to-quest-deadline window is under 7 days.

### When This Strategy Fails

- **Purchase more than 7 days before event:** The auth will expire before quests can resolve. This is the common case for most events.
- **Day-of quests with early purchase:** If check-in or early arrival quests exist and the buyer purchased more than 7 days ago, the auth has already expired by event day.
- **Multi-week referral campaigns:** A referral quest that rewards buyers for bringing friends over a 2-4 week campaign window cannot fit within a 7-day auth hold.

### Stripe Implementation

```javascript
// Step 1: Create PaymentIntent with manual capture
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000, // $100.00 in cents
  currency: 'usd',
  capture_method: 'manual', // Auth only, do not capture yet
  payment_method: paymentMethodId,
  customer: customerId,
  confirm: true,
  metadata: {
    ticket_id: 'tkt_abc123',
    event_id: 'evt_def456',
    quest_window_closes: '2026-02-28T23:59:59Z',
  },
});
// paymentIntent.status === 'requires_capture'

// Step 2: When quests resolve, capture the net amount
const captured = await stripe.paymentIntents.capture(
  paymentIntent.id,
  {
    amount_to_capture: 7500, // $75.00 -- full price minus earned discounts
  }
);
// The remaining $25.00 auth hold is released automatically

// Step 3: If auth expired, you must re-authorize
// This will create a NEW PaymentIntent and charge off_session
const reauth = await stripe.paymentIntents.create({
  amount: 7500, // Capture only the net amount this time
  currency: 'usd',
  customer: customerId,
  payment_method: savedPaymentMethodId,
  off_session: true,
  confirm: true,
});
```

**Key Stripe constraints:**
- `amount_to_capture` must be less than or equal to the original authorized amount.
- Stripe recommends capturing within 7 days. After 7 days, the PaymentIntent is automatically canceled and the auth is voided.
- Stripe does not charge a processing fee on the uncaptured portion of a partial capture (fees are calculated on the captured amount only).

### Verdict

**Suitable only for short-window events (purchase-to-resolution under 7 days).** For the general Quest Payments use case where events may be weeks or months away, auth-then-capture is not viable as the sole strategy.

---

## Strategy 2: Charge-then-Refund

### How It Works

1. At purchase time, **charge the full ticket price** ($100) immediately.
2. The buyer completes quests over the following days/weeks/months.
3. As each quest is verified, issue a **partial refund** for the earned discount.
4. Alternatively, wait until all quest windows close and issue a single refund for the total earned discount.

### Processing Fee Analysis

This is the critical issue with the charge-then-refund approach. Stripe's refund fee policy has changed over the years and must be understood precisely.

#### Stripe's Current Refund Fee Policy

**As of Stripe's current pricing (2024-2025 era and forward):**

Stripe's standard processing fee is **2.9% + $0.30** per successful charge (for US domestic cards). When a refund is issued:

- **Stripe does NOT refund the original processing fee.** The fee paid on the original charge is retained by Stripe regardless of whether a full or partial refund is issued.
- This is a change from Stripe's earlier policy. Prior to September 2017, Stripe refunded the full processing fee on refunds. From September 2017 onward, **Stripe retains the processing fee on refunded transactions.**

**Important clarification:** Stripe's documentation has language that can be misleading. Their refund docs state that "there are no fees to refund a charge" -- this means Stripe does not charge an *additional* fee to process the refund itself. However, the original processing fee from the initial charge is **not returned**.

Reference: [Stripe Refund Documentation](https://stripe.com/docs/refunds) -- "When you refund a charge, the fees from the original charge are not returned."

#### Fee Impact Example

**Scenario:** $100 ticket, buyer earns 25% discount ($25 refund).

| Step | Amount | Stripe Fee | Net |
|------|--------|-----------|-----|
| Original charge | $100.00 | $3.20 (2.9% + $0.30) | - |
| Partial refund issued | -$25.00 | $0.00 (no additional fee) | - |
| **Organizer receives** | $75.00 - $3.20 = **$71.80** | | |
| **Effective fee rate on $75** | $3.20 / $75.00 = **4.27%** | | |

Compare to a world where the buyer simply paid $75 upfront:

| Step | Amount | Stripe Fee | Net |
|------|--------|-----------|-----|
| Direct $75 charge | $75.00 | $2.48 (2.9% + $0.30) | $72.52 |
| **Fee rate** | | **3.30%** | |

**Fee loss from the refund approach: $3.20 - $2.48 = $0.72 per ticket.**

At scale, this adds up:

| Tickets Sold | Avg Refund | Total Fee Loss vs. Direct Charge |
|-------------|-----------|--------------------------------|
| 1,000 | $25/ticket | $720 |
| 10,000 | $25/ticket | $7,200 |
| 100,000 | $25/ticket | $72,000 |

The fee loss is driven by: (a) the percentage-based fee on the refunded amount ($25 x 2.9% = $0.725) plus (b) the fixed $0.30 which is calculated on the full charge regardless. In practice, the fixed $0.30 is the dominant factor for small refund amounts.

#### Multiple Partial Refunds (Per-Quest Refunds)

If refunds are issued incrementally as each quest completes (rather than as a single batch refund), the fee impact is the same -- Stripe does not charge additional fees per refund, and the original processing fee remains unreturned regardless of whether one refund or five refunds are issued for the same charge.

However, issuing many small refunds has **operational downsides:**
- Each refund generates a separate line item on the buyer's credit card statement, which can be confusing.
- Stripe's refund limit is 10 refunds per PaymentIntent. If there are more than 10 quests, this becomes a hard blocker.
- Each refund takes 5-10 business days to appear on the customer's statement, depending on the issuing bank.

### Refund Timing

- **Stripe processes refunds immediately** on their end (the refund object is created and the amount is deducted from the merchant's Stripe balance).
- **Customer visibility:** Refunds take **5-10 business days** to appear on the customer's credit card statement. Some banks may take longer.
- **Customer perception:** During this window, the customer has been charged the full amount and sees no refund yet. This creates support inquiries ("I completed the quest but I haven't received my discount").

### Chargeback Risk

Charge-then-refund carries elevated chargeback risk:

1. **Timing gap:** The buyer sees a $100 charge immediately but may not see their $25 refund for 5-10 days. If the buyer contacts their bank during this window, they may initiate a dispute.
2. **Misunderstanding:** The buyer may not understand that discounts are post-purchase. If their expectation is "I shared on Twitter, my ticket should be $95," seeing a $100 charge triggers a "this is wrong" reaction.
3. **Chargeback costs:** If a dispute is filed, Stripe charges a **$15 dispute fee** (regardless of outcome). Even if the merchant wins the dispute, the fee is not returned. In the US, chargeback rates above 0.75% trigger monitoring programs (Visa) or 1.0% (Mastercard) with escalating penalties.

### Industry Precedent

Charge-then-refund is the **industry standard** for event ticket adjustments:

- **Ticketmaster:** Charges full price at purchase, issues refunds for event cancellations or price adjustments.
- **Eventbrite:** Same model -- full charge, refunds processed post-event for applicable credits.
- **StubHub:** Full charge at transaction time with refund processing for guarantee claims.

The reason it is the standard: **it is the simplest to implement and guarantees revenue capture.** The fee inefficiency is accepted as a cost of doing business.

### Stripe Implementation

```javascript
// Step 1: Charge full amount at purchase
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000, // $100.00
  currency: 'usd',
  payment_method: paymentMethodId,
  customer: customerId,
  confirm: true,
  metadata: {
    ticket_id: 'tkt_abc123',
    event_id: 'evt_def456',
  },
});
// paymentIntent.status === 'succeeded'

// Step 2a: Issue partial refund as each quest completes
const refund = await stripe.refunds.create({
  payment_intent: paymentIntent.id,
  amount: 500, // $5.00 for completing the Twitter share quest
  metadata: {
    quest_id: 'quest_twitter_share',
    ticket_id: 'tkt_abc123',
  },
});

// Step 2b: Or issue a single refund after all quests resolve
const batchRefund = await stripe.refunds.create({
  payment_intent: paymentIntent.id,
  amount: 2500, // $25.00 total earned across all quests
  metadata: {
    quests_completed: 'twitter_share,referral,checkin,early_arrival',
    ticket_id: 'tkt_abc123',
  },
});
```

**Stripe constraints:**
- Maximum 10 refunds per PaymentIntent.
- Refunds must be issued within 180 days of the original charge (Stripe-imposed limit, not card network).
- Total refunded amount cannot exceed original charge.
- Refunds deducted from merchant's next payout (or create a negative balance if insufficient funds).

### Verdict

**Reliable and simple, but fee-inefficient.** Suitable as a fallback or for low-discount-rate scenarios where the fee loss is tolerable. Not ideal when discounts are large or ticket volumes are high.

---

## Strategy 3: Stablecoin Escrow (Smart Contract)

### How It Works

1. The buyer deposits the full ticket price as **USDC** into a purpose-built **escrow smart contract** on Base L2.
2. The contract holds the funds until the quest resolution window closes.
3. An authorized oracle or backend service reports quest completion status to the contract.
4. Upon resolution, the contract releases:
   - **Net amount** (ticket price minus earned discounts) to the event organizer's address.
   - **Earned discount** back to the buyer's address.
5. If the quest window closes without any quest completions, the full amount goes to the organizer.

### Transaction Costs on Base L2

Base (Coinbase's L2, built on the OP Stack) offers dramatically lower transaction costs than Ethereum mainnet:

| Operation | Estimated Gas (Base L2) | Estimated Cost (USD) |
|-----------|------------------------|---------------------|
| USDC approval (ERC-20 approve) | ~46,000 gas | $0.001 - $0.01 |
| Deposit to escrow contract | ~65,000 gas | $0.002 - $0.02 |
| Release from escrow (organizer payout) | ~55,000 gas | $0.001 - $0.01 |
| Refund to buyer (discount payout) | ~55,000 gas | $0.001 - $0.01 |
| **Total round-trip** | ~221,000 gas | **$0.005 - $0.05** |

Compare to Stripe's fee on a $100 transaction: **$3.20**. The stablecoin escrow approach is roughly **60-600x cheaper** in processing fees.

### User Acquisition Paths

The escrow approach requires the buyer to transact in USDC, which introduces two user paths:

#### Path A: Crypto-Native User

The buyer already has a wallet with USDC on Base. They connect their wallet, approve the USDC spend, and deposit into the escrow contract. This is seamless for crypto-native users but limits the addressable market.

#### Path B: Fiat On-Ramp

The buyer pays with a credit card or bank transfer. A fiat-to-crypto on-ramp service (e.g., Coinbase Onramp, MoonPay, Transak, or Stripe's own fiat-to-crypto rails) converts the payment to USDC on Base before depositing into the escrow contract.

**On-ramp fees and considerations:**

| Provider | Fee Structure | Settlement Time |
|----------|--------------|----------------|
| Coinbase Onramp | 1-3% spread + network fees | Near-instant (for Coinbase users) |
| MoonPay | 3.5% card / 1% bank transfer | Minutes to hours |
| Transak | 1-5% depending on method | Minutes to hours |
| Stripe Crypto Onramp | Varies; integrated with Stripe | Near-instant |

The on-ramp fee partially or fully negates the gas savings advantage compared to a direct Stripe card charge. For this approach to be fee-efficient, the on-ramp must be low-cost (bank transfer) or the buyer must already hold USDC.

### Smart Contract Architecture

```solidity
// Simplified escrow contract interface
interface IQuestEscrow {
    // Buyer deposits USDC for a specific ticket
    function deposit(
        bytes32 ticketId,
        uint256 amount,
        address organizer,
        uint256 questDeadline
    ) external;

    // Oracle/backend resolves quests and triggers payout
    function resolve(
        bytes32 ticketId,
        uint256 discountAmount // Amount to return to buyer
    ) external onlyOracle;

    // If deadline passes without resolution, organizer can claim full amount
    function claimExpired(bytes32 ticketId) external;

    // Emergency withdrawal by admin (timelocked)
    function emergencyWithdraw(bytes32 ticketId) external onlyAdmin;
}
```

### Smart Contract Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| **Contract bugs** | Critical | Professional audit ($30k-$150k depending on complexity), extensive test coverage, formal verification for core logic |
| **Oracle manipulation** | High | Multi-sig oracle, on-chain verification where possible (e.g., checking referral ticket purchases on-chain), timelock on resolutions |
| **Regulatory classification** | High | Holding user funds in escrow may constitute money transmission in certain jurisdictions. Legal counsel required. State-by-state analysis for US operations. |
| **Key management** | High | Oracle/admin keys must be secured via multi-sig (e.g., Safe/Gnosis). Single-key compromise could drain all escrowed funds. |
| **Upgradeability risk** | Medium | If using upgradeable proxy pattern, admin could theoretically change contract logic. Use timelocked upgrades with governance. |
| **USDC depegging** | Low | USDC is the most regulated US stablecoin (Circle) and has maintained peg except briefly during SVB crisis (March 2023). Risk is low but nonzero. |

### UX Considerations

For non-crypto-native users, the escrow flow introduces significant UX friction:

1. **Wallet connection:** User must have or create a wallet (MetaMask, Coinbase Wallet, etc.). This is a major drop-off point. Embedded wallets (Privy, Dynamic, Thirdweb) can reduce this friction by creating a wallet behind the scenes.
2. **Transaction signing:** Each on-chain action requires a signature. Minimum two signatures: approve USDC spend + deposit. Account abstraction (ERC-4337) or session keys can batch these.
3. **Gas fees:** Even sub-cent gas must be paid in ETH on Base. Solutions:
   - **Gas sponsorship** via Paymaster contracts (ERC-4337): the platform pays gas on behalf of the user.
   - **USDC gas payment** using Paymaster that accepts ERC-20 tokens.
4. **Confirmation latency:** Base L2 blocks are ~2 seconds. Users accustomed to instant card charges may perceive a slight delay, though it is faster than most card authorization flows.

### Advantages

- **Most fee-efficient:** Sub-cent transaction costs versus $3+ on Stripe.
- **Fully programmable:** Discount logic lives on-chain, is transparent, auditable, and tamper-proof.
- **No intermediary risk:** Funds are held by code, not by a payment processor that could freeze the merchant account.
- **Composable:** Escrow contract can integrate with other DeFi primitives (e.g., earn yield on escrowed USDC via Aave/Compound while waiting for quest resolution -- though this introduces additional risk).
- **Global:** USDC on Base is borderless. No need for merchant accounts in each country.

### Verdict

**Most cost-efficient and technically elegant, but highest UX barrier and regulatory complexity.** Best suited for crypto-native audiences or as a future state after embedded wallet adoption matures. Not recommended as the primary payment strategy for a general consumer audience today.

---

## Strategy 4: Hybrid -- Immediate Charge + Stablecoin Cashback (Recommended)

### How It Works

1. **Purchase:** Buyer pays full ticket price ($100) via standard credit card checkout (Stripe).
2. **Backend settlement:** Platform converts collected funds to USDC on Base via Stripe's stablecoin infrastructure (Bridge, acquired by Stripe in 2024) or a separate on-ramp.
3. **Quest completion:** As the buyer completes quests, earned discounts accrue in the backend.
4. **Cashback distribution:** When the quest window closes (or at event conclusion), earned discounts are distributed as **USDC cashback** to the buyer's wallet on Base.
5. **Wallet provisioning:** If the buyer does not have a wallet, an embedded/custodial wallet is created for them (via Privy, Dynamic, Coinbase Smart Wallet, or similar) and the USDC is deposited there. The buyer can later claim/withdraw.

### Why This Approach Avoids Key Problems

| Problem | How Hybrid Solves It |
|---------|---------------------|
| **Auth expiry** (Strategy 1) | Not applicable -- full charge is captured immediately. No authorization hold. |
| **Refund fee loss** (Strategy 2) | No refund is issued. The original Stripe charge stands. Discounts are paid out separately as USDC on Base, where transaction costs are sub-cent. |
| **Crypto UX barrier** (Strategy 3) | The purchase experience is a standard credit card flow. Crypto only enters the picture for the cashback, which is a "bonus" UX moment, not a purchase-blocking friction point. |
| **Time constraints** | None. The card charge happens day 1. Cashback can be distributed days, weeks, or months later with no fee penalty or auth expiry. |

### Fee Analysis

**Scenario:** $100 ticket, buyer earns 25% discount ($25 cashback).

| Component | Cost |
|-----------|------|
| Stripe processing fee on $100 charge | $3.20 (2.9% + $0.30) |
| USDC cashback transfer on Base L2 | ~$0.01 |
| On-ramp cost (Stripe balance to USDC) | ~$0.25 - $1.00 (depends on method) |
| **Total cost** | **$3.46 - $4.21** |

Compare to Strategy 2 (Charge-then-Refund):

| Component | Cost |
|-----------|------|
| Stripe processing fee on $100 charge | $3.20 |
| Refund fee loss | $0.00 additional fee, but original $3.20 is not returned |
| **Effective cost** | **$3.20** (but fee rate on net revenue is 4.27% vs. 3.20%) |

**The hybrid approach costs slightly more in absolute terms** (due to the on-ramp fee for converting to USDC) **but avoids the effective fee rate inflation** that occurs when refunds are issued. More importantly, it provides a superior user experience and opens up the stablecoin settlement rail.

**At scale, the on-ramp cost can be minimized:**
- Stripe's Bridge integration allows direct conversion of Stripe balance to USDC, which may carry lower fees than retail on-ramp rates.
- Batching: Multiple cashback distributions can be batched into a single on-ramp conversion, amortizing fixed costs.
- If the platform accumulates USDC reserves from ticket sales (because the organizer is settled in USDC via x402), the cashback can be paid from existing USDC liquidity with no on-ramp needed.

### On-Ramp Flow: Stripe to USDC on Base

```
Buyer's Credit Card
    |
    v
[Stripe Charge] -- $100.00 captured
    |
    v
Stripe Balance (USD)
    |
    v
[Stripe Stablecoin Financial Account (Bridge)]
    |
    v
USDC on Base L2 (Platform Treasury Wallet)
    |
    v
[x402 Protocol Settlement] -- $75.00 USDC to Organizer
    |
    v
[Quest Cashback Distribution] -- $25.00 USDC to Buyer Wallet
```

### x402 Protocol Integration

The x402 protocol provides HTTP-native payment settlement for machine-to-machine and service-to-service interactions. In Quest Payments, x402 is used for:

1. **Organizer settlement:** The platform settles the net ticket revenue (full price minus platform fee) to the organizer as USDC via x402-facilitated transfers on Base.
2. **Service payments:** Backend services that verify quest completion (e.g., social media API checks, geolocation verification for check-ins) can be paid per-call via x402 micropayments.
3. **Cashback distribution:** The x402 protocol can facilitate the USDC transfer from the platform treasury to the buyer's wallet as a standardized payment flow.

### Wallet Provisioning for Non-Crypto Users

The cashback experience must be frictionless for users who have never interacted with crypto:

| Approach | UX | Custody | Trade-offs |
|----------|-----|---------|-----------|
| **Embedded wallet (Privy/Dynamic)** | User signs up with email/social. Wallet created silently. USDC appears in an in-app balance. | Non-custodial (key shards distributed) or semi-custodial | Best UX. User does not need to understand wallets. Can withdraw to external wallet later. |
| **Coinbase Smart Wallet** | Passkey-based wallet creation. No seed phrase. | Non-custodial (passkey-secured) | Excellent UX for Coinbase ecosystem. May limit to Coinbase-supported chains. |
| **Custodial balance** | USDC held on behalf of user in platform's omnibus wallet. User sees a "balance" in the app. | Custodial (platform holds keys) | Simplest UX but highest regulatory burden (money transmitter license likely required). |
| **Self-custody (MetaMask, etc.)** | User provides their own wallet address. | Non-custodial | Best for crypto-native users. High friction for general audience. |

**Recommended approach:** Embedded wallet via Privy or Dynamic, with an option for users to connect an existing wallet. This balances UX with regulatory considerations (non-custodial key management avoids MSB classification in most interpretations, though legal counsel should confirm).

### User Experience Flow

```
1. PURCHASE (Standard)
   - Buyer selects ticket, enters credit card, pays $100
   - Confirmation: "Your ticket is confirmed! Complete quests to earn up to $25 in USDC cashback."

2. QUEST COMPLETION (Gamified)
   - Buyer shares on Twitter/X -> "Quest complete! $5.00 USDC earned."
   - Buyer refers a friend -> "Quest complete! $10.00 USDC earned."
   - Progress bar: "$15.00 / $25.00 earned"

3. EVENT DAY
   - Buyer checks in at venue -> "Quest complete! $5.00 USDC earned."
   - Buyer arrives in first hour -> "Quest complete! $5.00 USDC earned."
   - "All quests complete! $25.00 USDC cashback will be sent to your wallet."

4. CASHBACK DISTRIBUTION (Post-Event)
   - USDC deposited to buyer's embedded wallet
   - Notification: "You've received $25.00 USDC! View in your wallet."
   - Buyer can hold, spend, or withdraw the USDC
```

**Key UX insight:** Framing the discount as "cashback earned" rather than "refund pending" transforms the experience from a **negative** (waiting for money back) to a **positive** (earning a reward). This is the same psychological framing that makes credit card cashback programs successful.

### Implementation Architecture

```javascript
// Step 1: Standard Stripe charge at purchase
const paymentIntent = await stripe.paymentIntents.create({
  amount: 10000,
  currency: 'usd',
  payment_method: paymentMethodId,
  customer: customerId,
  confirm: true,
  metadata: {
    ticket_id: 'tkt_abc123',
    event_id: 'evt_def456',
    max_cashback: '2500', // $25.00 max discount
  },
});

// Step 2: Track quest completions in backend
// (triggered by webhooks from social APIs, geolocation, etc.)
await db.questCompletions.create({
  ticketId: 'tkt_abc123',
  questId: 'quest_twitter_share',
  discountCents: 500,
  verifiedAt: new Date(),
  proofHash: '0xabc...', // Optional: on-chain attestation
});

// Step 3: After quest window closes, calculate total cashback
const completions = await db.questCompletions.findAll({
  ticketId: 'tkt_abc123',
});
const totalCashbackCents = completions.reduce(
  (sum, c) => sum + c.discountCents, 0
);
// totalCashbackCents = 2500 ($25.00)

// Step 4: Distribute USDC cashback on Base
// Using ethers.js or viem
const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, signer);
const cashbackAmount = ethers.parseUnits('25.00', 6); // USDC has 6 decimals
const tx = await usdcContract.transfer(buyerWalletAddress, cashbackAmount);
await tx.wait();

// Step 5: Settle with organizer via x402
// (Platform treasury sends net amount to organizer)
const organizerAmount = ethers.parseUnits('75.00', 6);
const settlementTx = await usdcContract.transfer(
  organizerWalletAddress,
  organizerAmount
);
await settlementTx.wait();
```

### Advantages

- **No auth expiry risk:** Full charge captured immediately.
- **No refund fee losses:** No Stripe refund issued. Cashback is a separate USDC transfer.
- **No time constraints:** Cashback can be distributed at any point -- minutes, days, weeks, or months after purchase.
- **Positive UX framing:** "Earn cashback" is more engaging than "get a refund."
- **Crypto onboarding:** Each cashback distribution onboards a new user into the USDC/Base ecosystem, creating a flywheel for future crypto-native transactions.
- **Composable with x402:** Backend settlement already flows through USDC/Base, so cashback uses the same rail.

### Disadvantages

- **On-ramp friction/cost:** Converting USD to USDC incurs a cost (though this can be minimized with Stripe Bridge).
- **Wallet provisioning:** Must build or integrate an embedded wallet solution.
- **Regulatory considerations:** Distributing USDC to users may trigger regulatory requirements depending on jurisdiction (KYC/AML on wallet creation, potential money transmitter implications).
- **User education:** Some users may not understand or value "USDC cashback." Clear messaging and easy withdrawal to bank (via off-ramp) are essential.
- **Price volatility:** USDC is a stablecoin pegged to USD, so volatility risk is minimal. However, the buyer's cashback is denominated in USDC rather than appearing as a credit card statement credit, which some users may perceive as less tangible.

### Verdict

**Best overall strategy for Quest Payments.** Combines the reliability of traditional card payments with the fee efficiency and programmability of stablecoin settlement. The UX is additive (cashback is a reward) rather than subtractive (refund is a correction). Aligns with the project's x402/Base L2 settlement architecture.

---

## Comparison Matrix

| Dimension | Auth-then-Capture | Charge-then-Refund | Stablecoin Escrow | Hybrid (Recommended) |
|-----------|:-----------------:|:-------------------:|:-----------------:|:--------------------:|
| **Fee Efficiency** | Excellent (fees on net amount only) | Poor (fees on full amount, not returned on refund) | Excellent (sub-cent tx costs) | Good (standard card fees + sub-cent cashback) |
| **Time Constraint** | Severe (7-day auth window) | None (refund within 180 days) | None (contract-defined) | None (cashback anytime) |
| **UX Quality** | Poor (double pending charges, re-auth risk) | Fair (delayed refund visibility, support burden) | Poor for general users (wallet, signing, gas) / Good for crypto-native | Excellent (standard purchase + reward earning) |
| **Implementation Complexity** | Low (Stripe manual capture) | Low (Stripe refund API) | High (smart contract dev, audit, oracle) | Medium (Stripe + embedded wallet + on-ramp) |
| **Regulatory Risk** | None (standard card flow) | None (standard card flow) | High (money transmission, escrow licensing) | Low-Medium (USDC distribution, wallet custody) |
| **Revenue Certainty** | Medium (auth may expire, re-auth may fail) | High (charge captured immediately) | High (funds locked in contract) | High (charge captured immediately) |
| **Refund Handling** | N/A (partial capture, no refund) | Stripe refund (5-10 day visibility) | Smart contract release (instant, on-chain) | N/A (no refund; USDC cashback instead) |
| **Chargeback Risk** | Low (if captured promptly) | Medium (buyer disputes before refund appears) | None (on-chain, no card network) | Low (no pending refund to confuse buyer) |
| **Scalability** | Moderate (auth management overhead) | High (simple charge/refund) | High (on-chain, parallelizable) | High (standard Stripe + batch USDC transfers) |
| **Global Availability** | Limited by card network coverage | Limited by card network coverage | Global (USDC is borderless) | Card purchase limited by Stripe; cashback is global |

### Fee Comparison: $100 Ticket, $25 Discount Earned

| Strategy | Processing Cost | Effective Fee Rate on Net Revenue ($75) | Fee Savings vs. Charge-then-Refund |
|----------|-----------------|----------------------------------------|-----------------------------------|
| **Auth-then-Capture** | $2.48 (2.9% of $75 + $0.30) | 3.30% | $0.72 saved |
| **Charge-then-Refund** | $3.20 (2.9% of $100 + $0.30) | 4.27% | Baseline |
| **Stablecoin Escrow** | ~$0.05 (gas fees) | 0.07% | $3.15 saved |
| **Hybrid** | $3.20 (card) + ~$0.50 (on-ramp) + ~$0.01 (L2) = $3.71 | 4.95% | -$0.51 more (offset by UX/flexibility gains) |

**Note:** The hybrid approach is slightly more expensive in raw fees than charge-then-refund, but this comparison is misleading in isolation. The hybrid avoids the *hidden* costs of the refund approach: support tickets from confused buyers, chargeback disputes, and the UX cost of "pending refund" versus "earned reward." When factoring in these operational costs, the hybrid approach is net-positive.

### Decision Framework

```
Is the purchase-to-event window always < 7 days?
├── YES: Auth-then-Capture is viable and most fee-efficient
│         (but limits future quest types)
└── NO:
    Is the audience primarily crypto-native?
    ├── YES: Stablecoin Escrow is ideal
    │         (lowest fees, best transparency)
    └── NO:
        Is fee minimization the top priority?
        ├── YES: Charge-then-Refund (accept fee loss, simplest)
        └── NO:
            Hybrid: Immediate Charge + Stablecoin Cashback
            (best UX, no time constraints, crypto onboarding)
```

---

## Recommendation

### Primary Strategy: Hybrid (Immediate Charge + Stablecoin Cashback)

**Quest Payments should implement Strategy 4 (Hybrid) as the primary payment mechanism.** The reasoning:

1. **No artificial constraints.** Unlike auth-then-capture, there is no 7-day window limiting when incentives can resolve. Events can go on sale months in advance, and quests can span the entire purchase-to-event lifecycle. Day-of quests (check-in, early arrival) work seamlessly alongside pre-event quests (social shares, referrals).

2. **No refund fee bleed.** Unlike charge-then-refund, there is no Stripe processing fee lost to refunds. This matters at scale: at 100,000 tickets with an average $25 discount, charge-then-refund wastes $72,000+ in non-refunded processing fees. The hybrid approach redirects that value to buyers as USDC cashback.

3. **Superior user psychology.** "Earn $25 in USDC cashback" is a fundamentally different experience than "Get a $25 refund in 5-10 business days." Cashback is a reward. Refunds are corrections. The gamification of quest completion paired with cashback earning creates engagement and social virality that a refund flow cannot match.

4. **Aligns with x402 settlement architecture.** The backend already settles in USDC on Base via x402. The cashback distribution uses the same rail, creating a unified stablecoin flow from purchase through settlement through cashback. This eliminates the need to maintain two parallel payment rails (card for purchase, card for refund) and instead consolidates on a single settlement infrastructure.

5. **Crypto onboarding flywheel.** Every cashback distribution puts USDC into a new user's wallet. Over time, this builds a base of users who are comfortable with stablecoin wallets, which unlocks Strategy 3 (Stablecoin Escrow) for future events. The hybrid approach is a bridge from the fiat world to the crypto-native future.

### Stretch Goal: Stablecoin Escrow for Crypto-Native Users

For events with a crypto-native audience (web3 conferences, DeFi meetups, NFT events), offer **Strategy 3 (Stablecoin Escrow)** as an alternative checkout option:

- "Pay with USDC" button alongside traditional card checkout.
- Direct deposit into escrow contract.
- Sub-cent fees.
- Full on-chain transparency of quest resolution and discount application.

This serves as a proof-of-concept for the long-term vision where stablecoin escrow becomes the default and card payments are the fallback.

### Implementation Phases

| Phase | Strategy | Scope | Timeline Estimate |
|-------|----------|-------|-------------------|
| **Phase 1: MVP** | Charge-then-Refund | Ship immediately with standard Stripe. Validate core quest mechanics. | 2-4 weeks |
| **Phase 2: Hybrid** | Immediate Charge + USDC Cashback | Integrate embedded wallet (Privy/Dynamic), USDC on-ramp (Stripe Bridge), cashback distribution on Base. | 6-10 weeks |
| **Phase 3: Escrow** | Stablecoin Escrow (optional checkout) | Deploy escrow contract on Base, audit, integrate wallet-based checkout for USDC-direct users. | 10-16 weeks |

**Phase 1 is a pragmatic starting point.** Charge-then-refund works, is simple, and lets the team validate that quest-based ticketing resonates with buyers before investing in the more complex hybrid infrastructure. The fee loss in Phase 1 is the cost of speed-to-market.

**Phase 2 is the target state.** The hybrid approach delivers the full value proposition of Quest Payments: gamified cashback, stablecoin settlement, and no compromises on time windows or fee efficiency.

**Phase 3 is the long-term vision.** Stablecoin escrow is the endgame for a world where embedded wallets and stablecoin payments are mainstream. Building it as an optional path alongside the hybrid approach positions Quest Payments for that future without requiring it today.

---

## Appendix: Stripe API Reference

### PaymentIntent (Manual Capture)

```
POST /v1/payment_intents
  amount: integer (in cents)
  currency: 'usd'
  capture_method: 'manual'
  payment_method: string
  customer: string
  confirm: true

POST /v1/payment_intents/{id}/capture
  amount_to_capture: integer (must be <= original amount)
```

Docs: https://docs.stripe.com/api/payment_intents/capture

### Refunds

```
POST /v1/refunds
  payment_intent: string
  amount: integer (partial refund amount in cents)
  metadata: object

GET /v1/refunds/{id}
  -> status: 'succeeded' | 'pending' | 'failed' | 'canceled'
```

Docs: https://docs.stripe.com/api/refunds

### Stripe Stablecoin Financial Accounts (Bridge)

Stripe's acquisition of Bridge (2024) enables native stablecoin operations:

```
# Create a stablecoin financial account
POST /v1/financial_accounts
  supported_currencies: ['usd']
  features:
    stablecoin:
      requested: true

# Initiate a transfer to stablecoin
POST /v1/treasury/outbound_transfers
  financial_account: string
  amount: integer
  currency: 'usd'
  destination_payment_method: string (crypto wallet)
  network: 'base' # Base L2
```

Note: Stripe's stablecoin API is evolving. Consult the latest Stripe documentation for current endpoint signatures and availability.

Docs: https://docs.stripe.com/treasury (general Treasury docs; stablecoin-specific docs may be under early access)

### Webhook Events

Key events for quest payment flows:

| Event | Usage |
|-------|-------|
| `payment_intent.succeeded` | Confirm purchase, begin quest tracking |
| `payment_intent.amount_capturable_updated` | Auth hold confirmed (manual capture) |
| `charge.refunded` | Confirm refund processed (Strategy 2) |
| `charge.dispute.created` | Alert on chargeback, pause quest rewards |
| `payout.paid` | Confirm funds reached Stripe balance (pre on-ramp) |

---

*This document is intended as an internal decision document for the Quest Payments engineering and product team. It should be updated as Stripe's fee structure, card network authorization policies, or Base L2 gas costs change.*
