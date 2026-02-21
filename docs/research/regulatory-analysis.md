# Regulatory Analysis

> Research for Quest Payments — Issue #4
>
> **Disclaimer:** This is preliminary research for project planning purposes only. It does not constitute legal advice. Quest Payments must consult qualified legal counsel before launching any commercial operations.

---

## Summary

Quest Payments operates at the intersection of event ticketing, conditional pricing, and stablecoin payments. The regulatory surface spans money transmission, consumer protection, financial regulation, data privacy, and tax. This document identifies the key issues by jurisdiction.

---

## 1. Money Transmitter Licensing

### Federal (United States)

The Financial Crimes Enforcement Network (FinCEN) regulates "money services businesses" (MSBs). An MSB must register with FinCEN and maintain an AML/BSA compliance program.

**Quest Payments' exposure depends on the flow of funds:**

| Flow | MSB risk |
|---|---|
| Credit card → Stripe → Organizer (Stripe is the processor) | **Low.** Stripe holds the MTL; Quest Payments is a merchant |
| USDC cashback from Organizer wallet → Buyer wallet | **Medium.** Transmitting value on behalf of others may trigger MSB classification if Quest Payments holds the USDC in transit |
| USDC escrow contract (buyer → contract → organizer) | **High.** Smart contract-mediated custody likely constitutes money transmission |

**Key question:** Does Quest Payments *hold* or *control* funds, or does it merely *facilitate* the transfer? If the backend only instructs a pre-approved smart contract or the organizer's own wallet to transfer funds, the money transmission argument weakens.

**Mitigation:** Structure the escrow so that the organizer deploys and controls the smart contract. Quest Payments acts as a software provider only (i.e., does not hold private keys or control fund flows directly).

### State Licensing

47 states + DC + Puerto Rico have money transmitter statutes. Penalties for unlicensed transmission range from $10K–$10M per violation. Key states:

| State | Notes |
|---|---|
| New York (BitLicense) | Requires a separate BitLicense for virtual currency business |
| California | CA DFO Money Transmission Act; "stored value" provisions |
| Texas | Finance Code Chapter 151 |
| Florida | FL Office of Financial Regulation |

**Strategy:** Launch exclusively in states where the organizer is the licensed transmitter (or where Stripe's coverage applies). Defer state-by-state licensing until revenue justifies it.

---

## 2. Stablecoin Custody Regulations

### Current US Landscape (2026)

The Lummis-Gillibrand Payment Stablecoin Act (anticipated passage 2025) establishes federal licensing for payment stablecoin issuers. Key provisions:

- 1:1 reserve requirement (cash, T-bills)
- Monthly reserve attestations
- Federal or state chartering

**Quest Payments' position:** Quest Payments does not *issue* stablecoins — it uses USDC (issued by Circle). As a *user* of a regulated stablecoin, the primary obligation is to comply with Circle's terms of service and applicable AML obligations, not to obtain a stablecoin issuer license.

### Custodial vs. Non-Custodial

- **Non-custodial (recommended):** Funds flow directly from buyer wallet → escrow contract → organizer/buyer. Quest Payments never holds private keys.
- **Custodial:** Quest Payments holds buyer USDC in a managed wallet. Triggers bank-like custody regulations and significantly higher compliance burden.

---

## 3. Consumer Protection Laws for Conditional Pricing

### US Federal Trade Commission (FTC)

The FTC Act prohibits unfair or deceptive acts. Conditional pricing (price depends on completing actions) must be:

1. **Clearly disclosed upfront** — the full price and each discount action must be shown before purchase
2. **Achievable** — discount conditions must be realistically completable
3. **Time-limited disclosures** — if the discount window expires, the buyer must be informed

**Best practice:** Display a "Quest summary" showing the base price, each available discount, and the maximum possible savings on the checkout page. Require explicit buyer acknowledgment before purchase.

### State Consumer Protection

Most states follow FTC guidance. Notable exceptions:

| State | Issue |
|---|---|
| California (CLRA/UCL) | Aggressive enforcement; "unfair" practices broadly construed |
| New York (GBL § 349) | Private right of action for deceptive business practices |
| Illinois (ICFA) | Similar private right of action |

**Recommendation:** Require clear terms and conditions; provide a discount summary and FAQ. Include an explicit right to pay the base price without completing quests.

---

## 4. PCI DSS Compliance

Quest Payments itself does not store, process, or transmit raw card data — this is handled entirely by Stripe. However, the platform must meet the requirements of a **PCI DSS SAQ A** merchant (the lowest tier, applicable to merchants that outsource all card processing to a PCI-certified third party).

SAQ A requirements:
- No card data stored on Quest Payments servers
- Secure checkout page (HTTPS, no inline scripts from unknown sources)
- Annual self-assessment questionnaire
- Vulnerability scans (quarterly, by an ASV)

**Stripe's coverage:** Stripe is a PCI Level 1 certified Service Provider. Using Stripe.js / Stripe Elements (not custom card input fields) keeps Quest Payments out of PCI scope for card data.

---

## 5. Data Privacy

### CCPA (California Consumer Privacy Act)

If Quest Payments collects personal information from California residents and meets the CCPA thresholds (>$25M revenue, or processes >100K consumers, or derives >50% revenue from selling data), it must:

- Provide a "Do Not Sell My Personal Information" link
- Respond to consumer data requests within 45 days
- Maintain a privacy policy describing data collection and use

**Data collected by Quest Payments:**
- Purchase records (name, email, ticket tier, incentive completion status)
- Social share URLs (pseudonymous)
- Wallet addresses (potentially pseudonymous)

### GDPR (EU/UK)

If any event attendees are EU/UK residents, GDPR applies. Key obligations:

- Lawful basis for processing (contract performance is the basis for purchase data)
- Data minimization (collect only what is needed for incentive verification)
- Right to erasure — buyers can request deletion of their data after the event
- Data transfer mechanisms if processing occurs outside the EU (Standard Contractual Clauses)

**Wallet addresses under GDPR:** A wallet address may constitute personal data if it can be linked to an identified individual. Treat wallet addresses as personal data and document the lawful basis for processing.

---

## 6. Securities Law Analysis

### Are Incentive Discounts Securities?

Incentive discounts (e.g., "refer a friend for -10%") are **not securities** because:
- They represent a price reduction on a service (event ticket), not an investment
- Buyers are not investing in a common enterprise with expectation of profit
- The discount value is fixed, not variable based on market performance

### Is USDC a Security?

USDC is a payment stablecoin, not a security under the Howey test:
- No expectation of profit from the efforts of others
- 1:1 redeemable for USD
- Circle has received informal guidance from SEC that USDC is not a security

**Risk:** SEC enforcement posture on stablecoins is still evolving. Monitor for regulatory updates.

### Token Rewards

If Quest Payments later introduces a native token or points system redeemable for non-event goods/services, the securities analysis changes materially. Any token launch should have a separate legal review.

---

## 7. Tax Implications

### Organizer

- Revenue = ticket sales (net of earned discounts actually paid out)
- USDC payments are treated as USD-denominated receipts at fair market value on the date received
- USDC-to-USD conversion may trigger a taxable event at the organizer level; consult a CPA

### Buyer

- Discounts received as cash-back from completing incentives may be treated as:
  - **Rebates** (non-taxable if tied to a purchase price reduction), or
  - **Income** (taxable if structured as a reward for services rendered)
- The framing matters: "discount on the price of a ticket you already paid" → rebate (non-taxable). "Payment for sharing on social media" → income (taxable).
- USDC cashback received may have a cost basis of $0 if received as a rebate.

**Recommendation:** Frame all discounts as price reductions at time of settlement, not as rewards for services.

---

## Jurisdictional Launch Strategy

| Phase | Geography | Rationale |
|---|---|---|
| MVP | United States (non-NY) | Avoid NY BitLicense; Stripe covers MTL exposure |
| V1 | + New York | Obtain or work under a licensed partner's NY MTL |
| V2 | + EU/UK | Add GDPR compliance layer; evaluate EMI licensing |
| V3 | Global | Full multi-jurisdiction compliance program |
