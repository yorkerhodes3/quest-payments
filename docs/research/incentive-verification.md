# Incentive Verification System Design

> **Project:** Quest Payments
> **Scope:** Architecture and implementation guidance for verifying incentive-based ticket discount actions
> **Settlement Layer:** USDC via x402 on Base L2
> **Last Updated:** 2026-02-21

---

## 1. Verification Architecture

### 1.1 Pluggable Verifier Pattern

Every incentive type (social share, referral, check-in, sponsor session attendance, feedback submission) is backed by a discrete **verifier adapter** that implements a common interface. The core payment engine never contains verification logic directly; it delegates to the appropriate adapter through a registry.

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────────┐
│  Buyer Action │────>│  Event Bus /     │────>│  Verifier Registry   │
│  (API call)   │     │  Message Queue   │     │  (adapter lookup)    │
└──────────────┘     └──────────────────┘     └──────────┬───────────┘
                                                         │
                          ┌──────────────────────────────┤
                          │              │               │
                   ┌──────▼─────┐ ┌─────▼──────┐ ┌─────▼──────────┐
                   │ Social     │ │ Referral   │ │ Check-in       │
                   │ Verifier   │ │ Verifier   │ │ Verifier       │
                   └──────┬─────┘ └─────┬──────┘ └─────┬──────────┘
                          │              │               │
                          └──────────────┴───────────────┘
                                         │
                              ┌──────────▼──────────┐
                              │  Discount Engine     │
                              │  (applies verified   │
                              │   discounts to order)│
                              └──────────────────────┘
```

**Why pluggable:** New incentive types (e.g., "watch a sponsor video for 30 seconds") can be shipped by implementing a single adapter without modifying the core discount or settlement pipeline. The registry resolves adapters by `incentiveType` string key at runtime.

### 1.2 Event-Driven Flow

1. **Action submitted** -- Buyer hits `POST /api/v1/verifications` with evidence (URL, code, QR payload, etc.).
2. **Event emitted** -- The API handler publishes a `verification.requested` event to the internal message bus (Bull, SQS, or in-process EventEmitter for MVP).
3. **Verifier consumes** -- The correct adapter picks up the event, runs its verification logic (API call, DB lookup, oracle query), and publishes `verification.completed` or `verification.failed`.
4. **Discount engine reacts** -- On `verification.completed`, the discount engine recalculates the buyer's effective price for the order.
5. **Settlement updated** -- If all verifications for a purchase are resolved, the final USDC amount is locked and the x402 payment flow proceeds.

### 1.3 Verification States

| State | Description |
|---|---|
| `pending` | Incentive is available to the buyer but no evidence has been submitted yet. |
| `submitted` | Buyer has submitted evidence; awaiting processing. |
| `verifying` | Adapter has picked up the task and is actively checking (API call in-flight, oracle pending, etc.). |
| `verified` | Evidence confirmed valid. Discount is applied. |
| `rejected` | Evidence invalid (fake URL, content mismatch, duplicate referral, etc.). Buyer may retry if retries are allowed. |
| `expired` | Verification window closed before the buyer completed or the system confirmed the action. |

State transitions are persisted as an append-only event log (see Section 10 on event sourcing) so that any state can be reconstructed and audited.

```
pending ──> submitted ──> verifying ──> verified
                │              │
                │              └──> rejected ──> submitted (retry)
                │
                └──> expired
```

### 1.4 Separation of Concerns

The verification subsystem has **no knowledge** of:
- How the final USDC amount is calculated (that is the discount engine's job).
- How settlement happens on Base L2 (that is the x402 payment module's job).
- Ticket inventory or event metadata beyond what is needed for verification context.

The verification subsystem **owns**:
- Evidence intake and normalization.
- Adapter lifecycle (registration, health checks, retry policies).
- Verification state machine and its persistence.
- Attestation generation (Section 2).

---

## 2. On-Chain Attestations

### 2.1 Why On-Chain

Verified incentive completions are valuable beyond a single transaction. On-chain attestation creates:
- **Permanent proof** that a buyer completed specific actions, useful for reputation systems.
- **Auditable trail** for organizers, sponsors, and dispute resolution.
- **Composability** -- other protocols or events can read attestation data (e.g., "users who completed 5+ referrals get VIP access").

### 2.2 Ethereum Attestation Service (EAS) on Base L2

EAS is deployed on Base at address `0x4200000000000000000000000000000000000021`. Base L2 transaction fees are sub-cent, making per-action attestation economically viable even for a $2 discount.

**EAS SDK usage:**

```typescript
import { EAS, SchemaEncoder } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

const EAS_CONTRACT_ADDRESS = "0x4200000000000000000000000000000000000021";

const eas = new EAS(EAS_CONTRACT_ADDRESS);
const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
const signer = new ethers.Wallet(process.env.ATTESTER_PRIVATE_KEY!, provider);
eas.connect(signer);

async function attestIncentiveCompletion(data: {
  purchaseId: string;
  incentiveId: string;
  verifierAddress: string;
  timestamp: number;
  proofHash: string;
}): Promise<string> {
  const schemaEncoder = new SchemaEncoder(
    "bytes32 purchaseId, bytes32 incentiveId, address verifierAddress, uint64 timestamp, bytes32 proofHash"
  );

  const encodedData = schemaEncoder.encodeData([
    { name: "purchaseId", value: ethers.id(data.purchaseId), type: "bytes32" },
    { name: "incentiveId", value: ethers.id(data.incentiveId), type: "bytes32" },
    { name: "verifierAddress", value: data.verifierAddress, type: "address" },
    { name: "timestamp", value: data.timestamp, type: "uint64" },
    { name: "proofHash", value: data.proofHash, type: "bytes32" },
  ]);

  const tx = await eas.attest({
    schema: QUEST_INCENTIVE_SCHEMA_UID, // registered once during deployment
    data: {
      recipient: data.verifierAddress,
      expirationTime: BigInt(0), // no expiration by default
      revocable: true,
      data: encodedData,
    },
  });

  const attestationUID = await tx.wait();
  return attestationUID;
}
```

### 2.3 Schema Design

Register the schema once on deployment:

```
bytes32 purchaseId,
bytes32 incentiveId,
address verifierAddress,
uint64 timestamp,
bytes32 proofHash
```

| Field | Purpose |
|---|---|
| `purchaseId` | Links attestation to the Quest Payments order (keccak256 of internal UUID). |
| `incentiveId` | Identifies which incentive type and instance was completed. |
| `verifierAddress` | The Ethereum address of the entity that performed verification (system wallet, organizer, or oracle). |
| `timestamp` | Unix timestamp of verification completion. |
| `proofHash` | keccak256 of the canonical evidence payload (tweet URL, referral code + referee ID, etc.) for later auditability. |

### 2.4 Who Attests

| Attester | When to Use | Trust Level |
|---|---|---|
| **Automated system wallet** | Default for API-verifiable actions (social shares, referrals). The Quest Payments backend holds a hot wallet key that signs attestations after programmatic verification. | High (system-controlled). |
| **Event organizer wallet** | Check-in verification where the organizer scans QR codes; organizer's wallet signs. | Medium (trusted party). |
| **Oracle contract** | For complex off-chain computations routed through Chainlink Functions or API3. The oracle's designated address attests. | Medium (depends on oracle trust model). |
| **Peer attestation** | Future: attendees vouch for each other's presence. Requires M-of-N threshold logic. | Lower (Sybil risk). |

### 2.5 Revocability and Expiration

- Attestations are created as **revocable** so that fraudulent completions discovered post-facto can be invalidated.
- **Expiration** is set to `0` (no expiration) by default. For time-bound incentives (e.g., "share within 24 hours of purchase"), the verification state machine enforces timing constraints before attesting rather than relying on on-chain expiration.
- Revocation emits an on-chain event that downstream consumers (discount engine, reputation systems) can index.

---

## 3. Social Media Verification

### 3.1 Twitter/X API v2

Twitter is the most common social sharing incentive target. Use the **X API v2** (OAuth 2.0 with PKCE for user context, or App-only Bearer Token for public tweet lookup).

**Verification flow:**

1. Buyer clicks "Share on X" in the Quest Payments UI, which opens a pre-filled tweet compose window.
2. After posting, buyer pastes the tweet URL back into the UI (or the app detects it via OAuth callback if using a deeper integration).
3. Backend receives `POST /api/v1/verifications` with `{ type: "social_share", platform: "twitter", evidenceUrl: "https://x.com/user/status/123..." }`.
4. Backend extracts the tweet ID from the URL and calls the X API:

```typescript
// X API v2: Retrieve a single tweet by ID
// GET https://api.x.com/2/tweets/:id?tweet.fields=author_id,created_at,text
// Authorization: Bearer <APP_ACCESS_TOKEN>

interface TwitterTweetResponse {
  data: {
    id: string;
    text: string;
    author_id: string;
    created_at: string; // ISO 8601
  };
}

async function verifyTweet(tweetUrl: string, expectedContent: {
  mustContain: string[];     // e.g., ["#QuestEvent", event hashtag]
  mustMention?: string[];    // e.g., ["@questpayments"]
  authorMinAge?: number;     // minimum account age in days
}): Promise<{ valid: boolean; reason?: string }> {
  const tweetId = extractTweetId(tweetUrl);

  const response = await fetch(
    `https://api.x.com/2/tweets/${tweetId}?tweet.fields=author_id,created_at,text`,
    { headers: { Authorization: `Bearer ${process.env.TWITTER_BEARER_TOKEN}` } }
  );

  if (!response.ok) {
    return { valid: false, reason: "tweet_not_found" };
  }

  const { data: tweet }: TwitterTweetResponse = await response.json();

  // Content matching
  for (const phrase of expectedContent.mustContain) {
    if (!tweet.text.toLowerCase().includes(phrase.toLowerCase())) {
      return { valid: false, reason: `missing_content: ${phrase}` };
    }
  }

  // Author verification (optional: check account age)
  if (expectedContent.authorMinAge) {
    const author = await fetchTwitterUser(tweet.author_id);
    const accountAgeDays = (Date.now() - new Date(author.created_at).getTime()) / 86400000;
    if (accountAgeDays < expectedContent.authorMinAge) {
      return { valid: false, reason: "account_too_new" };
    }
  }

  return { valid: true };
}
```

**X API v2 rate limits (App-only):**
- `GET /2/tweets/:id` -- 300 requests per 15 minutes (app-level), 900 per 15 minutes (user-level).
- For high-volume events, batch lookups via `GET /2/tweets?ids=` (up to 100 IDs per call).

**X API v2 pricing tier (as of 2025):**
- Free tier: 1,500 tweets/month read (insufficient for events of any scale).
- Basic tier ($100/month): 10,000 tweets/month read.
- Pro tier ($5,000/month): 1M tweets/month read.
- For most events, Basic tier is sufficient. Budget this into event costs.

### 3.2 Instagram Graph API

Instagram verification is significantly more constrained:

- The **Instagram Graph API** only exposes media from Business or Creator accounts that have authorized your app.
- There is no public endpoint to look up an arbitrary post by URL without the user granting `instagram_basic` permission via OAuth.
- Verification flow requires the user to connect their Instagram account via OAuth, then the backend queries their recent media to find a matching post.

**Practical approach:** Accept Instagram shares as a "best effort" incentive. The user submits a screenshot + URL. The backend:
1. Confirms the URL format is valid (`https://www.instagram.com/p/<shortcode>/`).
2. Optionally uses the oEmbed endpoint (`https://graph.facebook.com/v19.0/instagram_oembed?url=...&access_token=...`) to confirm the post exists (returns title and thumbnail but not full content).
3. For higher assurance, require OAuth-connected verification.

**Recommendation:** Deprioritize Instagram as a primary incentive channel due to API limitations. Offer it as an optional, lower-discount incentive.

### 3.3 LinkedIn Share Verification

LinkedIn's API is the most restrictive of the major platforms:

- The **LinkedIn Marketing API** (`/rest/posts`) requires the user to grant `r_member_social` scope via OAuth 2.0 3-legged flow.
- Even with OAuth, querying a specific user's shares requires partnership-level API access.
- There is no public lookup endpoint for arbitrary LinkedIn posts.

**Practical approach:** Treat LinkedIn shares as self-reported. The user submits a URL; the backend confirms the URL format matches `https://www.linkedin.com/posts/...` or `https://www.linkedin.com/feed/update/urn:li:activity:...`. Full verification is manual or trusted on the honor system with spot-check audits.

**Recommendation:** LinkedIn shares should carry a lower discount weight than Twitter shares due to limited automated verifiability.

### 3.4 Anti-Gaming for Social Shares

| Threat | Mitigation |
|---|---|
| Fake/burner Twitter accounts | Require minimum account age (30+ days recommended), minimum follower count (10+), require non-protected account. |
| Deleted immediately after verification | Re-check tweet existence after a configurable delay (e.g., 1 hour and 24 hours post-verification). If deleted, revoke attestation and reverse discount if ticket not yet settled. |
| Copy-paste from another user's tweet | Verify `author_id` matches the Twitter handle the buyer provided during purchase. |
| Bot-generated posts | Rate limit: one social share incentive per platform per purchase. Flag accounts that complete social share incentives across many Quest Payments events in short windows. |
| Content that technically matches but is low-quality | Define required hashtags and mentions in the incentive configuration. Optionally require a minimum tweet text length (e.g., 50 characters beyond the required tags). |

### 3.5 Privacy Approach

The system never requests write access to a user's social media account. The flow is:
1. User creates the post independently.
2. User submits the URL to Quest Payments.
3. Quest Payments reads the public post via API to verify content and authorship.
4. Only the post URL and verification result are stored; no social media credentials are persisted.

---

## 4. Attendance / Check-in Verification

### 4.1 QR Code Scan at Venue

Each ticket generates a unique, single-use QR code containing a signed payload:

```typescript
interface QRPayload {
  purchaseId: string;
  ticketId: string;
  nonce: string;        // unique per QR generation
  signature: string;    // HMAC-SHA256(purchaseId + ticketId + nonce, SERVER_SECRET)
  expiresAt: number;    // Unix timestamp
}
```

**Verification flow:**
1. Venue staff or kiosk scans the QR code using the Quest Payments organizer app.
2. App sends the decoded payload to `POST /api/v1/check-in`.
3. Backend verifies the HMAC signature, checks `expiresAt`, confirms the `nonce` has not been used before (replay protection), and marks the ticket as checked in.
4. A `checkin.verified` event is published, triggering the check-in incentive verification.

**Single-use enforcement:** The `nonce` is stored in a Redis set with TTL matching the event duration. Any second scan of the same nonce returns an error.

### 4.2 NFC Tap Verification

For venues with NFC reader infrastructure:

- Buyer's ticket is provisioned as an NFC tag (NDEF record with the same signed payload as the QR code).
- Apple Wallet and Google Wallet both support NFC-based event tickets.
- Reader hardware (e.g., Socket Mobile DuraSled, or dedicated kiosks) sends the tap payload to the same `POST /api/v1/check-in` endpoint.
- Advantage over QR: harder to screenshot and share, as the phone must be physically present.

### 4.3 Geolocation Proof

**Approach:** The buyer's device submits GPS coordinates at check-in time. The backend compares against the known venue coordinates with a configurable radius (e.g., 200 meters).

**Serious caveats:**
- GPS spoofing is trivial on rooted/jailbroken devices and via developer tools.
- Indoor GPS accuracy is often 10-50 meters, requiring generous radius allowances.
- Privacy concerns: collecting location data requires explicit consent and proper data handling.

**Recommendation:** Use geolocation only as a **supplementary signal**, never as the sole check-in proof. Combine with QR or NFC for a two-factor check-in if high assurance is needed.

### 4.4 Bluetooth Beacon Proximity

Bluetooth Low Energy (BLE) beacons placed at the venue broadcast a unique identifier. The buyer's device detects the beacon and submits the beacon ID + signal strength (RSSI) to the backend.

- **Beacon protocol:** iBeacon (Apple) or Eddystone (Google). Both are well-supported on iOS and Android.
- **Proximity accuracy:** Roughly 1-3 meters for "immediate" zone, 3-10 meters for "near" zone.
- **Anti-spoofing:** Rotate the beacon's broadcast payload periodically (every 30 seconds) via a server-synced schedule so that leaked payloads expire quickly.
- **Hardware cost:** $5-20 per beacon; a small venue needs 2-4 beacons.

### 4.5 Event Platform Integration

Quest Payments should integrate with major event platforms to cross-reference check-in data.

**Eventbrite:**
- Webhook: `attendees.checked_in` fires when a ticket is scanned via Eventbrite's app.
- REST API: `GET /v3/events/{event_id}/attendees/?status=checked_in` to poll check-in status.
- OAuth 2.0 with `event:read` and `attendee:read` scopes.

**Luma:**
- API: `GET /api/public/v2/event/get-guests?event_api_id=...&status=checked_in`.
- Webhook support for check-in events (configure via dashboard).
- API key authentication.

**Generic webhook receiver:**
For platforms without native integration, provide a generic webhook endpoint:
```
POST /api/v1/webhooks/checkin
{
  "source": "custom",
  "eventId": "...",
  "ticketId": "...",
  "checkedInAt": "2026-02-20T19:30:00Z",
  "signature": "HMAC-SHA256 of payload with shared secret"
}
```

---

## 5. Referral Tracking

### 5.1 Referral Code Generation

Each ticket holder receives a unique referral code upon purchase. The code is:
- 8 characters, alphanumeric, case-insensitive (to avoid confusion in verbal sharing).
- Tied to the original `purchaseId` and `buyerIdentity` in the database.
- Displayed prominently on the ticket confirmation page and in confirmation emails.

```typescript
import { randomBytes } from "crypto";

function generateReferralCode(): string {
  // 5 bytes -> 10 hex chars -> take first 8 -> uppercase for readability
  return randomBytes(5).toString("hex").slice(0, 8).toUpperCase();
}
```

### 5.2 Attribution Flow

1. **Referrer (A)** shares their referral code or a link like `https://quest.pay/event/xyz?ref=A1B2C3D4`.
2. **Referee (B)** visits the page; the `ref` parameter is captured and stored in a server-side session (not just a cookie, to survive cross-device flows).
3. **Referee (B)** completes a purchase. At purchase time, the backend:
   - Looks up the referral code -> finds Referrer A's `purchaseId`.
   - Records the referral relationship: `(referrer: A, referee: B, referralCode, timestamp)`.
   - Emits `referral.completed` event.
4. **Referral verifier** processes the event:
   - Confirms the referee's purchase is valid and paid.
   - Confirms anti-gaming rules (Section 5.3).
   - If valid, applies the referral discount to Referrer A's order (retroactive credit or future use) and optionally a discount to Referee B.

### 5.3 Anti-Gaming

| Threat | Mitigation |
|---|---|
| Self-referral (A refers themselves under a different email) | Require distinct payment methods (different card last-4 or different wallet address). Flag if the same IP address is used for both purchases. |
| Referral rings (A refers B, B refers C, C refers A) | Detect cycles in the referral graph. Limit referral benefits to a maximum of N referrals per buyer per event. |
| Fake purchases (referee buys a ticket and immediately requests a refund) | Referral incentive only confirmed after the referee's payment is settled and past the refund window. |
| Automated code sharing bots | Rate limit referral code usage: max M redemptions per code per hour. CAPTCHA on the purchase page when a referral code is present. |

### 5.4 Attribution Window and Conflict Resolution

- **Attribution window:** 7 days from first click on a referral link. If the referee does not purchase within 7 days, the referral code association expires.
- **Last-touch attribution:** If a referee clicks multiple referral links, the **most recent** referral code before purchase is attributed. This is simpler and avoids splitting incentives.
- **Conflict resolution:** If two referrers claim the same referee, the system uses the server-side session log to determine which referral code was active at purchase time. The log is append-only and timestamped.

### 5.5 Single-Level Structure

**Recommendation:** Implement single-level referrals only (A refers B; A gets credit). Do not implement multi-level referral chains (A refers B, B refers C, A gets credit for C). Reasons:
- Multi-level structures add significant complexity to the attribution and discount calculation.
- They create regulatory risk (resemblance to multi-level marketing / pyramid schemes).
- Single-level referrals are sufficient to drive organic growth for events.
- Multi-level can be added later if data shows clear demand.

---

## 6. Post-Event Feedback

### 6.1 Form Submission with Quality Gates

Feedback incentives reward buyers for providing meaningful post-event feedback. The feedback form is served at `https://quest.pay/event/{eventId}/feedback/{purchaseId}`.

**Quality gates applied at submission time:**

| Gate | Rule | Rationale |
|---|---|---|
| Minimum length | At least 100 characters of freeform text across all open-ended fields. | Prevents "asdfasdf" or single-word responses. |
| Required fields | At least one quantitative rating (1-5 stars) AND one qualitative response. | Ensures structured data for the organizer. |
| Uniqueness | Buyer can submit feedback only once per event. Duplicate submissions are rejected. | Prevents farming. |
| Language detection | Response must be in a detectable human language (use a lightweight library like `franc` for language detection). | Filters pure gibberish. |

### 6.2 Timing Constraints

- Feedback form becomes available **after the event end time** (or after the buyer's check-in, whichever is later).
- Feedback must be submitted within **N days** of the event (configurable per event, default 7 days).
- After the deadline, the incentive transitions to `expired` state.

### 6.3 NLP-Based Spam / Garbage Detection (Optional)

For events that want higher-quality feedback, an optional NLP filter can be applied:

```typescript
interface FeedbackQualityResult {
  score: number;          // 0.0 (garbage) to 1.0 (high quality)
  flags: string[];        // e.g., ["repetitive", "off_topic", "possible_copypaste"]
  passesThreshold: boolean;
}

async function assessFeedbackQuality(
  feedbackText: string,
  eventContext: { name: string; description: string }
): Promise<FeedbackQualityResult> {
  // Use a lightweight model (e.g., OpenAI text-moderation or a fine-tuned classifier)
  // to score the feedback for:
  // 1. Relevance to the event
  // 2. Coherence and substantiveness
  // 3. Absence of spam patterns (repeated characters, copy-pasted boilerplate)
  // Implementation depends on chosen NLP provider.
  // ...
}
```

- Feedback scoring below a threshold (e.g., 0.3) is auto-rejected with a message asking the buyer to revise.
- Feedback scoring between 0.3 and 0.6 is queued for manual review.
- Feedback scoring above 0.6 is auto-approved.

### 6.4 Rate Limiting Per Buyer

- One feedback submission per buyer per event.
- Maximum 3 revision attempts if the initial submission is rejected for quality.
- Global rate limit: a single buyer cannot submit feedback for more than 10 events in a 24-hour period (prevents automated farming across events).

---

## 7. Oracle Integration

### 7.1 Chainlink Functions

Chainlink Functions allows execution of arbitrary JavaScript in a decentralized oracle network, making it suitable for off-chain computation that needs on-chain verifiability.

**Use case in Quest Payments:** Verify a social media post exists and contains required content, then return the result on-chain for the attestation contract to consume.

```solidity
// Simplified Chainlink Functions consumer contract (Solidity)
// Deployed on Base L2

import {FunctionsClient} from "@chainlink/contracts/src/v0.8/functions/v1_0_0/FunctionsClient.sol";

contract IncentiveVerifier is FunctionsClient {
    bytes32 public lastRequestId;
    bytes public lastResponse;

    constructor(address router) FunctionsClient(router) {}

    function requestVerification(
        string calldata source,    // JavaScript source for verification logic
        bytes calldata encryptedArgs, // API keys, tweet URL, etc. (encrypted with DON public key)
        uint64 subscriptionId,
        uint32 gasLimit,
        bytes32 donId
    ) external returns (bytes32 requestId) {
        FunctionsRequest.Request memory req;
        req.initializeRequestForInlineJavaScript(source);
        req.addDONHostedSecrets(encryptedArgs, 0);

        lastRequestId = _sendRequest(req.encodeCBOR(), subscriptionId, gasLimit, donId);
        return lastRequestId;
    }

    function fulfillRequest(
        bytes32 requestId,
        bytes memory response,
        bytes memory err
    ) internal override {
        lastResponse = response;
        // Decode response and trigger attestation or rejection
    }
}
```

**Chainlink Functions on Base:**
- Supported on Base mainnet via the Chainlink Functions router.
- Cost: ~$0.01-0.05 per request depending on computation time and gas.
- Suitable for batch verification of social actions where on-chain verifiability is required.

**When to use:** Reserve Chainlink Functions for high-value incentives or when the event organizer requires decentralized verification guarantees. For most social share verifications, the centralized API approach (Section 3) is more cost-effective.

### 7.2 API3 First-Party Oracles

API3 provides first-party oracle services where the data provider operates the oracle node directly, removing the third-party oracle trust assumption.

**Use case:** If Quest Payments partners with a social media analytics provider, that provider can run an API3 Airnode to serve verification results directly on-chain.

```
┌──────────────────┐     ┌──────────────┐     ┌──────────────┐
│ Social Analytics │────>│ API3 Airnode │────>│ Base L2      │
│ Provider API     │     │ (provider-   │     │ dAPI / QRNG  │
│                  │     │  operated)   │     │              │
└──────────────────┘     └──────────────┘     └──────────────┘
```

- **Advantage:** Eliminates the "oracle problem" for that specific data source since the data provider IS the oracle.
- **Disadvantage:** Requires the data provider to operate an Airnode, which is only practical for larger partners.

### 7.3 Custom Oracle for Proprietary Verification

Some incentive types involve proprietary systems that neither Chainlink nor API3 can easily access:
- **Sponsor session attendance:** The sponsor's internal system tracks who attended their booth or session (badge scan, app check-in). This data is not publicly available.
- **App engagement:** A sponsor's app tracks how long a user engaged with their content.

**Custom oracle pattern:**

1. The proprietary system exposes a webhook or API endpoint.
2. A Quest Payments oracle service polls or receives data from the proprietary system.
3. The oracle service verifies the data against expected parameters and publishes an `incentive.verified` event.
4. The oracle's signing key is registered as a trusted attester in the EAS schema.

```typescript
// Custom oracle service
class SponsorSessionOracle {
  constructor(
    private sponsorApiClient: SponsorApiClient,
    private verificationStore: VerificationStore,
    private attestationService: AttestationService,
  ) {}

  async processSessionAttendance(
    eventId: string,
    sessionId: string,
    attendeeId: string,
  ): Promise<void> {
    // Query sponsor's proprietary system
    const attended = await this.sponsorApiClient.checkAttendance({
      sessionId,
      attendeeId,
    });

    if (attended.confirmed) {
      await this.verificationStore.updateState(
        attendeeId,
        sessionId,
        "verified",
      );

      await this.attestationService.attest({
        purchaseId: attended.purchaseId,
        incentiveId: `sponsor-session:${sessionId}`,
        verifierAddress: this.oracleAddress,
        timestamp: Math.floor(Date.now() / 1000),
        proofHash: computeProofHash(attended),
      });
    }
  }
}
```

### 7.4 Trust Assumptions

| Oracle Type | Trust Model | Best For |
|---|---|---|
| Centralized (Quest backend) | Trust Quest Payments backend. Single point of failure but fast and cheap. | MVP, low-stakes incentives. |
| Chainlink Functions | Trust Chainlink DON (decentralized oracle network). Higher cost but more robust. | High-value incentives, regulatory requirements. |
| API3 Airnode | Trust the first-party data provider. Eliminates third-party oracle risk. | Partner-operated data sources. |
| Custom oracle | Trust the proprietary system operator + Quest oracle service. | Sponsor-specific verification. |
| Human review | Trust the designated reviewer(s). Slowest but most flexible. | Edge cases, dispute resolution, high-value manual verification. |

---

## 8. Anti-Gaming and Fraud Prevention

### 8.1 Sybil Resistance

The core Sybil attack: one person creates multiple accounts to farm incentive discounts across those accounts.

**Mitigations (layered):**

1. **Payment identity linkage:** Require a unique payment method per account. Two accounts sharing the same credit card last-4 + expiry or the same Base wallet address are flagged.
2. **Email verification:** Require verified email for account creation. Flag disposable email domains (use a maintained list like `disposable-email-domains` npm package).
3. **Phone verification (optional, higher friction):** SMS OTP for account creation. One phone number per account. Use a service like Twilio Verify.
4. **Device fingerprinting:** Use a fingerprinting library (e.g., FingerprintJS) to identify when the same device creates multiple accounts. Not foolproof but raises the bar.
5. **Behavioral analysis:** Flag accounts that exhibit identical interaction patterns (same timing, same IP, same browser fingerprint) across incentive completions.

### 8.2 Bot Detection on Social Actions

- **CAPTCHA at submission:** When a buyer submits a social share URL for verification, require a CAPTCHA (hCaptcha or Cloudflare Turnstile) to confirm a human is submitting.
- **Twitter account quality signals:** Automated check of the Twitter account's follower count, tweet history length, account age, and profile completeness. Accounts below quality thresholds are rejected or queued for manual review.
- **Timing analysis:** If a tweet is created and the verification URL is submitted within an implausibly short window (< 5 seconds), flag for review.

### 8.3 Rate Limiting and Velocity Checks

| Check | Limit | Action on Breach |
|---|---|---|
| Verification submissions per buyer per hour | 10 | Reject with 429, queue for review. |
| Referral code redemptions per code per hour | 5 | Reject with 429, notify referrer. |
| Failed verifications per buyer per day | 20 | Temporarily suspend buyer's incentive access. |
| Verifications per IP per hour | 50 | CAPTCHA challenge on subsequent requests. |
| New accounts per IP per day | 3 | Require additional verification (phone, waiting period). |

Implement using Redis-backed sliding window rate limiters (`ioredis` + Lua scripting or the `rate-limiter-flexible` npm package).

### 8.4 Human-in-the-Loop Review

Not all verification can be fully automated. Establish a review queue for:
- Verification attempts that fail automated checks but are plausibly legitimate (e.g., tweet content is slightly different from expected).
- High-value incentives above a configurable threshold.
- Flagged Sybil or bot patterns.
- Any verification type where the confidence score is below the auto-approve threshold.

The review queue surfaces in an organizer dashboard with tools to:
- View the submitted evidence (URL, screenshot, form data).
- View the automated verification result and reason for flagging.
- Approve, reject, or request additional evidence from the buyer.
- Bulk approve/reject with filters.

### 8.5 Economic Analysis

Gaming is economically self-limiting when the cost of gaming exceeds the discount value:

```
Gaming Profit = Discount Value - Cost of Gaming

Cost of Gaming includes:
  - Time to create fake accounts
  - Cost of unique payment methods (prepaid cards, etc.)
  - Cost of unique phone numbers (if phone verification required)
  - Risk of detection and account ban
  - Opportunity cost
```

**Design principle:** Set discount values per incentive type such that the total possible discount per ticket does not exceed 30-50% of face value. This caps the maximum gaming profit. Combined with the identity and rate-limiting mitigations above, the expected value of gaming becomes negative for all but the most sophisticated attackers.

**Example:** If a $100 ticket offers maximum $30 in incentive discounts, and each discount requires a separate verified action (each costing ~$2-5 in effort/risk to fake), the attacker's maximum profit per ticket is $30 - $10-25 in gaming costs = $5-20. With detection risk factored in, this is marginal.

For very high-value events, increase verification strictness (require phone verification, higher social account quality thresholds, human review for all incentives).

---

## 9. TypeScript Interface Sketch

### 9.1 Core Types

```typescript
// ---- Incentive Types ----

export type IncentiveType =
  | "social_share"
  | "referral"
  | "check_in"
  | "sponsor_session"
  | "feedback"
  | "custom";

export type VerificationState =
  | "pending"
  | "submitted"
  | "verifying"
  | "verified"
  | "rejected"
  | "expired";

export type Platform = "twitter" | "instagram" | "linkedin" | "custom";

// ---- Verification Request ----

export interface VerificationRequest {
  /** Unique ID for this verification attempt */
  verificationId: string;

  /** The purchase this verification is associated with */
  purchaseId: string;

  /** The specific incentive being verified */
  incentiveId: string;

  /** Type of incentive */
  incentiveType: IncentiveType;

  /** Buyer's identity (internal user ID) */
  buyerId: string;

  /** Evidence submitted by the buyer */
  evidence: VerificationEvidence;

  /** When the verification was requested */
  requestedAt: Date;

  /** Deadline for verification completion */
  expiresAt: Date;

  /** Optional metadata for the verifier */
  context?: Record<string, unknown>;
}

// ---- Evidence Types ----

export type VerificationEvidence =
  | SocialShareEvidence
  | ReferralEvidence
  | CheckInEvidence
  | SponsorSessionEvidence
  | FeedbackEvidence;

export interface SocialShareEvidence {
  type: "social_share";
  platform: Platform;
  postUrl: string;
  authorHandle?: string;
  screenshotUrl?: string;
}

export interface ReferralEvidence {
  type: "referral";
  referralCode: string;
  refereeId: string;
  refereePurchaseId: string;
}

export interface CheckInEvidence {
  type: "check_in";
  method: "qr" | "nfc" | "geolocation" | "beacon" | "platform_webhook";
  payload: string;          // QR/NFC payload, or serialized geo/beacon data
  scannedAt: Date;
  deviceFingerprint?: string;
}

export interface SponsorSessionEvidence {
  type: "sponsor_session";
  sessionId: string;
  sponsorId: string;
  attendanceProof: string;  // badge scan ID, app event ID, etc.
}

export interface FeedbackEvidence {
  type: "feedback";
  formResponseId: string;
  ratings: Record<string, number>;
  freeformText: string;
  submittedAt: Date;
}

// ---- Verification Response ----

export interface VerificationResponse {
  /** Echoed from the request */
  verificationId: string;

  /** Final state */
  state: VerificationState;

  /** Human-readable reason (especially for rejections) */
  reason?: string;

  /** Machine-readable rejection code */
  rejectionCode?: string;

  /** Confidence score from the verifier (0.0 - 1.0) */
  confidence?: number;

  /** When the verification was completed */
  completedAt?: Date;

  /** EAS attestation UID if attested on-chain */
  attestationUid?: string;

  /** Whether the buyer can retry */
  retryAllowed: boolean;

  /** Number of retries remaining */
  retriesRemaining?: number;
}

// ---- Discount Result ----

export interface DiscountResult {
  /** The incentive that generated this discount */
  incentiveId: string;

  /** Discount amount in USDC (6 decimals, stored as string to avoid floating point) */
  discountAmountUsdc: string;

  /** Percentage discount (0-100), mutually exclusive with flat amount */
  discountPercentage?: number;

  /** Whether this discount has been applied to the purchase */
  applied: boolean;

  /** The verification that backs this discount */
  verificationId: string;
}
```

### 9.2 Verifier Interface

```typescript
/**
 * Core interface that all incentive verifiers must implement.
 * Each incentive type has exactly one adapter registered in the VerifierRegistry.
 */
export interface IIncentiveVerifier {
  /**
   * The incentive type this verifier handles.
   * Used by the VerifierRegistry for routing.
   */
  readonly incentiveType: IncentiveType;

  /**
   * Verify the submitted evidence for a given incentive.
   * Must be idempotent: calling verify() twice with the same request
   * should return the same result without side effects.
   *
   * @param request - The verification request with evidence
   * @returns The verification result
   * @throws VerifierUnavailableError if the verifier cannot process
   *         the request (e.g., external API down). The caller will retry.
   */
  verify(request: VerificationRequest): Promise<VerificationResponse>;

  /**
   * Optional: Check if a previously verified action is still valid.
   * Used for post-verification audits (e.g., checking if a tweet still exists).
   *
   * @param verificationId - The verification to re-check
   * @returns Updated verification response
   */
  recheck?(verificationId: string): Promise<VerificationResponse>;

  /**
   * Health check for the verifier.
   * Returns true if the verifier's dependencies (APIs, DBs) are available.
   */
  isHealthy(): Promise<boolean>;
}

/**
 * Custom error type for temporarily unavailable verifiers.
 * The orchestrator should retry with exponential backoff.
 */
export class VerifierUnavailableError extends Error {
  constructor(
    public readonly verifierType: IncentiveType,
    public readonly retryAfterMs: number,
    message: string,
  ) {
    super(message);
    this.name = "VerifierUnavailableError";
  }
}
```

### 9.3 Verifier Registry

```typescript
/**
 * Registry that maps incentive types to their verifier adapters.
 * Supports runtime registration for plugin-style extensibility.
 */
export class VerifierRegistry {
  private verifiers = new Map<IncentiveType, IIncentiveVerifier>();

  register(verifier: IIncentiveVerifier): void {
    if (this.verifiers.has(verifier.incentiveType)) {
      throw new Error(
        `Verifier already registered for type: ${verifier.incentiveType}`,
      );
    }
    this.verifiers.set(verifier.incentiveType, verifier);
  }

  get(type: IncentiveType): IIncentiveVerifier {
    const verifier = this.verifiers.get(type);
    if (!verifier) {
      throw new Error(`No verifier registered for type: ${type}`);
    }
    return verifier;
  }

  async healthCheck(): Promise<Map<IncentiveType, boolean>> {
    const results = new Map<IncentiveType, boolean>();
    for (const [type, verifier] of this.verifiers) {
      try {
        results.set(type, await verifier.isHealthy());
      } catch {
        results.set(type, false);
      }
    }
    return results;
  }
}
```

### 9.4 Example Adapter: Twitter Social Share Verifier

```typescript
import type {
  IIncentiveVerifier,
  VerificationRequest,
  VerificationResponse,
  IncentiveType,
  SocialShareEvidence,
} from "./types";

interface TwitterVerifierConfig {
  bearerToken: string;
  minAccountAgeDays: number;
  minFollowerCount: number;
  requiredHashtags: string[];
  requiredMentions: string[];
  recheckDelayMs: number;
}

export class TwitterShareVerifier implements IIncentiveVerifier {
  readonly incentiveType: IncentiveType = "social_share";

  constructor(private config: TwitterVerifierConfig) {}

  async verify(request: VerificationRequest): Promise<VerificationResponse> {
    const evidence = request.evidence as SocialShareEvidence;

    if (evidence.platform !== "twitter") {
      return this.reject(request, "wrong_platform", "This verifier only handles Twitter");
    }

    // 1. Extract tweet ID from URL
    const tweetId = this.extractTweetId(evidence.postUrl);
    if (!tweetId) {
      return this.reject(request, "invalid_url", "Could not extract tweet ID from URL");
    }

    // 2. Fetch tweet from X API v2
    const tweet = await this.fetchTweet(tweetId);
    if (!tweet) {
      return this.reject(request, "tweet_not_found", "Tweet does not exist or is not accessible");
    }

    // 3. Verify content contains required hashtags and mentions
    const contentCheck = this.verifyContent(tweet.text);
    if (!contentCheck.valid) {
      return this.reject(request, "content_mismatch", contentCheck.reason!);
    }

    // 4. Verify author account quality
    const author = await this.fetchUser(tweet.author_id);
    if (!author) {
      return this.reject(request, "author_not_found", "Could not verify tweet author");
    }

    const authorCheck = this.verifyAuthorQuality(author);
    if (!authorCheck.valid) {
      return this.reject(request, "author_quality", authorCheck.reason!);
    }

    // 5. All checks passed
    return {
      verificationId: request.verificationId,
      state: "verified",
      confidence: 0.95,
      completedAt: new Date(),
      retryAllowed: false,
    };
  }

  async recheck(verificationId: string): Promise<VerificationResponse> {
    // Re-fetch the tweet to confirm it still exists
    // Implementation: look up the original evidence from the store,
    // re-run fetchTweet, return updated state
    throw new Error("Not implemented: requires verification store dependency");
  }

  async isHealthy(): Promise<boolean> {
    try {
      // Ping X API with a known tweet ID
      const response = await fetch(
        "https://api.x.com/2/tweets/20", // Jack Dorsey's first tweet
        { headers: { Authorization: `Bearer ${this.config.bearerToken}` } },
      );
      return response.ok;
    } catch {
      return false;
    }
  }

  // ---- Private helpers ----

  private extractTweetId(url: string): string | null {
    // Handles both twitter.com and x.com URLs
    const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
    return match ? match[1] : null;
  }

  private async fetchTweet(
    tweetId: string,
  ): Promise<{ id: string; text: string; author_id: string; created_at: string } | null> {
    const response = await fetch(
      `https://api.x.com/2/tweets/${tweetId}?tweet.fields=author_id,created_at,text`,
      { headers: { Authorization: `Bearer ${this.config.bearerToken}` } },
    );

    if (!response.ok) return null;
    const json = await response.json();
    return json.data ?? null;
  }

  private async fetchUser(
    userId: string,
  ): Promise<{
    id: string;
    username: string;
    created_at: string;
    public_metrics: { followers_count: number };
  } | null> {
    const response = await fetch(
      `https://api.x.com/2/users/${userId}?user.fields=created_at,public_metrics`,
      { headers: { Authorization: `Bearer ${this.config.bearerToken}` } },
    );

    if (!response.ok) return null;
    const json = await response.json();
    return json.data ?? null;
  }

  private verifyContent(tweetText: string): { valid: boolean; reason?: string } {
    const lowerText = tweetText.toLowerCase();

    for (const hashtag of this.config.requiredHashtags) {
      if (!lowerText.includes(hashtag.toLowerCase())) {
        return { valid: false, reason: `Missing required hashtag: ${hashtag}` };
      }
    }

    for (const mention of this.config.requiredMentions) {
      if (!lowerText.includes(mention.toLowerCase())) {
        return { valid: false, reason: `Missing required mention: ${mention}` };
      }
    }

    return { valid: true };
  }

  private verifyAuthorQuality(author: {
    created_at: string;
    public_metrics: { followers_count: number };
  }): { valid: boolean; reason?: string } {
    const accountAgeDays =
      (Date.now() - new Date(author.created_at).getTime()) / (1000 * 60 * 60 * 24);

    if (accountAgeDays < this.config.minAccountAgeDays) {
      return {
        valid: false,
        reason: `Account is ${Math.floor(accountAgeDays)} days old, minimum is ${this.config.minAccountAgeDays}`,
      };
    }

    if (author.public_metrics.followers_count < this.config.minFollowerCount) {
      return {
        valid: false,
        reason: `Account has ${author.public_metrics.followers_count} followers, minimum is ${this.config.minFollowerCount}`,
      };
    }

    return { valid: true };
  }

  private reject(
    request: VerificationRequest,
    code: string,
    reason: string,
  ): VerificationResponse {
    return {
      verificationId: request.verificationId,
      state: "rejected",
      reason,
      rejectionCode: code,
      confidence: 1.0,
      completedAt: new Date(),
      retryAllowed: true,
      retriesRemaining: 2,
    };
  }
}
```

---

## 10. Recommended Architecture

### 10.1 Start with REST API-Based Verification

For the MVP, all verification flows are triggered via REST API calls from the buyer's client. No websockets, no long-polling, no complex event streaming. Keep it simple.

```
POST   /api/v1/verifications              # Submit evidence for verification
GET    /api/v1/verifications/:id          # Poll verification status
GET    /api/v1/purchases/:id/incentives   # List all incentives and their states for a purchase
POST   /api/v1/check-in                   # Submit check-in evidence (QR, NFC, etc.)
POST   /api/v1/feedback/:purchaseId       # Submit feedback form
```

**Verification is asynchronous:** `POST /api/v1/verifications` returns `202 Accepted` with the `verificationId`. The client polls `GET /api/v1/verifications/:id` until the state is terminal (`verified`, `rejected`, or `expired`). For most verifications (social share, referral), resolution takes 1-5 seconds. For manual review, it may take hours.

### 10.2 Use EAS on Base for On-Chain Attestation Records

Every `verified` state transition triggers an on-chain attestation via EAS (Section 2). This creates a permanent, auditable record that:
- The buyer completed the incentive action.
- The specific verifier confirmed it.
- The evidence hash is anchored to an immutable timestamp.

The attestation UID is stored alongside the verification record in the database for cross-referencing.

**Cost estimate:** At current Base L2 gas prices (~0.001 gwei L2 fee + ~0.01 gwei L1 data fee), each EAS attestation costs approximately $0.001-0.01. For an event with 1,000 tickets and 5 incentives per ticket, the total attestation cost is approximately $5-50 -- negligible relative to ticket prices.

### 10.3 Pluggable Adapters for Extensibility

The `VerifierRegistry` pattern (Section 9.3) ensures that adding a new incentive type requires:
1. Defining the evidence type.
2. Implementing the `IIncentiveVerifier` interface.
3. Registering the adapter in the application bootstrap.

No changes to the REST API layer, discount engine, or settlement pipeline are required.

**Example of adding a new adapter at bootstrap:**

```typescript
import { VerifierRegistry } from "./verification/registry";
import { TwitterShareVerifier } from "./verification/adapters/twitter";
import { ReferralVerifier } from "./verification/adapters/referral";
import { QRCheckInVerifier } from "./verification/adapters/checkin-qr";
import { FeedbackVerifier } from "./verification/adapters/feedback";
import { SponsorSessionVerifier } from "./verification/adapters/sponsor-session";

export function buildVerifierRegistry(config: AppConfig): VerifierRegistry {
  const registry = new VerifierRegistry();

  registry.register(new TwitterShareVerifier({
    bearerToken: config.twitter.bearerToken,
    minAccountAgeDays: 30,
    minFollowerCount: 10,
    requiredHashtags: [],    // configured per event
    requiredMentions: [],    // configured per event
    recheckDelayMs: 3600000, // 1 hour
  }));

  registry.register(new ReferralVerifier({
    attributionWindowDays: 7,
    maxReferralsPerCode: 50,
    requireDistinctPaymentMethod: true,
  }));

  registry.register(new QRCheckInVerifier({
    hmacSecret: config.checkin.hmacSecret,
    maxScanAgeMs: 300000, // 5 minutes
  }));

  registry.register(new FeedbackVerifier({
    minTextLength: 100,
    submissionWindowDays: 7,
    maxRevisionsPerBuyer: 3,
    nlpQualityThreshold: 0.3,
  }));

  registry.register(new SponsorSessionVerifier({
    sponsorApiBaseUrl: config.sponsor.apiBaseUrl,
    sponsorApiKey: config.sponsor.apiKey,
  }));

  return registry;
}
```

### 10.4 Event Sourcing for Full Audit Trail

All verification state changes are persisted as **immutable events** in an append-only store, not as mutable rows in a verification table.

**Event types:**

```typescript
type VerificationEvent =
  | { type: "verification.requested"; data: VerificationRequest; timestamp: Date }
  | { type: "verification.started"; data: { verificationId: string; adapterType: IncentiveType }; timestamp: Date }
  | { type: "verification.completed"; data: VerificationResponse; timestamp: Date }
  | { type: "verification.failed"; data: VerificationResponse; timestamp: Date }
  | { type: "verification.expired"; data: { verificationId: string; reason: string }; timestamp: Date }
  | { type: "verification.rechecked"; data: { verificationId: string; stillValid: boolean }; timestamp: Date }
  | { type: "attestation.created"; data: { verificationId: string; attestationUid: string; txHash: string }; timestamp: Date }
  | { type: "attestation.revoked"; data: { verificationId: string; attestationUid: string; reason: string }; timestamp: Date }
  | { type: "discount.applied"; data: DiscountResult; timestamp: Date }
  | { type: "discount.revoked"; data: { discountId: string; reason: string }; timestamp: Date };
```

**Storage:** For MVP, use a PostgreSQL table with JSONB columns:

```sql
CREATE TABLE verification_events (
    id              BIGSERIAL PRIMARY KEY,
    verification_id UUID NOT NULL,
    purchase_id     UUID NOT NULL,
    event_type      VARCHAR(64) NOT NULL,
    event_data      JSONB NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Index for reconstructing a verification's history
    CONSTRAINT idx_verification_events_vid
        UNIQUE (verification_id, id)
);

CREATE INDEX idx_verification_events_purchase
    ON verification_events (purchase_id, created_at);

CREATE INDEX idx_verification_events_type
    ON verification_events (event_type, created_at);
```

**Current state** is derived by replaying events for a given `verification_id`. For performance, maintain a **materialized view** or **projection table** (`verification_current_state`) that is updated by an event handler whenever a new event is appended.

### 10.5 Graceful Degradation

Automated verification is inherently dependent on external systems (X API, event platform APIs, blockchain RPCs). The system must degrade gracefully when these dependencies are unavailable.

**Degradation strategy:**

| Failure Scenario | Behavior |
|---|---|
| X API rate limited or down | Queue the verification for retry with exponential backoff (initial: 30s, max: 5min, max retries: 10). If all retries exhausted, move to manual review queue. |
| EAS attestation transaction fails | Store the verification result in the database as `verified`. Retry attestation in background. The attestation is a record, not a gate -- the discount is applied based on the database state, not the on-chain state. |
| Event platform webhook delayed | Allow a 15-minute grace period for webhook delivery. If not received, offer the buyer a manual check-in flow (QR code as fallback). |
| NLP quality assessment service down | Skip NLP quality check; apply only the deterministic quality gates (minimum length, required fields). Flag for manual review if NLP is a configured requirement. |
| Custom oracle / sponsor API unreachable | Queue for retry. If sponsor system is offline for extended period, notify the event organizer and offer manual verification. |

**Circuit breaker pattern:** Each adapter maintains a circuit breaker (e.g., using the `opossum` npm package). After N consecutive failures, the circuit opens, and all requests to that adapter are immediately routed to the manual review queue. The circuit half-opens after a configurable timeout to test if the dependency has recovered.

```typescript
import CircuitBreaker from "opossum";

function wrapWithCircuitBreaker(
  verifier: IIncentiveVerifier,
  options: { timeout: number; errorThresholdPercentage: number; resetTimeout: number },
): IIncentiveVerifier {
  const breaker = new CircuitBreaker(
    (request: VerificationRequest) => verifier.verify(request),
    options,
  );

  breaker.on("open", () => {
    console.warn(`Circuit breaker OPEN for verifier: ${verifier.incentiveType}`);
  });

  breaker.on("halfOpen", () => {
    console.info(`Circuit breaker HALF-OPEN for verifier: ${verifier.incentiveType}`);
  });

  return {
    incentiveType: verifier.incentiveType,
    verify: (request) => breaker.fire(request) as Promise<VerificationResponse>,
    recheck: verifier.recheck?.bind(verifier),
    isHealthy: () => breaker.opened
      ? Promise.resolve(false)
      : verifier.isHealthy(),
  };
}
```

### 10.6 End-to-End Flow Summary

```
┌─────────┐  1. Submit evidence   ┌─────────────┐  2. Route to adapter   ┌──────────────┐
│  Buyer   │─────────────────────>│  REST API    │───────────────────────>│  Verifier    │
│  Client  │  POST /verifications │  (Express)   │  via VerifierRegistry  │  Adapter     │
└─────────┘                       └──────┬───────┘                        └──────┬───────┘
     │                                    │                                       │
     │  6. Poll for result                │  3. Persist event                     │ 4. Verify
     │  GET /verifications/:id            │  (event sourcing)                     │ (API call,
     │                                    ▼                                       │  DB lookup,
     │                            ┌──────────────┐                                │  oracle)
     │                            │  Event Store │                                │
     │                            │  (Postgres)  │                                │
     │                            └──────────────┘                                │
     │                                    │                                       │
     │                                    │  5. On verified:                      │
     │                                    │                                       ▼
     │                            ┌───────▼──────┐  7. Update price       ┌──────────────┐
     │                            │  Discount    │<──────────────────────│  Verification │
     │                            │  Engine      │                        │  Result       │
     │                            └───────┬──────┘                        └──────────────┘
     │                                    │                                       │
     │                                    │  8. Final price                       │
     │                                    ▼                                       │
     │                            ┌──────────────┐  9. Attest on-chain    ┌──────────────┐
     │                            │  x402 USDC   │                        │  EAS on Base │
     │                            │  Settlement  │                        │  (attestation)│
     │                            └──────────────┘                        └──────────────┘
     │                                    │
     ◄────────────────────────────────────┘
              10. Confirmation + ticket
```

### 10.7 Technology Stack Summary

| Component | Technology | Rationale |
|---|---|---|
| API framework | Express.js or Fastify (Node.js) | Proven, fast, large ecosystem. |
| Message queue (MVP) | Bull (Redis-backed) | Simple, battle-tested for async job processing. |
| Message queue (scale) | AWS SQS or Google Cloud Pub/Sub | Managed, scales automatically. |
| Database | PostgreSQL | JSONB support for event sourcing, strong consistency. |
| Cache / rate limiting | Redis | Sub-millisecond operations, native TTL support, Lua scripting for atomic rate limiting. |
| On-chain attestation | EAS SDK + ethers.js on Base L2 | Sub-cent transaction costs, permanent records. |
| Circuit breaker | opossum (npm) | Lightweight, well-maintained. |
| Social API clients | Native fetch (Node 18+) | No need for heavy SDKs; X API v2 is straightforward REST. |
| Blockchain RPC | Alchemy or QuickNode (Base) | Reliable, low-latency Base L2 access. |
| Observability | OpenTelemetry + Grafana or Datadog | Traces across async verification flows. |

---

## Appendix A: EAS Schema Registration

One-time schema registration during deployment:

```typescript
import { SchemaRegistry } from "@ethereum-attestation-service/eas-sdk";
import { ethers } from "ethers";

const SCHEMA_REGISTRY_ADDRESS = "0x4200000000000000000000000000000000000020"; // Base

async function registerIncentiveSchema(): Promise<string> {
  const provider = new ethers.JsonRpcProvider("https://mainnet.base.org");
  const signer = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY!, provider);

  const schemaRegistry = new SchemaRegistry(SCHEMA_REGISTRY_ADDRESS);
  schemaRegistry.connect(signer);

  const tx = await schemaRegistry.register({
    schema:
      "bytes32 purchaseId, bytes32 incentiveId, address verifierAddress, uint64 timestamp, bytes32 proofHash",
    resolverAddress: ethers.ZeroAddress, // no custom resolver for MVP
    revocable: true,
  });

  const schemaUid = await tx.wait();
  console.log("Registered schema UID:", schemaUid);
  return schemaUid;
}
```

## Appendix B: Verification Configuration Per Event

Event organizers configure which incentives are active and their parameters:

```typescript
interface EventIncentiveConfig {
  eventId: string;

  incentives: Array<{
    incentiveId: string;
    type: IncentiveType;
    enabled: boolean;

    /** Discount granted upon verification */
    discount: {
      type: "fixed" | "percentage";
      value: number; // USDC amount (fixed) or percentage (0-100)
    };

    /** Maximum number of times this incentive can be claimed across all buyers */
    globalCap?: number;

    /** Maximum number of times a single buyer can claim this incentive */
    perBuyerCap: number;

    /** Verification-specific configuration */
    verifierConfig: Record<string, unknown>;

    /** Time window during which this incentive is available */
    availableFrom?: Date;
    availableUntil?: Date;
  }>;

  /** Maximum total discount per purchase (USDC or percentage of face value) */
  maxTotalDiscount: {
    type: "fixed" | "percentage";
    value: number;
  };
}
```

## Appendix C: Monitoring and Alerting

Key metrics to track for the verification subsystem:

| Metric | Alert Threshold | Description |
|---|---|---|
| `verification.latency.p99` | > 30s | 99th percentile time from submission to terminal state. |
| `verification.failure_rate` | > 10% per adapter per hour | Percentage of verifications ending in system error (not user rejection). |
| `verification.queue_depth` | > 1000 pending | Number of verifications waiting for processing. |
| `attestation.failure_rate` | > 5% per hour | EAS attestation transaction failures. |
| `adapter.circuit_breaker.open` | any | Any adapter's circuit breaker has tripped. |
| `manual_review.queue_depth` | > 100 per event | Manual review items accumulating faster than reviewers can process. |
| `referral.sybil_score` | > 0.8 for any buyer | Buyer flagged as likely Sybil by identity linkage analysis. |
| `social.recheck_failure_rate` | > 20% per day | Tweets being deleted after verification at a high rate (possible gaming). |
