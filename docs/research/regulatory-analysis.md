# Regulatory Analysis: Quest Payments

> **Disclaimer:** This document is for research and planning purposes only and does not constitute legal advice. Quest Payments should engage qualified fintech and cryptocurrency legal counsel before launching any product or service described herein. Regulatory landscapes evolve rapidly; all citations and interpretations should be independently verified with current sources.

---

## Table of Contents

1. [Money Transmission](#1-money-transmission)
2. [Stablecoin Regulation](#2-stablecoin-regulation)
3. [Consumer Protection](#3-consumer-protection)
4. [PCI DSS Compliance](#4-pci-dss-compliance)
5. [Data Privacy](#5-data-privacy)
6. [Securities Law](#6-securities-law)
7. [Tax Implications](#7-tax-implications)
8. [Jurisdictional Strategy](#8-jurisdictional-strategy)
9. [Risk Mitigation Recommendations](#9-risk-mitigation-recommendations)

---

## 1. Money Transmission

### 1.1 Federal FinCEN MSB Registration

The Bank Secrecy Act (BSA), codified at 31 U.S.C. sections 5311-5330 and implemented through regulations at **31 CFR Part 1010**, defines a "money services business" (MSB) to include "money transmitters." Under **31 CFR 1010.100(ff)(5)**, a money transmitter is any person that provides money transmission services, defined as "the acceptance of currency, funds, or other value that substitutes for currency from one person and the transmission of currency, funds, or other value that substitutes for currency to another person or location, by any means."

**When does holding or transmitting USDC constitute money transmission?**

FinCEN's 2019 guidance (FIN-2019-G001, "Application of FinCEN's Regulations to Certain Business Models Involving Convertible Virtual Currencies") clarified that:

- **Administrators and exchangers** of convertible virtual currency (CVC) are money transmitters under federal law, regardless of whether the CVC is centralized or decentralized.
- A person that accepts and transmits value in CVC -- including stablecoins like USDC -- from one person to another person or location is a money transmitter.
- The key question is whether Quest Payments **accepts and transmits** USDC on behalf of others, or whether it merely **uses** USDC as a settlement mechanism for its own transactions.

If Quest receives fiat credit card payments from buyers and settles with event organizers in USDC, Quest is arguably accepting value (fiat) from one party and transmitting value (USDC) to another. This pattern maps closely to FinCEN's definition of money transmission.

However, several exemptions may apply (see below).

**Registration requirement:** If classified as an MSB, Quest must register with FinCEN within 180 days of formation (31 CFR 1022.380), implement an anti-money laundering (AML) program (31 CFR 1022.210), file Currency Transaction Reports (CTRs) for transactions over $10,000, and file Suspicious Activity Reports (SARs) for suspicious transactions of $2,000 or more (31 CFR 1022.320).

### 1.2 State Money Transmitter License (MTL) Requirements

Beyond federal registration, money transmission is regulated at the state level. **49 states plus the District of Columbia** require money transmitter licenses (Montana is the sole exception as of this writing). Each state has its own:

- **Application process and fees**: ranging from $500 (some smaller states) to $50,000+ (New York)
- **Surety bond requirements**: typically $25,000 to $2,000,000 depending on state and volume
- **Net worth or capital requirements**: often $100,000 to $500,000 minimum
- **Permissible investments** for customer funds
- **Examination and audit requirements**
- **Renewal timelines and ongoing compliance**

The Nationwide Multistate Licensing System (NMLS) has streamlined the process somewhat, but obtaining licenses in all required states remains expensive and time-consuming -- typically 12-18 months and $1M-$2M in legal and compliance costs for a full 50-state program.

**Key state statutes:**
- New York: Banking Law Article 13-B (money transmission), 23 NYCRR Part 200 (BitLicense)
- California: Money Transmission Act, Cal. Fin. Code Division 1.2, sections 2000-2172 (as amended by the Digital Financial Assets Law, effective July 2025)
- Texas: Tex. Fin. Code Chapter 151 (Money Services Act)
- Florida: Fla. Stat. Chapter 560 (Money Services Businesses)
- Illinois: Transmitters of Money Act, 205 ILCS 657

### 1.3 Agent-of-Payee Exemption

The most promising exemption for Quest's model is the **agent-of-payee** (or "payment processor") exemption. Under FinCEN's 2014 ruling (FIN-2014-R001) and the 2019 CVC guidance:

> A person is exempt from money transmitter status if the person "acts as a payment processor to facilitate the purchase of, or payment of a bill for, a good or service through a clearance and settlement system by agreement with the creditor or seller."

**Application to Quest:**

If Quest enters into contractual agreements with event organizers (the "payees") establishing Quest as the organizer's agent for purposes of collecting payment, Quest may qualify for this exemption. The critical elements are:

1. **Written agency agreement** between Quest and each event organizer
2. Quest must be collecting payment **on behalf of the organizer** for a specific good/service (event tickets)
3. The buyer must have a **pre-existing obligation** to the organizer (i.e., the ticket purchase)
4. Settlement to the organizer must occur through **established clearance and settlement mechanisms**

**State-level agent-of-payee exemptions** vary significantly. While the Uniform Money Services Act (UMSA) adopted in some states includes an agent-of-payee exemption, not all states follow the same approach:

- **Broad exemption states**: Texas, Washington, and several others explicitly exempt payment processors acting as agents of payees.
- **Narrow or no exemption states**: Connecticut, New York, and a few others either lack the exemption or interpret it narrowly.
- **Crypto-specific carve-outs**: Some states have clarified (or declined to clarify) whether the exemption applies to crypto-settled transactions.

**Risk factor:** The USDC settlement leg complicates the agent-of-payee argument. Regulators may view the conversion from fiat to USDC as a separate act of value substitution that falls outside the traditional payment-processor exemption. Quest should obtain state-specific legal opinions on this point.

### 1.4 Payment Processor Exemption Under Federal and State Law

Separate from the agent-of-payee exemption, there is a general **payment processor** exemption under federal law. Per 31 CFR 1010.100(ff)(5)(ii)(A), "a person that operates a clearance and settlement system" is not a money transmitter solely because of that function. Additionally, FinCEN's 2019 guidance distinguishes between:

- **Money transmitters**: those that accept and transmit value as a business
- **Payment processors**: those that facilitate payments between buyers and sellers through existing banking relationships

If Quest integrates with Stripe for card acquisition and Circle/Coinbase for USDC settlement, and does not itself hold or custody USDC (instead using programmatic pass-through via x402), Quest may argue it is a technology platform facilitating payment processing rather than a money transmitter.

### 1.5 x402 Facilitator Model

The x402 protocol enables HTTP-native payments where a facilitator (such as Coinbase) mediates USDC transactions on Base L2. In this model:

- **Coinbase acts as the facilitator**: Coinbase is a registered MSB with FinCEN and holds money transmitter licenses in most US states. As the facilitator handling the actual USDC transfer, Coinbase absorbs significant regulatory burden.
- **Quest's role becomes more limited**: Quest initiates payment requests and receives confirmation, but the actual value transmission occurs through Coinbase's infrastructure.
- **Regulatory delegation**: By routing USDC settlement through a licensed facilitator, Quest can argue it never takes custody of the USDC. The value flows from Stripe (fiat) to the buyer's bank, and separately, from Coinbase (USDC) to the organizer's wallet -- with Quest acting as the orchestration layer.

This model materially reduces Quest's regulatory exposure, though it does not eliminate the need for a legal analysis of Quest's own classification.

### 1.6 Practical Path: Licensed Partner Strategy

**Recommendation:** Rather than pursuing Quest's own MSB registration and state MTL program, Quest should rely on licensed partners to cover the regulated activities:

| Activity | Licensed Partner | Regulatory Coverage |
|---|---|---|
| Credit card acquisition | Stripe | PCI DSS, card network rules, state MTLs |
| USDC issuance/redemption | Circle | FinCEN MSB, state MTLs (all 50 states), NY BitLicense |
| USDC transmission on Base | Coinbase (x402 facilitator) | FinCEN MSB, state MTLs (most states), NY BitLicense |
| Fiat banking | Stripe Treasury or partner bank | FDIC-insured, state banking charter |

Under this model, Quest positions itself as a **technology platform** that coordinates licensed partners rather than as a money transmitter itself. This is similar to the approach taken by many fintech companies (e.g., how Shopify uses Stripe for payments without itself holding an MTL).

**Still required for Quest:**
- FinCEN registration as an MSB may still be prudent as a precautionary measure (low cost, ~$0)
- An AML/KYC program proportionate to Quest's role
- Legal opinions on money transmission status in priority operating states
- Monitoring for regulatory changes

---

## 2. Stablecoin Regulation

### 2.1 US Regulatory Landscape

The regulation of stablecoins in the United States is in active development. Key frameworks and guidance include:

**Office of the Comptroller of the Currency (OCC):**
- **Interpretive Letter 1174 (January 2021)**: National banks may use stablecoins and participate in independent node verification networks (blockchains) for payment activities. This legitimizes bank involvement in stablecoin settlement.
- **Interpretive Letter 1172 (January 2021)**: Banks may hold stablecoin reserves.
- These OCC letters provide a degree of regulatory clarity that supports the use of USDC in payment settlement.

**SEC vs. CFTC Jurisdiction:**
- The **SEC** has generally focused on tokens that constitute securities under the Howey test. The SEC has not formally classified USDC as a security. In 2023, the SEC closed its investigation into Paxos (issuer of BUSD) without enforcement action, which was widely seen as supportive of the position that regulated, dollar-backed stablecoins are not securities.
- The **CFTC** has asserted jurisdiction over certain stablecoins as "commodities" in enforcement actions (CFTC v. Tether, no formal ruling on classification). However, the CFTC's position primarily matters in the context of derivatives and leveraged trading, not spot payment usage.
- Congressional proposals (e.g., the Clarity for Payment Stablecoins Act, the Lummis-Gillibrand Responsible Financial Innovation Act) have sought to establish a dedicated federal framework for payment stablecoins, separate from securities regulation. As of this writing, no comprehensive federal stablecoin legislation has been enacted, but bipartisan momentum is notable.

**Federal Reserve:**
- The Fed has issued discussion papers on the potential design of a US central bank digital currency (CBDC) and has expressed concern about privately issued stablecoins.
- **Regulation J** and the Fed's authority over payment systems could become relevant if stablecoins are reclassified or if a federal payment stablecoin framework is enacted.

### 2.2 USDC Specifically

USDC, issued by Circle Internet Financial, LLC, is one of the best-positioned stablecoins from a regulatory perspective:

- **Circle is a licensed money transmitter** registered with FinCEN and holding state money transmitter licenses in all 50 US states plus the District of Columbia.
- **New York**: Circle holds a BitLicense from NYDFS.
- **Reserves**: USDC is backed 1:1 by US dollar assets held in regulated financial institutions, consisting of US Treasury securities and cash deposits. Reserves are held at BNY Mellon and managed by BlackRock (the Circle Reserve Fund, a registered 2a-7 government money market fund).
- **Auditing**: Circle undergoes regular third-party attestation by Deloitte (SOC 2 Type II reports) confirming reserve backing.
- **MiCA compliance**: Circle obtained an Electronic Money Institution (EMI) license in France, making USDC the first major stablecoin to achieve MiCA compliance in the EU (see Section 2.3).
- **Base L2 nativity**: USDC is natively issued on Base (Coinbase's L2), meaning transfers on Base use Circle's native USDC contracts rather than bridged assets, reducing smart contract risk.

**Implication for Quest:** Using USDC provides Quest with the most defensible stablecoin choice. Circle's comprehensive regulatory posture reduces the risk that USDC itself becomes a regulatory liability.

### 2.3 EU MiCA Framework

The **Markets in Crypto-Assets Regulation (MiCA)**, which came into full effect in the EU on December 30, 2024, establishes a comprehensive framework for crypto-assets including stablecoins:

- **Asset-Referenced Tokens (ARTs)** and **E-Money Tokens (EMTs)**: USDC is classified as an EMT under MiCA because it is pegged to a single fiat currency (USD).
- **EMT requirements**: Issuers must be authorized as credit institutions or electronic money institutions in an EU member state. Circle obtained this authorization in France.
- **Volume caps**: MiCA imposes restrictions on stablecoins that are "significant" -- if a non-EUR stablecoin exceeds certain transaction volume thresholds (1 million transactions or EUR 200 million daily transaction volume within the EU), the issuer faces additional requirements.
- **Impact on Quest**: If Quest serves events in the EU, USDC settlement is permissible under MiCA (given Circle's EMI license), but Quest should monitor whether USDC approaches the significance thresholds and should comply with EU-specific payment and consumer protection regulations.

### 2.4 B2B Settlement vs. B2C Offering

The regulatory treatment differs substantially depending on who interacts with USDC:

**B2B Settlement (Quest settles with organizers in USDC):**
- Lower regulatory scrutiny: B2B settlement in stablecoins is analogous to commercial wire transfers and is generally treated as a business payment arrangement.
- Organizers receiving USDC are presumably sophisticated parties who understand cryptocurrency.
- This model keeps consumer-facing interactions entirely in fiat (credit card), reducing consumer protection concerns.
- **This is Quest's primary model and the preferable approach from a regulatory perspective.**

**B2C Offering (Stablecoin cashback to buyers):**
- Higher regulatory scrutiny: Offering USDC directly to consumers implicates additional regulations:
  - State money transmitter laws (delivering value to consumers)
  - Consumer protection disclosures (what is USDC, how to use it, risks)
  - KYC/AML requirements (who is receiving the USDC)
  - Potential securities concerns if the cashback structure implies investment returns
- **If Quest implements stablecoin cashback**, it must either:
  - Route the USDC through a licensed partner (Coinbase wallet, Circle account) so Quest never directly transmits USDC to consumers, or
  - Offer the cashback as a fiat credit/refund to the buyer's original payment method (credit card refund), avoiding crypto-to-consumer delivery entirely.

### 2.5 State-Specific Crypto Regulations

**New York -- BitLicense (23 NYCRR Part 200):**
- Any entity engaging in "virtual currency business activity" involving New York residents must obtain a BitLicense from NYDFS.
- "Virtual currency business activity" includes transmitting, storing, or converting virtual currency.
- The BitLicense application is notoriously expensive ($5,000 filing fee, plus $50,000-$100,000+ in legal costs) and slow (12-24 months).
- Quest should assess whether its model constitutes "virtual currency business activity" in New York. If Quest itself never holds or transmits USDC (relying on Coinbase/Circle), it may not need a BitLicense -- but NYDFS's interpretation is broad and fact-specific.

**Wyoming -- Special Purpose Depository Institution (SPDI) and Digital Asset Framework:**
- Wyoming has enacted over 25 blockchain-enabling laws since 2018, codified primarily in Wyo. Stat. sections 34-29-101 through 34-29-106 (Wyoming Digital Asset Act) and sections 13-12-101 through 13-12-115 (SPDI Act).
- Wyoming explicitly exempts certain crypto activities from money transmitter licensing (Wyo. Stat. section 40-22-104(a)(vi)).
- Wyoming provides a favorable regulatory environment for crypto-native businesses.

**Texas:**
- The Texas Department of Banking issued Supervisory Memorandum 1037 (2019, updated 2021), clarifying that virtual currencies are not "money" under the Texas Money Services Act (Tex. Fin. Code Chapter 151), and therefore certain virtual currency activities may not require a money transmitter license.
- However, Texas has since nuanced this position: if a business receives fiat and delivers crypto (or vice versa), that may constitute money transmission.
- Quest should obtain a Texas-specific legal opinion given the state's importance as a market.

**California:**
- The Digital Financial Assets Law (DFAL), signed in 2023 and effective July 1, 2025, establishes a licensing regime for businesses engaged in "digital financial asset business activity" -- which includes exchanging, transferring, or storing digital financial assets on behalf of others.
- Quest's USDC settlement activities may trigger DFAL licensing if Quest is deemed to be "transferring" digital financial assets. Again, the licensed-partner model is the preferred mitigation.

---

## 3. Consumer Protection

### 3.1 FTC Act Section 5: Deceptive Pricing Practices

Section 5 of the Federal Trade Commission Act (15 U.S.C. section 45) prohibits "unfair or deceptive acts or practices in or affecting commerce." The FTC has extensive guidance on pricing representations:

**FTC Guides Against Deceptive Pricing (16 CFR Part 233):**
- A price is "deceptive" if it creates a false impression of the savings available to the purchaser.
- **Conditional pricing** (where the advertised price requires the buyer to take specific actions) must be clearly and conspicuously disclosed.
- The FTC's 2022 enforcement policy statement on "dark patterns" and deceptive design practices is directly relevant: any UI or marketing that makes the conditional nature of the discount unclear could constitute a deceptive practice.

**Application to Quest:**
- If Quest advertises "tickets from $75" but the base price is $100 and the $75 price requires completing all incentive actions, this is likely deceptive. The FTC's position is that the "from" price must be the price that a substantial number of consumers actually pay, or the conditions must be immediately and conspicuously disclosed.
- **Required approach**: Advertise the base price ($100) and clearly indicate that up to $25 can be earned by completing specific actions. Example: "Tickets: $100. Earn up to $25 back by completing quests."
- **Drip pricing**: The FTC's October 2024 "junk fees" rule (the Trade Regulation Rule on Unfair or Deceptive Fees) targets the practice of advertising a lower price and adding mandatory fees later. While Quest's incentive discounts are not mandatory fees, the principle applies in reverse: do not advertise a price that most consumers cannot or will not achieve.

### 3.2 State Consumer Protection Laws on Dynamic/Conditional Pricing

Most states have "Little FTC Acts" that parallel federal deceptive practices law, and many impose stricter requirements:

- **California Business and Professions Code section 17500**: Prohibits untrue or misleading advertising. California courts have interpreted this broadly.
- **New York General Business Law sections 349-350**: Deceptive acts and false advertising. New York allows private rights of action with statutory damages.
- **Massachusetts 940 CMR 3.16**: Specific regulations on price advertising, including requirements for disclosing conditions on promotional pricing.

**Conditional pricing specific concerns:**
- Several states treat "conditional discounts" as a form of "bait-and-switch" if the conditions are onerous or unclear.
- Quest must ensure that the incentive actions are clearly described, achievable, and not designed to frustrate the buyer into paying the full price.

### 3.3 Advertising Rules

Beyond pricing, Quest must comply with advertising regulations:

- **FTC Endorsement Guides (16 CFR Part 255)**: If incentive actions include social media posting, sharing, or reviewing, and if Quest uses buyers' social media activity as promotional content, this implicates the FTC's endorsement disclosure requirements. Buyers must disclose any material connection (e.g., the fact that their post earned a discount).
- **CAN-SPAM Act (15 U.S.C. sections 7701-7713)** and **TCPA (47 U.S.C. section 227)**: If Quest sends promotional emails or texts about incentive opportunities, it must comply with opt-in/opt-out and consent requirements.
- **State truth-in-advertising laws**: Vary by state but generally require that all material terms of an offer be disclosed.

### 3.4 Refund Policy Requirements

Refund policies for event tickets are governed by a patchwork of state laws:

**California:**
- Cal. Civ. Code section 1723 et seq. (event ticket sales): Requires clear disclosure of refund policies at the time of purchase.
- Cal. Bus. & Prof. Code section 22507.5: Additional requirements for online ticket sellers.

**New York:**
- NY Arts and Cultural Affairs Law section 25.07 et seq.: Regulates ticket resale and imposes disclosure requirements.
- NYC Admin Code section 20-698.1: Additional NYC-specific ticket sale regulations.

**General requirements:**
- Most states require that refund policies be clearly and conspicuously disclosed before the consumer completes the purchase.
- If no refund policy is disclosed, many states presume a full refund right.
- Quest must address what happens to incentive rewards if a ticket is refunded: Are completed incentive rewards reversed? Is the refund based on the amount actually paid (after discounts) or the base price?

**Recommendation:** Clearly state that refunds are issued for the amount actually charged to the buyer's credit card. Incentive-based discounts that were delivered as stablecoin cashback present a complication: if the buyer received $25 in USDC cashback and then requests a refund, Quest may need to either (a) require return of the USDC or (b) deduct the cashback amount from the refund. Both approaches must be clearly disclosed in the Terms of Service.

### 3.5 Credit Card Dispute Rights Under Regulation Z (TILA)

The Truth in Lending Act (TILA, 15 U.S.C. section 1601 et seq.) and its implementing regulation, **Regulation Z (12 CFR Part 1026)**, provide consumers with important dispute rights:

- **Billing error disputes (12 CFR 1026.13)**: A cardholder may dispute a charge within **60 days** of the statement date on which the charge appeared. The card issuer must investigate and resolve the dispute, typically by issuing a provisional credit.
- **Unauthorized use (12 CFR 1026.12(b))**: Liability capped at $50 for unauthorized charges.
- **Claims and defenses (12 CFR 1026.12(c))**: For purchases over $50 within the cardholder's state (or within 100 miles of the billing address), the cardholder can assert claims and defenses against the card issuer that they could assert against the seller.

**Implications for Quest's incentive model:**
- If a buyer completes incentive actions and receives a USDC cashback discount, then later disputes the original credit card charge, Quest faces a potential double-loss scenario: the credit card charge is reversed (chargeback) AND the buyer retains the USDC cashback.
- **Mitigation**: Quest should implement a hold period on USDC cashback disbursement (e.g., 14-30 days after the event) to ensure the credit card transaction has settled and the chargeback window has partially elapsed. However, the full 60-day chargeback window cannot be fully waited out for pre-event cashback.
- **Chargeback management**: Quest should maintain comprehensive records of the transaction, incentive completion proofs, and cashback disbursements to contest unmerited chargebacks through Stripe's dispute process.

### 3.6 CFPB Considerations

The Consumer Financial Protection Bureau (CFPB), established under the Dodd-Frank Act (12 U.S.C. section 5491 et seq.), has authority over "covered persons" that offer or provide consumer financial products or services:

- **Novel payment mechanisms**: The CFPB has expressed interest in regulating emerging payment technologies, including crypto-based payments. In 2022, the CFPB issued orders to major tech companies and payment platforms seeking information about their payment practices.
- **Larger participant rule**: If Quest reaches sufficient scale, it could fall under CFPB's "larger participant" supervision authority for certain markets (12 CFR Part 1090).
- **Unfair, Deceptive, or Abusive Acts or Practices (UDAAP)**: The CFPB's UDAAP authority (12 U.S.C. section 5531) extends to conduct that is unfair (causes substantial injury not reasonably avoidable), deceptive (misleading representations), or abusive (takes unreasonable advantage of consumer vulnerabilities). The incentive mechanism must be designed to avoid any of these characterizations.

---

## 4. PCI DSS Compliance

### 4.1 PCI DSS Overview and SAQ Levels

The Payment Card Industry Data Security Standard (PCI DSS) is a contractual requirement (not a government regulation) imposed by the card networks (Visa, Mastercard, American Express, Discover) on all entities that store, process, or transmit cardholder data.

**Merchant levels by annual Visa transaction volume:**

| Level | Annual Transactions | Validation Requirement |
|---|---|---|
| Level 1 | > 6 million | Annual Report on Compliance (ROC) by Qualified Security Assessor (QSA), quarterly network scan by Approved Scanning Vendor (ASV) |
| Level 2 | 1-6 million | Annual Self-Assessment Questionnaire (SAQ), quarterly ASV scan |
| Level 3 | 20,000-1 million (e-commerce) | Annual SAQ, quarterly ASV scan |
| Level 4 | < 20,000 (e-commerce) or < 1 million (other) | Annual SAQ, quarterly ASV scan recommended |

Quest will almost certainly begin as a **Level 4** merchant and should plan for Level 3 as it scales.

### 4.2 Using Stripe Elements/Checkout: SAQ-A Eligibility

By integrating Stripe Elements, Stripe Checkout, or Stripe Payment Links, Quest can achieve **SAQ-A** eligibility -- the simplest and least burdensome self-assessment:

**SAQ-A requirements:**
- Card data is **entirely handled by Stripe** (a PCI DSS Level 1 Service Provider). The buyer enters card details into a Stripe-hosted iframe or redirect; card numbers never touch Quest's servers.
- Quest's web pages that include the Stripe payment form must be served over HTTPS/TLS.
- Quest must not store, process, or transmit cardholder data in any form.
- SAQ-A has approximately **22 requirements** (compared to 300+ for SAQ-D full assessment).

**What this means in practice:**
- Quest's frontend includes a `<script>` tag for Stripe.js and renders a Stripe Elements component.
- The buyer's card number, expiration date, and CVV are entered into the Stripe iframe and submitted directly to Stripe's servers.
- Quest receives only a Stripe PaymentIntent ID and confirmation of success/failure -- never the actual card data.
- This is the standard integration pattern for modern SaaS applications using Stripe.

### 4.3 Quest's Remaining PCI Responsibilities

Even under SAQ-A, Quest must:

1. **Secure API keys**: Stripe secret keys (sk_live_xxx) must be stored securely (environment variables, secrets manager -- never in source code or client-side JavaScript). Public keys (pk_live_xxx) are safe for client-side use.
2. **Access controls**: Limit access to the Stripe Dashboard, API keys, and payment-related infrastructure to authorized personnel only.
3. **TLS everywhere**: All pages that include Stripe Elements or communicate with Stripe APIs must use HTTPS with TLS 1.2 or higher.
4. **Annual self-assessment**: Complete the SAQ-A questionnaire annually (can be done through Stripe Dashboard for Stripe-integrated merchants).
5. **Incident response**: Maintain a plan for responding to suspected security incidents involving payment data (even though Quest does not handle card data, a compromise of Stripe API keys could enable unauthorized charges).
6. **Vendor management**: Ensure that any third-party services that interact with the payment flow (e.g., analytics scripts on the payment page) do not compromise the security of the Stripe integration.

### 4.4 Scope Delineation

- **In PCI scope**: Stripe's infrastructure (card acquisition, tokenization, processing).
- **Out of PCI scope**: Quest's USDC settlement via x402 on Base L2. PCI DSS applies only to payment card data; cryptocurrency transactions are not within PCI's purview.
- **Quest's application security**: While not PCI-mandated, Quest should implement standard application security practices (OWASP Top 10, dependency scanning, access controls, logging) for its own platform, particularly given that it handles financial transactions and personal data.

---

## 5. Data Privacy

### 5.1 CCPA/CPRA (California)

The California Consumer Privacy Act (Cal. Civ. Code section 1798.100 et seq.), as amended by the California Privacy Rights Act (CPRA), applies to businesses that collect personal information from California residents and meet certain thresholds (annual gross revenue >$25M, data on 100,000+ consumers/households, or derive 50%+ of revenue from selling/sharing personal information).

**Application to Quest:**

Quest collects the following categories of personal information relevant to CCPA/CPRA:

| Data Category | CCPA Category | Purpose |
|---|---|---|
| Name, email, phone | Identifiers | Account creation, ticket delivery |
| Credit card (via Stripe) | Financial information | Payment processing (Stripe is the data controller for card data) |
| Social media activity | Internet/electronic activity | Incentive verification |
| Location data | Geolocation | Check-in verification for events |
| Wallet addresses | Identifiers (arguably) | USDC cashback delivery |
| Verification proofs | Inferences / Internet activity | Incentive completion validation |

**Key CCPA/CPRA requirements:**
- **Notice at collection (section 1798.100)**: Quest must provide a privacy notice at or before the point of data collection, describing the categories of personal information collected and the purposes for which they are used.
- **Right to know (section 1798.110)**: Consumers can request disclosure of the specific personal information collected about them.
- **Right to delete (section 1798.105)**: Consumers can request deletion of their personal information, subject to exceptions (e.g., completing a transaction, legal obligations).
- **Right to opt out of sale/sharing (section 1798.120)**: If Quest "shares" personal information (e.g., sends social media verification data to third-party verification services), consumers must be able to opt out. A "Do Not Sell or Share My Personal Information" link must be prominent.
- **Sensitive personal information (CPRA section 1798.121)**: Precise geolocation is classified as "sensitive personal information" under CPRA, requiring additional disclosures and limitations on use.
- **Data minimization (CPRA section 1798.100(c))**: Collection must be "reasonably necessary and proportionate" to the disclosed purposes.

### 5.2 GDPR (EU/EEA)

If Quest serves events in EU/EEA countries or processes data of EU/EEA residents, the General Data Protection Regulation (Regulation (EU) 2016/679) applies.

**Key GDPR requirements:**

- **Lawful basis for processing (Article 6)**: Quest must identify a lawful basis for each processing activity:
  - Ticket purchase: **Contract performance** (Article 6(1)(b))
  - Incentive verification: **Consent** (Article 6(1)(a)) -- the buyer opts into the incentive program
  - Marketing/analytics: **Legitimate interest** (Article 6(1)(f)) with a balancing test, or consent
- **Data minimization (Article 5(1)(c))**: Collect only what is strictly necessary. If verifying a social media action, collect only the proof of the specific action, not the buyer's entire social media profile.
- **Right to erasure (Article 17)**: Buyers can request deletion of their personal data. Quest must be able to delete verification proofs and associated data upon request, subject to lawful retention requirements.
- **Data Protection Impact Assessment (DPIA) (Article 35)**: Required for processing that is "likely to result in a high risk to the rights and freedoms of natural persons." Processing social media activity and geolocation data for verification purposes likely triggers a DPIA requirement.
- **Cross-border data transfers (Chapter V)**: If Quest is US-based and processes EU data, it must ensure adequate safeguards for data transfers (e.g., EU-US Data Privacy Framework, Standard Contractual Clauses).
- **Data Protection Officer (DPO)**: May be required if Quest's core activities involve regular and systematic monitoring of individuals at scale.

### 5.3 Social Media Data: Scraping vs. User-Submitted Proofs

The legal treatment of social media data depends heavily on how it is obtained:

**Scraping (Quest accesses social media platforms to verify actions):**
- Likely violates platform Terms of Service (Twitter/X, Instagram, TikTok all prohibit unauthorized scraping).
- May violate the Computer Fraud and Abuse Act (CFAA, 18 U.S.C. section 1030) depending on the method -- though the Supreme Court's decision in Van Buren v. United States (2021) narrowed CFAA's scope to "gates-up" vs. "gates-down" access.
- Privacy implications: accessing user data without the platform's authorization raises additional privacy concerns.
- **Not recommended.**

**User-submitted proofs (buyer uploads a screenshot or shares a post link):**
- The buyer voluntarily provides the proof, establishing consent.
- Quest should limit what it collects from the submission (e.g., verify the action and discard the raw screenshot).
- Requires clear disclosure to the buyer about how the proof will be used and retained.
- **This is the recommended approach.**

**API-based verification (via official platform APIs with user authorization):**
- The most robust approach: the buyer authorizes Quest to access specific data via OAuth.
- Complies with platform ToS and provides clear user consent.
- Requires API partnership/developer agreements with each platform.
- **Recommended for production-scale implementation.**

### 5.4 Wallet Addresses as PII

There is emerging regulatory and legal guidance treating blockchain wallet addresses as personally identifiable information (PII):

- **GDPR**: The Article 29 Working Party (now EDPB) and various DPAs have indicated that blockchain addresses, when linkable to an individual (e.g., through KYC data at an exchange), constitute personal data under GDPR.
- **CCPA**: Wallet addresses likely qualify as "identifiers" (section 1798.140(v)(1)(A)) or "unique personal identifiers" (section 1798.140(ai)).
- **FinCEN**: In the context of the Travel Rule (31 CFR 1010.410), wallet addresses are treated as identifying information for value transfers.
- **OFAC**: The Office of Foreign Assets Control has added specific wallet addresses to the Specially Designated Nationals (SDN) list, implicitly treating them as identifiable attributes.

**Implications for Quest:**
- Wallet addresses collected for USDC cashback delivery must be treated as PII under privacy policies and data protection practices.
- Quest must provide notice that it collects wallet addresses, the purpose of collection, and any sharing with third parties.
- Wallet addresses should be stored with appropriate security measures and subject to the same data retention and deletion policies as other PII.

### 5.5 Data Retention

Quest should implement a defined data retention schedule:

| Data Type | Retention Period | Justification |
|---|---|---|
| Transaction records | 7 years | Tax and financial reporting (IRC section 6501) |
| Verification proofs (screenshots, API responses) | 90 days after event | Dispute resolution and chargeback window |
| Wallet addresses | Until cashback delivered + 90 days (or user deletion request) | Delivery and dispute resolution |
| Social media data | Delete after verification (retain only pass/fail result) | Data minimization |
| Location data | Delete after verification (retain only pass/fail result) | Data minimization / CPRA sensitive PI |
| Account information | Duration of account + 30 days | Service provision |

### 5.6 Privacy Policy Requirements

Quest must publish a privacy policy that includes:

- Identity and contact information of the data controller
- Categories of personal information collected
- Purposes and legal bases for processing
- Categories of third parties with whom data is shared (Stripe, Circle, Coinbase, verification services)
- Consumer rights (access, deletion, correction, opt-out) and how to exercise them
- Data retention periods
- Security measures
- Cookie/tracking disclosures
- California-specific disclosures (CCPA categories, "Do Not Sell or Share" link)
- GDPR-specific disclosures (if applicable): lawful bases, international transfer mechanisms, DPO contact, right to lodge a complaint with a supervisory authority

---

## 6. Securities Law

### 6.1 Howey Test Analysis of the Incentive Discount

Under SEC v. W.J. Howey Co., 328 U.S. 293 (1946), an "investment contract" (and thus a security) exists where there is:

1. An **investment of money**
2. In a **common enterprise**
3. With a reasonable **expectation of profits**
4. Derived from the **efforts of others**

**Analysis of Quest's incentive mechanism:**

| Howey Element | Application to Quest Incentives | Conclusion |
|---|---|---|
| Investment of money | The buyer pays for a ticket. The "investment" is the ticket price. | Arguable -- but the primary purpose is purchasing access to an event, not investing. |
| Common enterprise | There is no pooling of funds or shared enterprise among buyers. | **Not satisfied.** Each buyer's incentive rewards depend solely on their own individual actions. |
| Expectation of profits | The buyer expects a discount/cashback, not appreciation or investment return. | **Not satisfied.** A discount on a purchase price is not a "profit" in the Howey sense. Analogous to credit card rewards or loyalty points. |
| Efforts of others | The buyer's discount depends on their **own** efforts (completing specific actions), not on Quest's or others' efforts. | **Not satisfied.** The value is derived from the buyer's own actions. |

**Conclusion:** Quest's incentive discount model does not satisfy the Howey test. It is a **promotional discount** conditioned on specific buyer actions, functionally identical to:
- "Complete a survey and get 10% off"
- "Share this product on social media for $5 off"
- "Check in at the venue for a $10 reward"

These are standard marketing/promotional mechanisms, not investment contracts.

**Key safeguard:** The incentive structure must avoid any implication that the buyer's rewards increase if they recruit others, if they "stake" their ticket purchase, or if the value of the reward appreciates over time. Any such feature would reintroduce securities analysis risk.

### 6.2 Stablecoin Cashback Classification

If Quest delivers incentive rewards as USDC cashback, the tax and securities treatment is analogous to **credit card cash back rewards**:

- **IRS treatment**: The IRS has consistently treated cash-back rewards tied to purchase transactions as purchase price reductions (non-taxable rebates), not as income. See IRS Announcement 2002-18 (discussed further in Section 7).
- **Securities treatment**: Cash-back rewards are not securities. There is no expectation of profit from the efforts of others; the reward is a direct, deterministic consequence of the buyer's own actions.
- The medium of delivery (USDC vs. dollars) does not change the legal character of the reward. A rebate paid in stablecoins is still a rebate.

### 6.3 Risk: Yield-Like or Staking-Like Structures

If Quest were to introduce features that make the incentive mechanism resemble yield farming or staking, the securities analysis changes dramatically:

**Risk factors that could trigger securities classification:**
- Rewards that increase over time without additional buyer action (passive yield)
- Rewards denominated in a volatile or appreciating token (not a stablecoin)
- Pooled reward structures where one buyer's actions affect another buyer's rewards
- "Staking" mechanisms where buyers lock USDC for enhanced rewards
- Multi-level referral structures with financial incentives at each level

**Recommendation:** Keep the incentive model simple: **Buyer completes action -> Buyer receives defined discount.** Do not introduce time-based appreciation, pooling, staking, or multi-level referral mechanisms.

### 6.4 Token Classification: USDC

USDC is widely treated as a **payment stablecoin**, not a security:

- Circle's position (supported by legal counsel and regulatory engagement) is that USDC is a regulated payment instrument.
- The SEC investigated Paxos (issuer of BUSD, a comparable stablecoin) in 2023 and terminated the investigation without enforcement action.
- The proposed Clarity for Payment Stablecoins Act would explicitly classify regulated payment stablecoins as non-securities.
- **For Quest's purposes**, using USDC does not introduce securities law risk from the stablecoin itself.

---

## 7. Tax Implications

### 7.1 Tax Treatment for Buyers

**Stablecoin cashback as purchase price reduction:**

The IRS has not issued specific guidance on stablecoin cashback, but the closest analogy is **credit card cash back rewards**, which the IRS addresses in:

- **IRS Announcement 2002-18**: Credit card cash-back rewards based on purchases are treated as rebates (i.e., reductions in the purchase price), not as taxable income. The buyer's cost basis in the purchased goods is reduced by the reward amount.
- **General tax principle**: A rebate or discount conditional on a purchase is a reduction in the purchase price, not income.

**Application to Quest:**
- If a buyer pays $100 for a ticket and receives $25 in USDC cashback after completing incentive actions, the IRS treatment is likely:
  - Effective ticket price: $75 (reduced by the $25 rebate)
  - The $25 USDC is not taxable income to the buyer
  - The buyer has a cost basis of $25 in the USDC received (equal to its fair market value at receipt)
- **If the buyer later sells or exchanges the USDC** for more or less than $25, any gain or loss is a taxable event (capital gain/loss or ordinary income, depending on characterization).

**Caveat:** This treatment applies to purchase-price rebates. If Quest structures the cashback differently -- for example, as a reward for promoting the event (i.e., compensation for services) rather than a purchase-price reduction -- the IRS may treat it as ordinary income. The distinction matters:
- "Complete these actions to reduce your ticket price" = purchase-price rebate (non-taxable)
- "Promote this event and earn USDC" = compensation for services (taxable)

The framing and documentation should consistently describe the incentive as a **conditional discount** on the ticket purchase, not as compensation for marketing services.

### 7.2 Tax Treatment for Event Organizers

- **Gross revenue**: The organizer's gross revenue from ticket sales is the amount they receive from Quest (whether in fiat or USDC).
- **Discounts**: The discount amounts funded by the organizer reduce gross revenue. If the organizer funds a $25 discount on a $100 ticket, the organizer's revenue is $75 per ticket.
- **USDC receipt**: If the organizer receives settlement in USDC, the fair market value of the USDC at the time of receipt is the organizer's revenue. Since USDC is pegged 1:1 to USD, this is straightforward (e.g., 75 USDC = $75).
- **Subsequent USDC disposition**: If the organizer holds USDC and later converts to fiat, any gain or loss (which should be negligible for a properly-functioning stablecoin) is a taxable event.
- **Character of income**: Revenue from ticket sales is ordinary business income, regardless of payment medium.

### 7.3 Sales Tax

Sales tax on event tickets varies by state:

| State | Taxability of Event Tickets | Key Statute/Rule |
|---|---|---|
| California | Generally not taxable (admissions are services) | Cal. Rev. & Tax Code section 6006 |
| New York | Taxable (admissions over $0.10) | NY Tax Law section 1105(f)(1) |
| Texas | Taxable (amusement services) | Tex. Tax Code section 151.0028 |
| Florida | Taxable (admissions) | Fla. Stat. section 212.04 |
| Illinois | Varies by municipality (amusement tax in Chicago) | Chicago Municipal Code section 4-156 |
| Colorado | Not taxable at state level; some local jurisdictions tax admissions | Colo. Rev. Stat. section 39-26-102 |

**Tax basis**: Sales tax is generally computed on the **amount actually paid** by the buyer. If the buyer completes incentive actions and receives a $25 discount (whether as immediate price reduction or post-purchase cashback), the tax basis depends on timing:
- **Immediate discount at checkout**: Tax applies to $75 (the discounted price).
- **Post-purchase cashback**: Tax likely applies to $100 (the original purchase price), because the cashback is delivered after the transaction. The buyer would need to seek a refund adjustment for the tax difference, which is impractical.

**Recommendation:** Structure discounts as **price reductions at checkout** rather than post-purchase cashback to ensure correct sales tax treatment and avoid overpaying sales tax.

### 7.4 1099 Reporting

**1099-MISC / 1099-NEC:**
- If Quest disburses USDC cashback that is treated as **compensation** (not as a purchase-price rebate) and the total exceeds **$600** to a single recipient in a calendar year, Quest must file a Form 1099-MISC (or 1099-NEC if treated as non-employee compensation) and provide a copy to the recipient. (IRC section 6041, 26 U.S.C. section 6041.)
- If the cashback is properly structured as a purchase-price rebate, 1099 reporting is not required (consistent with the treatment of credit card rewards).

**1099-K:**
- Payment settlement entities must file Form 1099-K for payees (event organizers) receiving aggregate payments exceeding **$600** in a calendar year (as amended by the American Rescue Plan Act section 9674; enforcement phased in by the IRS with transitional thresholds). If Quest settles with organizers using Stripe or a similar platform, the payment processor (Stripe) typically handles 1099-K filing for the organizer.

**1099-DA (proposed):**
- The IRS has proposed Form 1099-DA for digital asset transactions (under regulations implementing IRC section 6045 as amended by the Infrastructure Investment and Jobs Act section 80603). When finalized, this may require reporting of certain USDC transactions.

**Conservative approach:** Even if the cashback is structured as a rebate, Quest should maintain records sufficient to file 1099s if the IRS subsequently changes its position on stablecoin rebate treatment. Implement KYC (name, address, TIN) collection for any buyer expected to receive >$600 in annual cashback.

### 7.5 State Tax Nexus

Conducting stablecoin transactions in a state may create **tax nexus** (a sufficient connection to the state to trigger tax obligations):

- **Sales tax nexus**: Generally established by physical presence or economic activity thresholds (Wayfair v. South Dakota: $100,000 in sales or 200 transactions in a state).
- **Income tax nexus**: Some states assert income tax nexus over businesses with economic activity in the state, including digital transactions.
- **Stablecoin-specific nexus**: No state has yet established that stablecoin transactions alone create nexus, but ongoing regulatory developments could change this.

Quest should monitor its transaction volumes by state and register for sales tax collection in states where it meets economic nexus thresholds (this is a standard e-commerce compliance requirement, independent of the crypto aspects).

---

## 8. Jurisdictional Strategy

### 8.1 Incorporation

**Recommended: Delaware C-Corp or LLC**
- Delaware offers well-established corporate law (Delaware General Corporation Law, 8 Del. C. section 101 et seq.), a sophisticated Court of Chancery, and a large body of precedent favorable to technology companies.
- Most venture-backed startups incorporate in Delaware, making it the standard for future fundraising.
- Delaware's Division of Corporations is efficient and inexpensive.

**Alternative: Wyoming LLC**
- Wyoming offers unique advantages for crypto-native businesses:
  - Wyoming DAO LLC statute (Wyo. Stat. section 17-31-101 et seq.) enables decentralized autonomous organization structures.
  - Wyoming's digital asset exemption from money transmitter licensing (Wyo. Stat. section 40-22-104(a)(vi)).
  - No state income tax.
  - Favorable digital asset custody and property laws.
- **Trade-off**: Wyoming's corporate law is less developed than Delaware's, and some institutional investors and legal counterparties prefer Delaware entities.

**Recommendation:** Incorporate as a **Delaware C-Corp** for maximum flexibility and investor compatibility. If Quest later establishes a DAO-governed component, create a separate **Wyoming DAO LLC** subsidiary for that purpose.

### 8.2 Operational Prioritization by State

**Tier 1 (Launch states -- crypto-friendly, clear regulatory frameworks):**
- **Wyoming**: Most permissive crypto environment, explicit MTL exemptions for certain activities.
- **Texas**: Large market, favorable DPB guidance on virtual currency, no state income tax.
- **Colorado**: Digital Token Act (Colo. Rev. Stat. section 11-110-101 et seq.) provides safe harbor for certain token-based activities. Colorado also accepts crypto for state payments.

**Tier 2 (Expand after initial launch -- large markets with moderate regulation):**
- **Florida**: Large event market, modernizing its crypto regulatory framework.
- **Illinois**: Major market; Transmitters of Money Act is well-understood.
- **Georgia, Tennessee, North Carolina**: Growing tech ecosystems with developing crypto frameworks.

**Tier 3 (Proceed with caution -- stricter regulatory requirements):**
- **California**: Massive market but DFAL (effective July 2025) introduces new licensing requirements. Essential to serve but requires careful compliance.
- **New York**: The BitLicense regime is expensive and slow, but New York is too large to ignore long-term. Consider initially geo-blocking New York residents or partnering with a BitLicensed entity (Coinbase already holds a BitLicense).
- **Connecticut, Hawaii**: Strict money transmission / crypto laws that may require specific licenses or restrictions.

### 8.3 International Considerations

For events outside the United States, Quest must conduct jurisdiction-specific legal analysis:

- **European Union**: MiCA compliance for stablecoin usage (Circle's EMI license helps); GDPR for data privacy; Payment Services Directive (PSD2) for payment processing; local consumer protection laws per member state.
- **United Kingdom**: FCA registration for crypto-asset activities; UK GDPR; Consumer Rights Act 2015.
- **Canada**: Provincial money services business registration (FINTRAC); PIPEDA for privacy; provincial consumer protection statutes.
- **Singapore**: Payment Services Act 2019 (MAS licensing for digital payment tokens); PDPA for privacy.
- **Australia**: AFSL requirements (depending on characterization); Privacy Act 1988; ASIC guidance on crypto-assets.

**Recommendation:** Focus on US markets initially. Expand internationally only after establishing US compliance infrastructure and engaging local counsel in each target jurisdiction.

---

## 9. Risk Mitigation Recommendations

### 9.1 Use Licensed Partners

The single most effective risk mitigation strategy is to avoid conducting regulated activities directly by partnering with licensed entities:

| Regulated Activity | Licensed Partner | Benefit |
|---|---|---|
| Credit card processing | **Stripe** | Stripe is PCI Level 1, holds MSB registration, state MTLs. Quest avoids card data handling and money transmission for fiat. |
| USDC issuance and reserves | **Circle** | Circle is licensed in all 50 states + DC, BitLicensed in NY, SOC 2 audited. Quest leverages Circle's regulatory infrastructure. |
| USDC transmission and custody | **Coinbase** (via x402 facilitator) | Coinbase is a registered MSB, holds state MTLs, BitLicense. As x402 facilitator, Coinbase handles the regulated USDC transfer. |
| Banking and fiat settlement | **Stripe Treasury** or **Mercury** (with partner bank) | Access to FDIC-insured accounts through bank partnerships. |

### 9.2 Clear Terms of Service

Quest's Terms of Service must clearly address:

1. **Pricing mechanism**: "The listed price is the base ticket price. Buyers may earn discounts by completing optional incentive actions ('Quests'). Discounts are not guaranteed and are subject to verification."
2. **Incentive actions**: Specific description of each type of incentive action, how completion is verified, and the associated discount amount.
3. **Refund policy**: "Refunds are issued for the amount charged to the buyer's payment method. If the buyer received stablecoin cashback prior to requesting a refund, the cashback amount will be deducted from the refund."
4. **Stablecoin cashback**: "Cashback rewards, if applicable, are delivered in USDC, a US dollar-pegged stablecoin, to the buyer's designated wallet address. USDC is subject to the risks inherent in digital assets, including potential loss of value and technical failure."
5. **Dispute resolution**: Arbitration clause (if desired) with carve-outs for small claims court.
6. **Limitation of liability**: Standard limitations appropriate to a technology platform.

### 9.3 Point-of-Sale Disclosures

At the point of purchase, Quest must prominently display:

```
Base price: $100.00
Complete Quests to earn up to $25.00 in rewards.
You pay: $100.00 now. Earn rewards after completing actions.
```

Do NOT display:
```
Tickets from $75!  (Deceptive if $75 requires completing all incentive actions)
```

The FTC's "clear and conspicuous" standard requires that material conditions be disclosed in a manner that a reasonable consumer would notice and understand before committing to the purchase.

### 9.4 Engage Legal Counsel

Quest should retain fintech and cryptocurrency legal counsel experienced with:
- FinCEN registration and BSA compliance
- State money transmitter licensing analysis
- Securities law risk assessment for token/cashback models
- Consumer protection and advertising law
- Privacy law (CCPA, GDPR)
- Tax structuring for digital asset transactions

**Recommended timing:** Engage counsel **before** launching the product, not after receiving a regulatory inquiry.

### 9.5 Regulatory Sandbox Programs

Several states offer regulatory sandbox programs that allow fintech companies to test innovative products under relaxed regulatory requirements for a limited period:

- **Arizona**: Regulatory Sandbox Program (A.R.S. section 41-5601 et seq.) -- the first US state sandbox, administered by the Attorney General.
- **Wyoming**: Fintech Sandbox (Wyo. Stat. section 40-2-501 et seq.) -- allows participants to test financial products with up to 10,000 customers for up to 3 years.
- **Utah**: Regulatory Sandbox (Utah Code section 13-55-101 et seq.)
- **Nevada, Kentucky, West Virginia**: Also have sandbox programs.
- **CFPB**: Has periodically offered "no-action letters" and sandbox-like programs for fintech innovators (though the program's status varies with CFPB leadership priorities).

**Recommendation:** Apply for sandbox participation in Wyoming or Arizona as a way to validate the regulatory model before committing to full licensure.

### 9.6 Comprehensive Compliance Checklist

| Item | Priority | Status | Notes |
|---|---|---|---|
| FinCEN MSB registration | High | Pending | Low cost; register as precaution even if arguable exemption |
| State MTL analysis (50-state) | High | Pending | Engage counsel for legal opinion on each priority state |
| Agent-of-payee opinion | High | Pending | Key exemption argument; need written legal opinion |
| PCI DSS SAQ-A completion | High | Pending | Complete annually; use Stripe's guided process |
| Privacy policy (CCPA/GDPR) | High | Pending | Draft and publish before collecting any user data |
| Terms of Service | High | Pending | Cover pricing, refunds, stablecoin risks, disputes |
| AML/KYC program | Medium | Pending | Proportionate to Quest's role; leverage partner KYC |
| OFAC screening | Medium | Pending | Screen wallet addresses against OFAC SDN list before USDC disbursement |
| Sales tax registration | Medium | Pending | Register in states where economic nexus thresholds are met |
| State BitLicense analysis (NY) | Low (defer) | Pending | Defer NY operations or use BitLicensed partner |
| 1099 reporting infrastructure | Low (pre-launch) | Pending | Build KYC collection and reporting before $600 threshold is reached |
| DPIA (GDPR, if EU) | Low (pre-launch) | Pending | Required before processing EU personal data |
| Regulatory sandbox application | Medium | Pending | Apply in WY or AZ for early-stage testing |
| Fintech/crypto legal counsel | Critical | Pending | Engage before any product launch |

---

## Appendix: Key Statutory and Regulatory Citations

| Citation | Description |
|---|---|
| 31 U.S.C. sections 5311-5330 | Bank Secrecy Act |
| 31 CFR Part 1010 | FinCEN general MSB regulations |
| 31 CFR 1010.100(ff)(5) | Definition of money transmitter |
| 31 CFR 1022.380 | MSB registration requirements |
| 31 CFR 1022.210 | AML program requirements |
| 31 CFR 1022.320 | SAR filing requirements |
| 31 CFR 1010.410 | Travel Rule (recordkeeping for funds transfers) |
| FIN-2019-G001 | FinCEN CVC guidance (2019) |
| FIN-2014-R001 | FinCEN payment processor ruling (2014) |
| 15 U.S.C. section 45 | FTC Act Section 5 (unfair/deceptive practices) |
| 16 CFR Part 233 | FTC Guides Against Deceptive Pricing |
| 16 CFR Part 255 | FTC Endorsement Guides |
| 15 U.S.C. section 1601 et seq. | Truth in Lending Act (TILA) |
| 12 CFR Part 1026 | Regulation Z (TILA implementing regulation) |
| 12 CFR 1026.12(b)-(c) | Cardholder dispute rights |
| 12 CFR 1026.13 | Billing error resolution |
| 12 U.S.C. section 5491 et seq. | Dodd-Frank Act (CFPB establishment) |
| 12 U.S.C. section 5531 | UDAAP authority |
| Cal. Civ. Code section 1798.100 et seq. | CCPA/CPRA |
| Regulation (EU) 2016/679 | GDPR |
| Regulation (EU) 2023/1114 | MiCA (Markets in Crypto-Assets) |
| 18 U.S.C. section 1030 | Computer Fraud and Abuse Act |
| 26 U.S.C. section 6041 | 1099 reporting requirements |
| 26 U.S.C. section 6045 | Broker reporting (as amended for digital assets) |
| IRC section 6501 | Statute of limitations for tax assessment |
| IRS Announcement 2002-18 | Treatment of cash rebates |
| SEC v. W.J. Howey Co., 328 U.S. 293 (1946) | Howey test for investment contracts |
| South Dakota v. Wayfair, 585 U.S. 162 (2018) | Economic nexus for sales tax |
| Van Buren v. United States, 593 U.S. 374 (2021) | CFAA scope |
| 23 NYCRR Part 200 | New York BitLicense |
| Wyo. Stat. sections 17-31-101 et seq. | Wyoming DAO LLC Act |
| Wyo. Stat. section 40-22-104(a)(vi) | Wyoming MTL crypto exemption |
| Colo. Rev. Stat. section 11-110-101 et seq. | Colorado Digital Token Act |
| Tex. Fin. Code Chapter 151 | Texas Money Services Act |
| Cal. Fin. Code Division 1.2 | California Money Transmission Act / DFAL |

---

*Document prepared for Quest Payments internal planning. Last updated: February 2026.*
