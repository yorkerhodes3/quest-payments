# Economic Modeling

> Research for Quest Payments — Issue #5

## Overview

This document models the economics of the Quest Payments incentive mechanism: expected discount completion rates, revenue impact, fee comparisons across payment strategies, break-even analysis for stablecoin infrastructure, and organizer value proposition.

---

## 1. Expected Discount Completion Rates

Based on industry benchmarks for event marketing incentive programs:

| Incentive | Discount | Expected Completion Rate | Notes |
|---|---|---|---|
| Social share | 5% | 60–70% | Low friction; most buyers will share if reminded |
| Refer a friend (confirmed purchase) | 10% | 15–25% | Higher friction; requires another person to buy |
| Check-in on time | 5% | 80–90% | Near-universal if buyer attends the event |
| Attend sponsor session | 3% | 40–55% | Depends on sponsor session quality |
| Submit feedback | 2% | 50–70% | Low friction; completion rises with reminder emails |

**Weighted average discount earned per buyer (mid-case):**

| Incentive | Discount | Mid-case Completion | Expected Discount |
|---|---|---|---|
| Social share | 5% | 65% | 3.25% |
| Referral | 10% | 20% | 2.00% |
| Check-in | 5% | 85% | 4.25% |
| Sponsor session | 3% | 47% | 1.41% |
| Feedback | 2% | 60% | 1.20% |
| **Total** | **25%** | — | **12.11%** |

On a $100 ticket: **expected net price ≈ $87.89** (buyer pays), **organizer receives ≈ $87.89** before payment processing fees.

---

## 2. Revenue Impact at Various Completion Scenarios

| Scenario | Completion Rate | Net Price (of $100) | Organizer Revenue (net of Stripe fees) |
|---|---|---|---|
| Pessimistic (low engagement) | 5% | $95.00 | $92.05 |
| Base case (mid-case above) | 12.11% | $87.89 | $85.24 |
| Optimistic (high engagement) | 18% | $82.00 | $79.52 |
| Maximum (all complete) | 25% | $75.00 | $72.73 |

*Stripe fee assumed at 2.9% + $0.30. Applied to captured amount.*

### Revenue Comparison: Quest vs Flat Pricing

Assume a flat $85 ticket with no incentives vs a $100 Quest ticket:

| Metric | Flat $85 | Quest $100 (base case) |
|---|---|---|
| List price | $85 | $100 |
| Net price paid (buyer) | $85 | $87.89 |
| Organizer revenue (net fees) | $82.35 | $85.24 |
| Social media reach generated | Minimal | ~65% of buyers share → viral lift |
| Referral new buyers | ~0 | ~20% of buyers each refer 1 more |

**At 500 attendees:**
- Flat pricing: 500 tickets × $82.35 = $41,175 organizer revenue
- Quest pricing: 500 base tickets × $85.24 = $42,620 organizer revenue
- Quest pricing: + 500 × 20% referrals × 1 new buyer × $85.24 = +$8,524
- **Quest total: $51,144 vs Flat: $41,175 (+24%)**

The referral multiplier is the dominant economic driver.

---

## 3. Fee Comparison Across Payment Strategies (1,000-Ticket Batch)

Assumptions: $100 ticket, 12.11% average discount earned, 1,000 buyers.

### Strategy A: Auth-then-Capture

- Captured amount per ticket: $87.89
- Stripe fee per ticket: $87.89 × 2.9% + $0.30 = $2.85
- Total fees (1,000 tickets): **$2,850**
- Re-auth failure rate assumed 2%: 20 tickets fall back to charge-then-refund
  - Additional cost: ~$14.60
- **Effective total: ~$2,865**

### Strategy B: Charge-then-Refund

- Charged: $100 × 1,000 = $100,000
- Stripe fee on charge: 2.9% + $0.30 = $3.20 per ticket = $3,200 total
- Average refund per ticket: $12.11
- Total refunded: $12,110 (fees NOT returned)
- Lost fees on refunded amounts: ~$351 (2.9% of $12,110)
- **Effective total: ~$3,551**

### Strategy C: Stablecoin Escrow (Base L2)

- Gas cost per purchase (5 incentive verifications): ~$0.003 (from smart contract analysis)
- USDC Circle fee: 0% (no Circle API fee for USDC transfers on Base)
- On-ramp fee (if buyer uses Coinbase): ~1% ($1.00 per ticket)
- With on-ramp: $1.003 per ticket × 1,000 = **$1,003**
- Without on-ramp (crypto-native): $0.003 × 1,000 = **$3**

### Strategy D: Hybrid (Charge + USDC Cashback)

- Card processing (full amount): $3.20 per ticket × 1,000 = $3,200
- USDC cashback delivery: ~$0.01 per ticket × 1,000 = $10
- **Effective total: ~$3,210**

### Fee Summary Table (1,000 Tickets)

| Strategy | Total Fees | Per-Ticket Fee | Notes |
|---|---|---|---|
| Auth-then-Capture | $2,865 | $2.87 | Best card option |
| Charge-then-Refund | $3,551 | $3.55 | Worst card option |
| Stablecoin Escrow (no on-ramp) | $3 | $0.003 | Impractical without crypto users |
| Stablecoin Escrow (with on-ramp) | $1,003 | $1.00 | Viable if on-ramp sponsored |
| **Hybrid (recommended)** | $3,210 | $3.21 | Best balance of UX + cost |

---

## 4. Break-Even Analysis for Stablecoin Infrastructure

### Setup Costs (one-time)

| Item | Estimated Cost |
|---|---|
| Smart contract development + audit | $15,000–$50,000 |
| x402 integration development | $5,000–$15,000 |
| Legal review of stablecoin flow | $10,000–$25,000 |
| Total | **$30,000–$90,000** |

### Per-Event Operational Costs

| Item | Cost |
|---|---|
| Gas for smart contract operations | <$10 per 1,000 tickets |
| USDC liquidity for cashback pool | Working capital (not a fee) |
| Monitoring + ops | ~$500/month amortized |

### Break-Even Calculation (Hybrid vs Charge-then-Refund)

Saving per ticket (Hybrid vs C-t-R): $3.55 - $3.21 = **$0.34 per ticket**

At 1,000 tickets/event and 10 events/month: 10,000 tickets × $0.34 = $3,400/month savings

Break-even on $60,000 development investment: **~18 months** at 10 events/month

At 100 events/month (scale): **~1.8 months** break-even.

---

## 5. Organizer Value Proposition

Quest Payments delivers value on three dimensions:

### 1. Revenue Uplift (Referral Multiplier)
As shown in section 2, referral incentives can drive a 20%+ increase in ticket sales at no incremental organizer cost. The buyer who refers earns a discount; the new buyer is an incremental sale.

### 2. Marketing Cost Reduction
Social share incentives generate organic social media coverage. At an industry CPM (cost per thousand impressions) of $5–$15:
- 500 buyers × 65% share rate × 300 average impressions per share = 97,500 impressions
- Equivalent paid advertising cost: $488–$1,463
- Cost to organizer: $500 × 65% × 5% discount = $162.50 in discounts
- **Marketing ROI: 3–9×**

### 3. Attendance Quality
Check-in and sponsor session incentives directly improve attendance metrics that matter to sponsors and venues:
- On-time check-in rate rises (reduces queue congestion)
- Sponsor session attendance becomes predictable
- Post-event feedback rate rises (data for future event planning)

---

## 6. Pricing Strategy Recommendations

### Discount Budget

Organizers should think of the Quest discount pool as a marketing budget, not a revenue loss:

| Recommendation | Rationale |
|---|---|
| Cap total discount at ≤25% of ticket price | Keeps list price premium perception; 25% is the "power user" reward |
| Set referral discount at 10%+ | Referral is the highest-ROI incentive; reward it most |
| Make check-in discount automatic (no active proof needed) | Maximizes check-in rate; reduces support burden |
| Use low-value discounts (2–3%) for engagement actions | Creates "quest completion" psychology |

### Ticket Tier Strategy

Offer Quest discounts on mid-tier and premium tickets only:
- General admission: flat price (no quest) — simplicity for casual buyers
- Mid-tier: Quest available — engaged buyers self-select
- VIP: Quest available with higher absolute discounts (e.g., 10% on $250 = $25 cashback for referral)

---

## 7. Sensitivity Analysis

### Referral Completion Rate Sensitivity

| Referral Rate | Extra Tickets Sold (per 1,000) | Extra Organizer Revenue |
|---|---|---|
| 10% | 100 | $8,524 |
| 20% (base case) | 200 | $17,048 |
| 30% | 300 | $25,572 |
| 50% | 500 | $42,620 |

Doubling the referral rate roughly doubles incremental revenue. Referral rate is the most sensitive input to overall Quest Payments economics.

### Discount Completion Rate Sensitivity (Fee Impact)

| Avg Discount Earned | Hybrid Fee/Ticket | C-t-R Fee/Ticket | Hybrid Advantage |
|---|---|---|---|
| 5% | $3.22 | $3.35 | $0.13 |
| 12% (base) | $3.21 | $3.55 | $0.34 |
| 20% | $3.21 | $3.78 | $0.57 |
| 25% | $3.21 | $3.93 | $0.72 |

The Hybrid strategy's fee advantage grows as discount completion rates increase. At high completion rates, the Hybrid saves nearly $1/ticket compared to Charge-then-Refund.

### Event Scale Sensitivity

| Events/Month | Tickets/Event | Annual Fee Savings (Hybrid vs C-t-R) |
|---|---|---|
| 5 | 500 | $10,200 |
| 10 | 1,000 | $40,800 |
| 50 | 1,000 | $204,000 |
| 100 | 2,000 | $816,000 |

At 100 events/month with 2,000 tickets each, the Hybrid strategy saves over **$800,000/year** in payment processing fees vs Charge-then-Refund.
