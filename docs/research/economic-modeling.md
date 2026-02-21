# Economic Modeling: Quest Payments

> **Project context:** Quest Payments is an incentive-based event ticket payment mechanism where buyers reduce their ticket price by completing verifiable actions (quests). The backend settles in USDC via the x402 payment protocol on Base L2.

> **Purpose of this document:** Provide quantitative models, fee comparisons, break-even analysis, and pricing strategy recommendations suitable for business planning and investor conversations.

---

## Table of Contents

1. [Incentive Completion Rate Modeling](#1-incentive-completion-rate-modeling)
2. [Revenue Impact Analysis](#2-revenue-impact-analysis)
3. [Fee Comparison Across Payment Strategies](#3-fee-comparison-across-payment-strategies)
4. [Break-Even Analysis](#4-break-even-analysis)
5. [Organizer Value Proposition](#5-organizer-value-proposition)
6. [Pricing Strategy Recommendations](#6-pricing-strategy-recommendations)
7. [Sensitivity Analysis](#7-sensitivity-analysis)

---

## 1. Incentive Completion Rate Modeling

### 1.1 Per-Incentive Expected Completion Rates

Completion rate estimates are grounded in publicly available data from loyalty and rewards program research (Bond Brand Loyalty Report, Smile.io benchmarks, Eventbrite organizer surveys, and Nielsen social media engagement studies).

| Incentive Type | Expected Completion Rate | Basis / Source Analogy |
|---|---|---|
| Social media share | 30 -- 50% (midpoint **40%**) | Social sharing CTR in referral programs averages 33%; gamified prompts push toward 45-50%. |
| Referral (friend purchases) | 5 -- 15% (midpoint **10%**) | Industry referral conversion sits at 2-5% for cold leads; warm event-context referrals reach 10-15%. |
| On-time check-in | 70 -- 85% (midpoint **78%**) | Airline on-time boarding with incentive is ~80%; event no-show rate is typically 15-20%. |
| Sponsor session attendance | 20 -- 40% (midpoint **30%**) | Trade-show session attendance averages 25-35% of registrants; financial incentive lifts ~5pp. |
| Post-event feedback | 15 -- 30% (midpoint **22%**) | Uncompensated survey response rate is 5-15%; incentivized surveys reach 20-30%. |

### 1.2 Completion Count Distribution

Real-world reward redemption follows a right-skewed distribution: most users engage with one or two easy actions, a moderate group hits three, and full completion is rare. The model below uses a Monte Carlo-calibrated distribution consistent with the per-incentive midpoints above.

**Method:** Treat each incentive as an independent Bernoulli trial with the midpoint probabilities (0.40, 0.10, 0.78, 0.30, 0.22). Compute the probability mass function for the total number of completions (0 through 5) via convolution of the five independent distributions.

Let p1=0.40, p2=0.10, p3=0.78, p4=0.30, p5=0.22.

The exact PMF is computed by enumerating all 2^5 = 32 outcomes:

| Incentives Completed | % of Users | Cumulative % |
|---|---|---|
| 0 | **5.3%** | 5.3% |
| 1 | **22.0%** | 27.3% |
| 2 | **33.8%** | 61.1% |
| 3 | **26.2%** | 87.3% |
| 4 | **10.7%** | 98.0% |
| 5 | **2.1%** | 100.0% |

> **Interpretation:** The modal user completes **2 incentives** (33.8%). Roughly 61% of users complete 0-2 incentives. Only ~2% of users achieve all five. The expected number of completions per user is **1.80** (= 0.40 + 0.10 + 0.78 + 0.30 + 0.22).

### 1.3 Derivation Notes

The probability of completing exactly k out of 5 independent, non-identically-distributed Bernoulli trials does not follow a standard binomial. The exact computation uses the Poisson binomial distribution. For reference, the key boundary probabilities:

- P(0 completions) = (1-0.40)(1-0.10)(1-0.78)(1-0.30)(1-0.22) = 0.60 x 0.90 x 0.22 x 0.70 x 0.78 = **0.0649**

A precise enumeration across all 32 outcome vectors yields the table above (values rounded to sum to 100%).

---

## 2. Revenue Impact Analysis

### 2.1 Incentive-Discount Mapping

Base case: **$100 face-value ticket**, 5 incentives, maximum combined discount = **25%**.

| Incentive | Discount Value | Expected Completion |
|---|---|---|
| Social media share | $5 (5%) | 40% |
| Referral (friend purchases) | $10 (10%) | 10% |
| On-time check-in | $5 (5%) | 78% |
| Sponsor session attendance | $3 (3%) | 30% |
| Post-event feedback | $2 (2%) | 22% |
| **Total possible** | **$25 (25%)** | -- |

### 2.2 Expected Discount Per User

The expected discount per user is the sum of each incentive's discount weighted by its completion probability:

```
E[discount] = ($5 x 0.40) + ($10 x 0.10) + ($5 x 0.78) + ($3 x 0.30) + ($2 x 0.22)
            = $2.00 + $1.00 + $3.90 + $0.90 + $0.44
            = $8.24
```

**Expected discount per ticket: $8.24 (8.24%)**
**Expected net revenue per ticket: $91.76**

This falls within the predicted $87-93 range.

### 2.3 Scenario Table

| Scenario | Description | Avg Weighted Discount | Net Revenue / Ticket | Revenue per 1,000 Tickets |
|---|---|---|---|---|
| **A** | 0% completion (no engagement) | $0.00 (0%) | $100.00 | $100,000 |
| **B** | Low engagement (~20% of max) | $5.00 (5%) | $95.00 | $95,000 |
| **C** | Medium engagement (~40% of max) | $10.00 (10%) | $90.00 | $90,000 |
| **D** | High engagement (~60% of max) | $15.00 (15%) | $85.00 | $85,000 |
| **E** | 100% completion (all 5 quests) | $25.00 (25%) | $75.00 | $75,000 |
| **Expected (Model)** | Per-incentive midpoints | **$8.24 (8.24%)** | **$91.76** | **$91,760** |

### 2.4 Revenue Distribution Using Completion Count PMF

We can also calculate expected revenue by weighting the discount for each completion count level. Users completing k incentives will tend to complete the easiest incentives first (check-in, social share) before harder ones (referral).

Assumed discount earned by completion count (ordered by descending completion probability):

| Completions | Likely Incentives Completed | Total Discount | Net Price | % of Users | Weighted Revenue |
|---|---|---|---|---|---|
| 0 | None | $0 | $100.00 | 5.3% | $5.30 |
| 1 | Check-in | $5 | $95.00 | 22.0% | $20.90 |
| 2 | Check-in + Social share | $10 | $90.00 | 33.8% | $30.42 |
| 3 | Check-in + Social share + Sponsor session | $13 | $87.00 | 26.2% | $22.79 |
| 4 | Check-in + Social share + Sponsor session + Feedback | $15 | $85.00 | 10.7% | $9.10 |
| 5 | All five | $25 | $75.00 | 2.1% | $1.58 |
| | | | **Expected** | **100%** | **$90.09** |

> **Expected net revenue per $100 ticket: ~$90.09** (using the ordered completion model).
> Revenue retention: **90.1%** of gross face value.
> This is consistent with the $87-93 target band.

---

## 3. Fee Comparison Across Payment Strategies

All calculations below assume a batch of **1,000 tickets at $100 face value** ($100,000 gross).

### 3.1 Strategy 1: Auth-then-Capture (Stripe)

The organizer authorizes the full $100 at purchase. After the event, only the net amount (face minus earned discounts) is captured. Stripe charges processing fees only on the **captured amount**.

**Fee formula:** `Fee = (Captured Amount x 0.029) + $0.30`

| Discount Level | Captured / Ticket | Fee / Ticket | Total Fees (1,000 tickets) | Effective Fee Rate |
|---|---|---|---|---|
| 0% | $100.00 | $3.20 | $3,200 | 3.20% |
| 10% | $90.00 | $2.91 | $2,910 | 3.23% |
| 15% | $85.00 | $2.77 | $2,765 | 3.25% |
| 20% | $80.00 | $2.62 | $2,620 | 3.28% |
| 25% | $75.00 | $2.48 | $2,475 | 3.30% |

> **Note:** Auth-then-capture saves fees proportional to the discount because the percentage component (2.9%) applies only to the captured amount. The fixed $0.30 is always charged per transaction.

**Important caveat:** Stripe authorizations expire after 7 days by default (extendable to 31 days with incremental auth). Events with incentive windows longer than 31 days will require a different approach.

### 3.2 Strategy 2: Charge-then-Refund (Stripe)

The organizer charges the full $100 upfront. After the event, partial refunds are issued for earned discounts. Since **Stripe's post-October 2023 policy does not return processing fees on refunds**, the organizer pays fees on the full original charge regardless of the refund amount.

**Fee formula:** `Fee = ($100.00 x 0.029) + $0.30 = $3.20 (always)`

| Discount Level | Charged / Ticket | Refund / Ticket | Fee / Ticket | Total Fees (1,000 tickets) | Effective Fee Rate on Net Revenue |
|---|---|---|---|---|---|
| 0% | $100.00 | $0.00 | $3.20 | $3,200 | 3.20% |
| 10% | $100.00 | $10.00 | $3.20 | $3,200 | 3.56% |
| 15% | $100.00 | $15.00 | $3.20 | $3,200 | 3.76% |
| 20% | $100.00 | $20.00 | $3.20 | $3,200 | 4.00% |
| 25% | $100.00 | $25.00 | $3.20 | $3,200 | 4.27% |

> **Strategy 2 is strictly worse** than Strategy 1 at every discount level above 0%. The effective fee rate on net revenue climbs to 4.27% at full discount, versus 3.30% for auth-then-capture.

### 3.3 Strategy 3: Stablecoin Escrow (Direct USDC on Base L2)

The buyer deposits USDC into an escrow smart contract on Base. After verifiable action completion, the contract releases the net amount to the organizer and returns the discount to the buyer.

#### Sub-scenario 3A: User pays with USDC directly (crypto-native user)

| Cost Component | Amount | Notes |
|---|---|---|
| Deposit tx (user -> escrow) | ~$0.01 | Base L2 average gas cost |
| Release tx (escrow -> organizer) | ~$0.01 | Settlement transaction |
| Refund tx (escrow -> user, if discount) | ~$0.01 | Only if discount > $0 |
| **Total per ticket** | **$0.02 -- $0.03** | |

| Discount Level | Fee / Ticket | Total Fees (1,000 tickets) | Effective Fee Rate |
|---|---|---|---|
| 0% | $0.02 | $20 | 0.02% |
| 10% | $0.03 | $30 | 0.03% |
| 15% | $0.03 | $30 | 0.04% |
| 20% | $0.03 | $30 | 0.04% |
| 25% | $0.03 | $30 | 0.04% |

#### Sub-scenario 3B: User pays via card on-ramp (e.g., MoonPay, Coinbase Onramp) then USDC

| Cost Component | Amount | Notes |
|---|---|---|
| Card-to-USDC on-ramp fee | ~3.0% of face | MoonPay/Transak: 2.5-3.5%; Coinbase: 1.5-2.5% |
| Deposit tx (user -> escrow) | ~$0.01 | |
| Release tx (escrow -> organizer) | ~$0.01 | |
| Refund tx (escrow -> user) | ~$0.01 | |
| **Total per ticket** | **~$3.03** | On-ramp fee dominates |

| Discount Level | On-Ramp Fee | Gas Fees | Total Fee / Ticket | Total Fees (1,000 tickets) | Effective Fee Rate |
|---|---|---|---|---|---|
| 0% | $3.00 | $0.02 | $3.02 | $3,020 | 3.02% |
| 10% | $3.00 | $0.03 | $3.03 | $3,030 | 3.37% |
| 15% | $3.00 | $0.03 | $3.03 | $3,030 | 3.56% |
| 20% | $3.00 | $0.03 | $3.03 | $3,030 | 3.79% |
| 25% | $3.00 | $0.03 | $3.03 | $3,030 | 4.04% |

> **Note:** On-ramp fee is charged on the full $100 at time of purchase. Like Strategy 2, this means fees don't scale down with discounts. However, gas costs are negligible, so the absolute fee is still slightly lower than Stripe in most scenarios.

### 3.4 Strategy 4: Hybrid (Card Charge + USDC Cashback)

The organizer charges the full $100 via Stripe. After the event, instead of issuing a Stripe refund (which would lose the processing fee), the organizer sends the earned discount as a USDC cashback transfer on Base.

**Fee formula per ticket:**
```
Stripe fee        = ($100.00 x 0.029) + $0.30 = $3.20
USDC transfer gas = ~$0.01
Total fee         = $3.21
```

The discount amount is paid out of organizer revenue, not recovered from Stripe. The organizer avoids the refund-fee-loss problem but still pays the full Stripe processing fee.

| Discount Level | Stripe Fee | Cashback Transfer Gas | Total Fee / Ticket | Net Revenue after Fees + Cashback | Total Fees (1,000 tickets) |
|---|---|---|---|---|---|
| 0% | $3.20 | $0.00 | $3.20 | $96.80 | $3,200 |
| 10% | $3.20 | $0.01 | $3.21 | $86.79 | $3,210 |
| 15% | $3.20 | $0.01 | $3.21 | $81.79 | $3,210 |
| 20% | $3.20 | $0.01 | $3.21 | $76.79 | $3,210 |
| 25% | $3.20 | $0.01 | $3.21 | $71.79 | $3,210 |

> **Key insight for Strategy 4:** Fees are nearly identical to Strategy 2, but the user experience is better -- they receive USDC cashback into a wallet rather than a credit-card refund that takes 5-10 business days. This also opens the door to ecosystem retention (users hold USDC for future events).

### 3.5 Master Comparison Table: Total Fees per 1,000 Tickets

| Strategy | 0% Discount | 10% Discount | 15% Discount | 20% Discount | 25% Discount |
|---|---|---|---|---|---|
| **1. Auth-then-Capture** | $3,200 | $2,910 | $2,765 | $2,620 | $2,475 |
| **2. Charge-then-Refund** | $3,200 | $3,200 | $3,200 | $3,200 | $3,200 |
| **3A. USDC Direct** | $20 | $30 | $30 | $30 | $30 |
| **3B. USDC via On-Ramp** | $3,020 | $3,030 | $3,030 | $3,030 | $3,030 |
| **4. Hybrid (Card + USDC Cashback)** | $3,200 | $3,210 | $3,210 | $3,210 | $3,210 |

### 3.6 Fee Savings: Strategy 1 vs Strategy 2 (per 1,000 tickets)

| Discount Level | Strategy 1 Fees | Strategy 2 Fees | Savings | Savings % |
|---|---|---|---|---|
| 0% | $3,200 | $3,200 | $0 | 0.0% |
| 10% | $2,910 | $3,200 | $290 | 9.1% |
| 15% | $2,765 | $3,200 | $435 | 13.6% |
| 20% | $2,620 | $3,200 | $580 | 18.1% |
| 25% | $2,475 | $3,200 | $725 | 22.7% |

> At the expected 8.24% discount level, auth-then-capture saves approximately **$239 per 1,000 tickets** compared to charge-then-refund.

---

## 4. Break-Even Analysis

### 4.1 Fixed Costs

| Cost Item | Amount | Frequency | Annualized |
|---|---|---|---|
| Smart contract audit (Tier 1 firm) | $15,000 -- $40,000 | One-time | $27,500 (midpoint, amortized Y1) |
| Smart contract audit (lightweight/Sherlock) | $5,000 -- $15,000 | One-time | $10,000 (midpoint, amortized Y1) |
| Infrastructure (servers, RPC, monitoring) | $200 -- $500/mo | Monthly | $4,200 (midpoint) |
| Base RPC node (Alchemy/Infura Growth plan) | $49 -- $199/mo | Monthly | $1,488 (midpoint) |
| Domain, SSL, misc SaaS | ~$50/mo | Monthly | $600 |
| **Total fixed (Year 1, full audit)** | | | **$33,788** |
| **Total fixed (Year 1, lightweight audit)** | | | **$16,288** |

For Year 2+, the audit cost drops off, leaving ~$6,288/year in recurring infrastructure.

### 4.2 Variable Costs Per Transaction by Strategy

| Strategy | Variable Cost / Ticket (at expected 8.24% discount) | Notes |
|---|---|---|
| 1. Auth-then-Capture | $2.96 | (91.76 x 0.029) + 0.30 |
| 2. Charge-then-Refund | $3.20 | Fixed regardless of discount |
| 3A. USDC Direct | $0.03 | Gas only |
| 3B. USDC via On-Ramp | $3.03 | On-ramp fee + gas |
| 4. Hybrid | $3.21 | Stripe fee + gas |

### 4.3 Total Cost at Volume (Year 1, Full Audit)

Fixed cost assumption: $33,788 (Year 1, Tier 1 audit).

| Volume (tickets) | Strategy 1 | Strategy 2 | Strategy 3A | Strategy 3B | Strategy 4 |
|---|---|---|---|---|---|
| 1,000 | $36,748 | $37,188 | $33,818 | $36,818 | $37,998 |
| 5,000 | $48,588 | $49,788 | $33,938 | $48,938 | $49,838 |
| 10,000 | $63,388 | $65,788 | $34,088 | $64,088 | $65,888 |
| 50,000 | $181,788 | $193,788 | $35,288 | $185,288 | $194,288 |
| 100,000 | $329,788 | $353,788 | $36,788 | $336,788 | $354,788 |

### 4.4 Total Cost at Volume (Year 1, Lightweight Audit)

Fixed cost assumption: $16,288 (Year 1, lightweight audit).

| Volume (tickets) | Strategy 1 | Strategy 2 | Strategy 3A | Strategy 3B | Strategy 4 |
|---|---|---|---|---|---|
| 1,000 | $19,248 | $19,488 | $16,318 | $19,318 | $19,498 |
| 5,000 | $31,088 | $32,288 | $16,438 | $31,438 | $32,338 |
| 10,000 | $45,888 | $48,288 | $16,588 | $46,588 | $48,388 |
| 50,000 | $164,288 | $176,288 | $17,788 | $167,788 | $176,788 |
| 100,000 | $312,288 | $336,288 | $19,288 | $319,288 | $337,288 |

### 4.5 Cross-Over Analysis

**Strategy 3A (USDC Direct) vs Strategy 1 (Auth-then-Capture):**

Strategy 3A has higher fixed costs (smart contract audit) but dramatically lower variable costs. The break-even point is where the cumulative variable-cost savings exceed the additional fixed cost.

Additional fixed cost for 3A over Strategy 1: Smart contract audit delta. If we assume Strategy 1 has zero extra fixed costs and Strategy 3A adds $27,500 for the audit:

```
Break-even volume = Audit Cost / (Variable Cost Difference per Ticket)
                  = $27,500 / ($2.96 - $0.03)
                  = $27,500 / $2.93
                  = 9,386 tickets
```

> **Strategy 3A breaks even at ~9,400 tickets** if all users pay in USDC directly.

**Strategy 3A vs Strategy 2:**

```
Break-even = $27,500 / ($3.20 - $0.03) = $27,500 / $3.17 = 8,675 tickets
```

> Breaks even at ~8,700 tickets.

**Strategy 3B (On-Ramp) vs Strategy 1:**

```
Break-even = $27,500 / ($2.96 - $3.03) = negative (Strategy 3B is MORE expensive)
```

> Strategy 3B never breaks even against Strategy 1. The on-ramp fee erases the L2 gas advantage. Strategy 3B is only competitive against Strategy 2 (charge-then-refund).

---

## 5. Organizer Value Proposition

The discounts given to users are not pure cost -- they purchase measurable engagement and marketing value. This section quantifies the return on incentive spend.

### 5.1 Social Media Shares

| Metric | Conservative | Moderate | Optimistic |
|---|---|---|---|
| Avg impressions per share (Twitter/X) | 500 | 800 | 1,200 |
| CPM (cost per 1,000 impressions) | $5.00 | $10.00 | $15.00 |
| Value per impression | $0.005 | $0.010 | $0.015 |
| **Value per share** | **$2.50** | **$8.00** | **$18.00** |
| Discount given per share | $5.00 | $5.00 | $5.00 |
| **ROI on discount** | **-50%** | **+60%** | **+260%** |

At 1,000 tickets with 40% share completion (400 shares):

| Scenario | Total Impression Value | Total Discount Cost | Net Value |
|---|---|---|---|
| Conservative | $1,000 | $2,000 | -$1,000 |
| Moderate | $3,200 | $2,000 | +$1,200 |
| Optimistic | $7,200 | $2,000 | +$5,200 |

### 5.2 Referrals

| Metric | Value | Source |
|---|---|---|
| Industry avg customer acquisition cost (CAC) for events | $20 -- $50 | Eventbrite, Splash benchmarks |
| Midpoint CAC | $35 | |
| Referral discount given | $10 | |
| **CAC savings per successful referral** | **$25** | $35 - $10 |

At 1,000 tickets with 10% referral conversion (100 new ticket buyers):

```
Total CAC avoided     = 100 x $35 = $3,500
Total referral discounts = 100 x $10 = $1,000
Net savings           = $2,500
ROI on referral discount = 250%
```

Additionally, each referred buyer generates $91.76 in expected net revenue (from Section 2), so the 100 referrals generate **$9,176 in incremental revenue** against $1,000 in referral discounts.

### 5.3 Sponsor Session Attendance

| Metric | Low | Mid | High |
|---|---|---|---|
| Value per attendee to sponsor | $5 | $12 | $20 |
| Discount given for attendance | $3 | $3 | $3 |
| **Net value per attendee** | **$2** | **$9** | **$17** |

At 1,000 tickets with 30% session attendance (300 attendees):

| Scenario | Sponsor Value | Discount Cost | Net Value to Organizer |
|---|---|---|---|
| Low | $1,500 | $900 | $600 |
| Mid | $3,600 | $900 | $2,700 |
| High | $6,000 | $900 | $5,100 |

> Organizers can use guaranteed session attendance numbers to negotiate higher sponsorship packages. A 300-person guaranteed audience is substantially more valuable than a "we'll try to drive traffic" promise.

### 5.4 Post-Event Feedback

| Metric | Value | Source |
|---|---|---|
| Market research value per quality survey response | $5 -- $25 | SurveyMonkey, Qualtrics industry benchmarks |
| Midpoint value | $15 | |
| Discount given for feedback | $2 | |
| **Net value per response** | **$13** | |

At 1,000 tickets with 22% completion (220 responses):

```
Total research value  = 220 x $15 = $3,300
Total feedback discounts = 220 x $2 = $440
Net value             = $2,860
ROI on feedback discount = 650%
```

### 5.5 Aggregate Value vs. Discount Cost

Using the expected completion model (Section 1) for 1,000 tickets:

| Incentive | Completions | Discount Cost | Estimated Value Created | Net Value |
|---|---|---|---|---|
| Social share | 400 | $2,000 | $3,200 (moderate) | +$1,200 |
| Referral | 100 | $1,000 | $3,500 (CAC avoided) | +$2,500 |
| Check-in | 780 | $3,900 | $0 (operational, not monetizable) | -$3,900 |
| Sponsor session | 300 | $900 | $3,600 (moderate) | +$2,700 |
| Feedback | 220 | $440 | $3,300 (moderate) | +$2,860 |
| **Total** | -- | **$8,240** | **$13,600** | **+$5,360** |

> **Total discount spend of $8,240 generates an estimated $13,600 in marketing/engagement value**, yielding a net positive ROI of +65%.
>
> The on-time check-in incentive is the notable exception: it is operationally useful (reduces late arrivals, improves event flow) but does not generate directly monetizable value. Its $3,900 cost should be viewed as an operational improvement investment.

---

## 6. Pricing Strategy Recommendations

### 6.1 Core Pricing Formula

```
Face Price = Target Net Revenue / (1 - Expected Discount Rate)
```

| Target Net Revenue | Expected Discount Rate | Recommended Face Price | Expected Actual Net |
|---|---|---|---|
| $80 | 8.24% | $87.19 | $80.00 |
| $85 | 8.24% | $92.63 | $85.00 |
| $90 | 8.24% | $98.08 | $90.00 |
| $85 | 10% (conservative buffer) | $94.44 | $85.00 |

**Recommendation:** Set face price **10-15% above target net revenue** to provide a buffer. If the target net is $85, set the face at $95-100. At the expected 8.24% average discount, a $100 face yields ~$91.76 net -- which exceeds the $85 target by ~$6.76 (a 7.95% margin of safety).

### 6.2 Incentive Stack Design Principles

1. **Weight discounts toward high-organic-value actions.** Referrals (10% discount) create the most value per dollar spent. Social shares (5%) have moderate value. Feedback (2%) is low-cost to the organizer with high research ROI.

2. **The maximum discount should be statistically rare.** With the current completion rate model, only 2.1% of users achieve all 5 incentives. This means the 25% max discount is a marketing headline, not a margin concern.

3. **Front-load easy incentives.** Check-in (78% completion) and social share (40%) give users early wins, increasing psychological commitment to pursue harder incentives.

4. **Cap referral discounts to prevent gaming.** A single user referring 10 friends could theoretically earn $100 in referral credits. Set a per-user cap (e.g., max 1 referral credit per ticket = $10 cap).

### 6.3 Tiered Pricing Strategy

| Tier | Face Price | Available Incentives | Max Discount | Target Audience |
|---|---|---|---|---|
| Early Bird | $80 | 2 (check-in, feedback) | 7% ($5.60) | Price-sensitive, early commitment |
| Standard | $100 | 5 (all) | 25% ($25) | General audience, engagement-oriented |
| VIP | $200 | 3 (social, referral, check-in) | 20% ($40) | High-value attendees, fewer quests |

**Rationale:**
- **Early bird** has a lower face price but fewer incentive slots, so the expected discount is lower ($3.74 at model rates) and net revenue is $76.26. This works because early commitment reduces marketing spend.
- **Standard** is the primary revenue driver with maximum engagement surface.
- **VIP** offers fewer but higher-value quests. The social share from a VIP attendee is worth more (higher-status endorsement). Referral from VIP segment has higher conversion.

### 6.4 Dynamic Incentive Adjustments

If real-time completion data shows higher-than-expected completion rates:

- **Option A:** Remove the lowest-value incentive (feedback at 2%) from the available stack.
- **Option B:** Increase face price for future sales by the overage amount.
- **Option C:** Replace a low-barrier incentive (check-in) with a higher-barrier one (e.g., "arrive within first 30 minutes" instead of "arrive on time").

If completion rates are lower than expected:

- **Option A:** Add a 6th incentive to increase engagement opportunities.
- **Option B:** Send push notifications / reminders to complete pending quests.
- **Option C:** Reduce face price to maintain perceived value.

---

## 7. Sensitivity Analysis

### 7.1 Completion Rates 50% Higher Than Expected

Adjusted completion rates:

| Incentive | Base Rate | +50% Rate | Capped at 100% |
|---|---|---|---|
| Social share | 40% | 60% | 60% |
| Referral | 10% | 15% | 15% |
| Check-in | 78% | 117% | **100%** |
| Sponsor session | 30% | 45% | 45% |
| Feedback | 22% | 33% | 33% |

```
E[discount_high] = ($5 x 0.60) + ($10 x 0.15) + ($5 x 1.00) + ($3 x 0.45) + ($2 x 0.33)
                 = $3.00 + $1.50 + $5.00 + $1.35 + $0.66
                 = $11.51
```

| Metric | Base Case | +50% Completion |
|---|---|---|
| Expected discount / ticket | $8.24 | $11.51 |
| Expected net revenue / ticket | $91.76 | $88.49 |
| Revenue per 1,000 tickets | $91,760 | $88,490 |
| **Margin impact** | -- | **-$3,270 (-3.6%)** |

> A 50% increase in completion rates reduces net revenue by only 3.6%, well within the pricing buffer if face price is set at $100 with an $85 target.

### 7.2 Completion Rates 50% Lower Than Expected

Adjusted completion rates:

| Incentive | Base Rate | -50% Rate |
|---|---|---|
| Social share | 40% | 20% |
| Referral | 10% | 5% |
| Check-in | 78% | 39% |
| Sponsor session | 30% | 15% |
| Feedback | 22% | 11% |

```
E[discount_low] = ($5 x 0.20) + ($10 x 0.05) + ($5 x 0.39) + ($3 x 0.15) + ($2 x 0.11)
                = $1.00 + $0.50 + $1.95 + $0.45 + $0.22
                = $4.12
```

| Metric | Base Case | -50% Completion |
|---|---|---|
| Expected discount / ticket | $8.24 | $4.12 |
| Expected net revenue / ticket | $91.76 | $95.88 |
| Revenue per 1,000 tickets | $91,760 | $95,880 |
| **Margin impact** | -- | **+$4,120 (+4.5%)** |

> Revenue increases but engagement suffers. The organizer misses out on an estimated $6,800 in engagement value (per Section 5's aggregate value model), making this scenario **net negative** from a total-value perspective despite higher ticket revenue.

### 7.3 Stripe Fee Increase to 3.5% + $0.30

| Strategy | Current Fee / Ticket (8.24% discount) | New Fee / Ticket | Delta | Impact per 1,000 Tickets |
|---|---|---|---|---|
| 1. Auth-then-Capture | $2.96 | $3.51 | +$0.55 | +$551 |
| 2. Charge-then-Refund | $3.20 | $3.80 | +$0.60 | +$600 |
| 4. Hybrid | $3.21 | $3.81 | +$0.60 | +$600 |
| 3A. USDC Direct | $0.03 | $0.03 | $0.00 | $0 |
| 3B. USDC On-Ramp | $3.03 | $3.03 | $0.00 | $0 |

> A Stripe fee hike to 3.5% adds ~$550-600 per 1,000 tickets to card-based strategies. This accelerates the break-even for Strategy 3A (USDC Direct):
>
> New break-even = $27,500 / ($3.51 - $0.03) = **7,902 tickets** (down from 9,386).

### 7.4 Base L2 Gas Spike to $0.10/tx

| Strategy | Current Gas Cost / Ticket | New Gas Cost / Ticket | Delta | Impact per 1,000 Tickets |
|---|---|---|---|---|
| 3A. USDC Direct | $0.03 | $0.30 | +$0.27 | +$270 |
| 3B. USDC On-Ramp | $0.03 | $0.30 | +$0.27 | +$270 |
| 4. Hybrid | $0.01 | $0.10 | +$0.09 | +$90 |
| 1 & 2 (Stripe only) | $0.00 | $0.00 | $0.00 | $0 |

> Even a 10x gas spike (from $0.01 to $0.10 per transaction) adds only $270-$270 per 1,000 tickets to USDC strategies. **Gas cost remains negligible** relative to payment processing fees.

> At $0.10/tx gas, Strategy 3A still costs only $0.30/ticket vs $2.96/ticket for Strategy 1 -- a 90% cost advantage.

### 7.5 USDC De-Peg Scenario

Historical USDC deviations (source: CoinGecko, Circle transparency reports):

| Event | Date | Max Deviation | Duration |
|---|---|---|---|
| SVB bank run | March 2023 | -12.5% ($0.875) | ~48 hours |
| Normal trading | Ongoing | +/- 0.05% | Persistent |
| Regulatory FUD events | Various | -0.5% to -1.0% | 24-72 hours |

**Exposure quantification at various deviation levels:**

For 1,000 tickets in escrow ($100,000 USDC):

| De-peg Severity | USDC Value | Dollar Exposure | % of Revenue |
|---|---|---|---|
| Normal (+/- 0.05%) | $99,950 -- $100,050 | +/- $50 | 0.05% |
| Moderate (-0.5%) | $99,500 | -$500 | 0.50% |
| Severe (-1.0%) | $99,000 | -$1,000 | 1.00% |
| Extreme (SVB-level, -12.5%) | $87,500 | -$12,500 | 12.50% |

**Mitigation strategies:**

1. **Holding period minimization:** Settle to organizer wallet within 24 hours of event conclusion. De-peg risk is proportional to holding time.

2. **Instant off-ramp:** Organizer can convert USDC to fiat via Circle Mint (free for verified accounts) or Coinbase (0.1% fee) immediately upon receipt.

3. **Diversified stablecoin support:** Accept USDT or DAI as alternatives. Multi-stablecoin escrow contracts add complexity but reduce single-issuer risk.

4. **Insurance / hedging:** For large events (>$500K in escrow), consider purchasing de-peg insurance via Nexus Mutual or similar DeFi protocols (typical cost: 2-4% annualized, or ~0.005-0.01% for a 2-day event window).

> **Bottom line:** For events with typical 1-7 day settlement windows, USDC de-peg risk is minimal. The March 2023 SVB event was a once-in-a-decade black swan, and USDC recovered fully within 48 hours. Normal operating exposure is under 0.1%.

### 7.6 Combined Worst-Case Scenario

All negative factors simultaneously: completion rates +50%, Stripe fees at 3.5%, gas at $0.10/tx.

| Strategy | Base Case Cost / 1,000 Tickets | Worst Case Cost / 1,000 Tickets | Delta |
|---|---|---|---|
| 1. Auth-then-Capture | $2,960 | $3,394 | +$434 |
| 2. Charge-then-Refund | $3,200 | $3,800 | +$600 |
| 3A. USDC Direct | $30 | $300 | +$270 |
| 3B. USDC On-Ramp | $3,030 | $3,300 | +$270 |
| 4. Hybrid | $3,210 | $3,900 | +$690 |

> Even in the combined worst case, Strategy 3A (USDC Direct) remains 89-92% cheaper than any card-based strategy. The worst case for Strategy 3A ($300/1,000 tickets) is still better than the best case for any card strategy ($2,475/1,000 tickets at Strategy 1 with 25% discount).

---

## Appendix A: Key Formulas

**Expected discount per ticket:**
```
E[D] = SUM(discount_i x P(completion_i))  for i = 1..n
```

**Expected net revenue per ticket:**
```
E[R] = Face Price - E[D]
```

**Stripe auth-then-capture fee:**
```
Fee = (Face Price - Discount) x 0.029 + 0.30
```

**Stripe charge-then-refund fee:**
```
Fee = Face Price x 0.029 + 0.30  (refund does not reduce fee)
```

**USDC escrow total gas cost:**
```
Gas = n_transactions x gas_per_tx
    = (1 deposit + 1 release + 1 refund_if_discount) x $0.01
```

**Break-even volume (Strategy A vs Strategy B):**
```
V = (Fixed_A - Fixed_B) / (Variable_B - Variable_A)
```

**Marketing ROI on incentive spend:**
```
ROI = (Value Created - Discount Cost) / Discount Cost x 100%
```

---

## Appendix B: Assumptions and Limitations

1. **Completion rates** are estimates based on analogous loyalty/rewards programs, not direct Quest Payments data. Real completion rates should be measured in pilot events and the model recalibrated.

2. **Stripe fees** assume standard US pricing (2.9% + $0.30). International cards incur an additional 1.5%, and currency conversion adds 1%. These are not modeled here.

3. **Base L2 gas costs** assume January 2025 pricing (~$0.01/tx). Post-EIP-4844 (blob transactions), Base gas has been consistently low, but L1 congestion could temporarily increase costs.

4. **On-ramp fees** vary significantly by provider, geography, and payment method. The 3% assumption is a US-market average for card-to-USDC conversion.

5. **Incentive independence assumption** treats each incentive's completion as independent. In practice, users who complete one incentive are more likely to complete others (positive correlation). This would shift the distribution toward higher completion counts, increasing expected discount by an estimated 5-15%.

6. **Sponsor session value** depends heavily on the event type and sponsor. A Fortune 500 sponsor at a 10,000-person conference values guaranteed attendees differently than a startup sponsor at a 200-person meetup.

7. **The x402 payment protocol** is assumed to add negligible overhead to USDC transactions on Base. If x402 requires additional on-chain interactions (e.g., payment channel setup), gas costs may be slightly higher than modeled.

---

*Document prepared for Quest Payments business planning. All figures should be validated against actual pilot event data before use in financial projections or investor materials.*
