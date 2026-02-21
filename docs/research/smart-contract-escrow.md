# Smart Contract Escrow Design for Quest Payments

**Status:** Research / Draft
**Date:** 2026-02-21
**Author:** Quest Payments Team

---

## 1. Escrow Architecture Overview

Quest Payments is an incentive-based event ticket payment mechanism. A buyer purchases a ticket with USDC, which is held in escrow on-chain. As the buyer completes incentive quests (e.g., engaging with sponsors, attending sessions, sharing on social media), verified discounts accumulate against the escrowed amount. At settlement, the earned discount is returned to the buyer and only the net amount is released to the event organizer.

### End-to-End Flow

```
Buyer approves USDC spend
        |
        v
Buyer calls createEscrow() -- USDC transferred to contract
        |
        v
Escrow state: Funded -> Active
        |
        v
Verifier calls applyDiscount() one or more times
  (each call records a verified incentive completion)
        |
        v
Deadline reached or all incentives resolved
        |
        v
Anyone calls settle()
        |
        v
Contract transfers (deposit - earnedDiscount) to organizer
Contract transfers earnedDiscount back to buyer
        |
        v
Escrow state: Released
```

### Actors

| Actor | Role | On-Chain Identity |
|-------|------|-------------------|
| **Buyer** | Deposits USDC, receives discount refund at settlement | EOA or smart wallet |
| **Organizer** | Receives net payment after discounts | EOA or multisig |
| **Verifier** | Attests that a buyer completed an incentive quest | Contract or oracle with VERIFIER_ROLE |
| **Admin/Governance** | Pauses contracts, upgrades, sets global parameters | Multisig with ADMIN_ROLE |

### Target Chain: Base L2

Base is the target deployment chain for the following reasons:

- **Sub-cent gas costs:** A typical `applyDiscount` call costs < $0.001 on Base, making per-incentive verification economically viable.
- **USDC native support:** Circle has deployed native USDC on Base (not bridged), eliminating bridge risk.
- **Coinbase ecosystem alignment:** Base is built by Coinbase, which aligns with the x402 payment protocol and Coinbase Developer Platform tooling.
- **Ethereum security inheritance:** Base is an OP Stack L2 that settles to Ethereum mainnet.

---

## 2. Contract Design

### ERC-20 Approval and Transfer Pattern

The escrow contract interacts with USDC using the standard ERC-20 interface. The buyer must first approve the escrow contract to spend USDC on their behalf, then the contract pulls the funds during escrow creation.

```
1. buyer calls USDC.approve(escrowContract, amount)
2. buyer calls escrowContract.createEscrow(...)
3. escrowContract internally calls USDC.transferFrom(buyer, address(this), amount)
```

For improved UX, consider supporting EIP-2612 `permit` so approval and deposit happen in a single transaction. However, note that USDC on Base may or may not support `permit` -- verify before relying on it.

### Escrow State Machine

Each escrow instance follows a strict state machine:

```
                  +---> Expired (timeout, no settlement)
                  |
Created -> Funded -> Active -> Settling -> Released
                  |                          |
                  +---> Refunded (cancelled)  +---> (partial refund to buyer as discount)
```

| State | Description |
|-------|-------------|
| **Created** | Escrow record exists but is not yet funded (optional, can skip to Funded) |
| **Funded** | USDC has been transferred to the contract |
| **Active** | Incentive period is open; discounts can be applied |
| **Settling** | Settlement has been triggered; computing final amounts |
| **Released** | Net amount sent to organizer, discount sent to buyer |
| **Refunded** | Full amount returned to buyer (event cancelled) |
| **Expired** | Deadline passed without settlement; fallback logic executed |

In practice, Created and Funded can be collapsed into a single step since `createEscrow` both creates the record and pulls USDC. Similarly, Settling and Released can be atomic within a single transaction. The explicit states are useful for off-chain indexing and UI display.

### Per-Ticket Escrow vs. Pooled Escrow

**Per-Ticket Escrow** -- Each ticket purchase creates an independent escrow instance with its own state, discount tracking, and settlement.

Advantages:
- Clean isolation -- one buyer's escrow cannot affect another's.
- Simple accounting -- each escrow is self-contained.
- Easy to reason about security properties.
- Individual timeout and refund handling.

Disadvantages:
- Higher storage costs (one struct per ticket).
- More transactions for organizers with many ticket sales.
- Potential gas overhead from individual settlements.

**Pooled Escrow** -- All ticket purchases for an event go into a single pool. Discounts are tracked per-buyer within the pool, and settlement distributes from the pool.

Advantages:
- Fewer storage slots for event-level data.
- Batch settlement in one transaction.
- Lower gas for organizer operations.

Disadvantages:
- Complex internal accounting.
- One buyer's refund requires careful pool management.
- Harder to audit and reason about.
- Partial event cancellation is complicated.

**Recommendation:** Start with per-ticket escrow for simplicity and security. Introduce a batch settlement function that iterates over multiple escrow IDs to mitigate the gas cost of individual settlements. If gas costs become an issue at scale, migrate to a pooled model in a V2 upgrade.

### Discount Application Logic

```solidity
struct Escrow {
    // ...
    uint128 depositAmount;     // Original USDC deposited
    uint128 maxDiscount;       // Maximum discount the buyer can earn
    uint128 earnedDiscount;    // Accumulated verified discount so far
    // ...
}
```

When a verifier calls `applyDiscount(escrowId, incentiveId, discountAmount)`:

1. Verify the escrow is in Active state.
2. Verify the caller has VERIFIER_ROLE.
3. Verify the incentiveId has not already been applied to this escrow (prevent double-counting).
4. Compute `newEarned = earnedDiscount + discountAmount`.
5. Clamp: `newEarned = min(newEarned, maxDiscount)`.
6. Update `earnedDiscount = newEarned`.
7. Emit `DiscountApplied` event.

At settlement:
```
organizerReceives = depositAmount - earnedDiscount
buyerReceives     = earnedDiscount
```

### Timeout Mechanism

Each escrow has a `deadline` timestamp. If the escrow is not settled by the deadline, a configurable fallback applies:

- **Default behavior:** Release the full deposit amount to the organizer (buyer forfeits unclaimed discounts). This protects organizers from indefinite fund lockup.
- **Configurable fallback:** The admin can set a global or per-event policy:
  - `RELEASE_TO_ORGANIZER` -- full amount to organizer (default)
  - `RELEASE_WITH_EARNED` -- apply earned discounts, release net to organizer
  - `REFUND_TO_BUYER` -- full refund (buyer-protective)

The `expire(escrowId)` function can be called by anyone after the deadline. This allows off-chain keepers or the organizer themselves to trigger expiry.

### Emergency Withdrawal and Pause

Using OpenZeppelin's `Pausable`:

- `pause()` -- callable by ADMIN_ROLE, halts all state-changing functions.
- `unpause()` -- callable by ADMIN_ROLE, resumes operations.
- `emergencyWithdraw(escrowId)` -- callable by ADMIN_ROLE when paused, returns funds to buyer. This is a last-resort mechanism for contract migration or critical bugs.

---

## 3. Solidity Interface Sketch

### Core Data Structures

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice States of an escrow lifecycle
enum EscrowState {
    NonExistent,  // Default zero value, escrow does not exist
    Active,       // Funded and accepting discount applications
    Released,     // Settled: net to organizer, discount to buyer
    Refunded,     // Full refund to buyer (event cancelled)
    Expired       // Deadline passed, fallback executed
}

/// @notice Timeout fallback behavior
enum TimeoutPolicy {
    ReleaseToOrganizer,    // Full amount to organizer
    ReleaseWithEarned,     // Apply earned discounts, net to organizer
    RefundToBuyer          // Full amount back to buyer
}

/// @notice Per-ticket escrow data
struct EscrowData {
    // Slot 1: addresses
    address buyer;           // 20 bytes
    uint48  deadline;        // 6 bytes -- Unix timestamp, good until year 8.9M
    uint48  createdAt;       // 6 bytes

    // Slot 2: addresses
    address organizer;       // 20 bytes
    EscrowState state;       // 1 byte
    TimeoutPolicy timeout;   // 1 byte
    // 10 bytes free

    // Slot 3: amounts (USDC has 6 decimals, uint128 is massive overkill but safe)
    uint128 depositAmount;   // 16 bytes
    uint128 maxDiscount;     // 16 bytes

    // Slot 4: amounts
    uint128 earnedDiscount;  // 16 bytes
    uint128 eventId;         // 16 bytes
}
```

### Interface Definition

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {EscrowState, EscrowData} from "./QuestEscrowTypes.sol";

/// @title IQuestEscrow
/// @notice Interface for the Quest Payments escrow contract
/// @dev All USDC amounts use 6 decimal places (1 USDC = 1_000_000)
interface IQuestEscrow {

    // ─── Events ────────────────────────────────────────────────────────

    /// @notice Emitted when a new escrow is created and funded
    event EscrowCreated(
        uint256 indexed escrowId,
        uint128 indexed eventId,
        address indexed buyer,
        address organizer,
        uint128 depositAmount,
        uint128 maxDiscount,
        uint48  deadline
    );

    /// @notice Emitted when a verified discount is applied to an escrow
    event DiscountApplied(
        uint256 indexed escrowId,
        bytes32 indexed incentiveId,
        uint128 discountAmount,
        uint128 totalEarnedDiscount
    );

    /// @notice Emitted when an escrow is settled
    event EscrowSettled(
        uint256 indexed escrowId,
        address indexed organizer,
        address indexed buyer,
        uint128 organizerAmount,
        uint128 buyerRefundAmount
    );

    /// @notice Emitted when an escrow is fully refunded
    event EscrowRefunded(
        uint256 indexed escrowId,
        address indexed buyer,
        uint128 amount
    );

    /// @notice Emitted when an escrow expires and fallback is executed
    event EscrowExpired(
        uint256 indexed escrowId,
        TimeoutPolicy policy,
        uint128 organizerAmount,
        uint128 buyerAmount
    );

    // ─── Errors ────────────────────────────────────────────────────────

    error EscrowNotActive(uint256 escrowId);
    error EscrowNotExpired(uint256 escrowId);
    error DeadlineInPast();
    error MaxDiscountExceedsDeposit();
    error IncentiveAlreadyApplied(uint256 escrowId, bytes32 incentiveId);
    error TransferFailed();
    error Unauthorized();

    // ─── Core Functions ────────────────────────────────────────────────

    /// @notice Create and fund a new escrow for an event ticket purchase
    /// @dev Caller must have approved this contract to spend `amount` USDC
    /// @param eventId Identifier for the event
    /// @param organizer Address that receives the net payment
    /// @param amount USDC amount to deposit (6 decimals)
    /// @param maxDiscount Maximum discount the buyer can earn
    /// @param deadline Unix timestamp after which the escrow can be expired
    /// @return escrowId The unique identifier for the created escrow
    function createEscrow(
        uint128 eventId,
        address organizer,
        uint128 amount,
        uint128 maxDiscount,
        uint48  deadline
    ) external returns (uint256 escrowId);

    /// @notice Apply a verified incentive discount to an escrow
    /// @dev Only callable by an account with VERIFIER_ROLE
    /// @param escrowId The escrow to apply the discount to
    /// @param incentiveId Unique identifier for the incentive (prevents double-apply)
    /// @param discountAmount The discount amount in USDC (6 decimals)
    function applyDiscount(
        uint256 escrowId,
        bytes32 incentiveId,
        uint128 discountAmount
    ) external;

    /// @notice Settle an escrow: send net amount to organizer, earned discount to buyer
    /// @dev Callable by the organizer, buyer, or admin after incentive period
    /// @param escrowId The escrow to settle
    function settle(uint256 escrowId) external;

    /// @notice Refund the full escrowed amount to the buyer (event cancelled)
    /// @dev Only callable by an account with ORGANIZER_ROLE or ADMIN_ROLE
    /// @param escrowId The escrow to refund
    function refund(uint256 escrowId) external;

    /// @notice Execute timeout fallback for an expired escrow
    /// @dev Callable by anyone after the escrow deadline has passed
    /// @param escrowId The escrow to expire
    function expire(uint256 escrowId) external;

    // ─── View Functions ────────────────────────────────────────────────

    /// @notice Get the current state of an escrow
    /// @param escrowId The escrow to query
    /// @return state The current lifecycle state
    function getEscrowState(uint256 escrowId) external view returns (EscrowState state);

    /// @notice Get the full escrow data
    /// @param escrowId The escrow to query
    /// @return data The complete escrow struct
    function getEscrow(uint256 escrowId) external view returns (EscrowData memory data);

    /// @notice Check if an incentive has been applied to an escrow
    /// @param escrowId The escrow to query
    /// @param incentiveId The incentive to check
    /// @return applied True if the incentive has already been applied
    function isIncentiveApplied(
        uint256 escrowId,
        bytes32 incentiveId
    ) external view returns (bool applied);

    // ─── Batch Functions ───────────────────────────────────────────────

    /// @notice Apply multiple discounts in a single transaction
    /// @dev Only callable by an account with VERIFIER_ROLE
    /// @param escrowIds Array of escrow IDs
    /// @param incentiveIds Array of incentive IDs
    /// @param discountAmounts Array of discount amounts
    function batchApplyDiscount(
        uint256[] calldata escrowIds,
        bytes32[] calldata incentiveIds,
        uint128[] calldata discountAmounts
    ) external;

    /// @notice Settle multiple escrows in a single transaction
    /// @param escrowIds Array of escrow IDs to settle
    function batchSettle(uint256[] calldata escrowIds) external;
}
```

### Access Control Setup

```solidity
// Roles defined as constants
bytes32 public constant ORGANIZER_ROLE = keccak256("ORGANIZER_ROLE");
bytes32 public constant VERIFIER_ROLE  = keccak256("VERIFIER_ROLE");
bytes32 public constant ADMIN_ROLE     = keccak256("ADMIN_ROLE");

// In constructor or initializer:
_grantRole(DEFAULT_ADMIN_ROLE, adminMultisig);
_grantRole(ADMIN_ROLE, adminMultisig);
_grantRole(VERIFIER_ROLE, oracleAddress);
```

The ORGANIZER_ROLE is granted per-event or per-organizer address. A mapping can associate organizer addresses with their events to enforce that only the correct organizer can trigger refunds for their events.

### Key Implementation Snippet: settle()

```solidity
function settle(uint256 escrowId) external nonReentrant whenNotPaused {
    EscrowData storage escrow = _escrows[escrowId];

    if (escrow.state != EscrowState.Active) {
        revert EscrowNotActive(escrowId);
    }

    // Mark as released before transfers (checks-effects-interactions)
    escrow.state = EscrowState.Released;

    uint128 buyerRefund     = escrow.earnedDiscount;
    uint128 organizerAmount = escrow.depositAmount - buyerRefund;

    // Transfer net amount to organizer
    if (organizerAmount > 0) {
        bool success = USDC.transfer(escrow.organizer, organizerAmount);
        if (!success) revert TransferFailed();
    }

    // Transfer earned discount back to buyer
    if (buyerRefund > 0) {
        bool success = USDC.transfer(escrow.buyer, buyerRefund);
        if (!success) revert TransferFailed();
    }

    emit EscrowSettled(
        escrowId,
        escrow.organizer,
        escrow.buyer,
        organizerAmount,
        buyerRefund
    );
}
```

---

## 4. Security Considerations

### Reentrancy Protection

The `settle`, `refund`, and `expire` functions all make external calls to the USDC contract. Even though USDC itself is not a reentrancy vector (it does not call back into the caller), defense-in-depth demands `ReentrancyGuard` on all functions that transfer tokens.

The implementation above follows checks-effects-interactions: it updates the state to `Released` before making any external transfers. Combined with `nonReentrant`, this provides double protection.

### Integer Overflow

Solidity 0.8+ has built-in overflow/underflow checks. All arithmetic on `uint128` amounts will revert on overflow. No additional SafeMath is needed.

Key invariant to maintain:
```
earnedDiscount <= maxDiscount <= depositAmount
```

This is enforced in `applyDiscount` by clamping earnedDiscount and in `createEscrow` by requiring `maxDiscount <= amount`.

### Front-Running Risks on Discount Application

A verifier submitting `applyDiscount` could be front-run in adversarial scenarios. However, since only authorized verifiers can call this function and the incentiveId is unique per application, front-running is limited to:

- **MEV extraction:** A searcher cannot call `applyDiscount` because they lack VERIFIER_ROLE.
- **Ordering attacks:** If multiple discounts are pending, their ordering does not matter because they are additive and clamped.
- **Griefing via settlement front-running:** A malicious actor could call `settle` before the last discount is applied. Mitigation: only allow settlement after the deadline, or require organizer/admin approval for early settlement.

**Recommended mitigation:** Add a `settlementDelay` period after the last discount application before settlement is permitted, or require that settlement can only be called after the deadline.

### USDC-Specific Considerations

**6 Decimal Places:** USDC uses 6 decimals, not 18. A dollar is `1_000_000` in raw units. All amounts in the contract should be denominated in raw USDC units. Frontend and API layers are responsible for decimal conversion.

**Circle Blacklisting:** Circle can blacklist addresses, preventing them from sending or receiving USDC. If the escrow contract itself is blacklisted, all funds are frozen. Mitigations:
- Maintain contact with Circle's compliance team.
- Implement an emergency withdrawal mechanism that sends to a governance-controlled fallback address.
- Consider a proxy pattern so the contract address can be migrated.

**USDC Proxy Upgrades:** Circle's USDC is itself a proxy contract. If Circle upgrades the implementation, the escrow contract's interaction could break. This is a low-probability risk but worth monitoring. Subscribe to Circle's upgrade announcements.

**Approval Race Condition:** The classic ERC-20 `approve` race condition exists when changing an existing allowance. Use `increaseAllowance` or set allowance to zero before setting a new value. In practice, each escrow creation is a one-shot approval so this is unlikely to be an issue, but the frontend should use `increaseAllowance` if the contract is approved for repeated use.

### Audit Requirements

A focused security audit for this contract is estimated at $10,000 to $50,000 depending on the firm:

| Tier | Estimated Cost | Firms (Examples) |
|------|---------------|-------------------|
| Solo auditor | $10k - $15k | Independent security researchers |
| Mid-tier firm | $15k - $30k | Zellic, Spearbit (single auditor) |
| Top-tier firm | $30k - $50k | Trail of Bits, OpenZeppelin, Spearbit (team) |
| Audit competition | $10k - $25k (prize pool) | Code4rena, Sherlock, Hats Finance |

**Recommendation:** Start with a solo auditor or audit competition for V1. Engage a top-tier firm before holding significant TVL.

---

## 5. Gas Optimization

### Base L2 Gas Costs

Base uses a combined fee model: L2 execution fee + L1 data fee. Post-EIP-4844 (blobs), the L1 data fee is substantially reduced.

Estimated gas costs for key operations on Base (as of early 2026):

| Operation | Estimated Gas (L2) | Estimated Cost (USD) |
|-----------|-------------------|---------------------|
| `createEscrow` | ~80,000 | $0.003 - $0.01 |
| `applyDiscount` | ~50,000 | $0.002 - $0.005 |
| `settle` (two transfers) | ~70,000 | $0.003 - $0.008 |
| `batchApplyDiscount` (10 items) | ~300,000 | $0.01 - $0.03 |
| `batchSettle` (10 items) | ~500,000 | $0.02 - $0.05 |

These costs make per-incentive verification economically viable. A buyer completing 10 quests and settling costs the system less than $0.10 total in gas.

### Storage Packing for Escrow Structs

The `EscrowData` struct is carefully packed to minimize storage slots:

```solidity
// Slot 1 (32 bytes):
//   address buyer      = 20 bytes
//   uint48  deadline    =  6 bytes
//   uint48  createdAt   =  6 bytes
//   Total: 32 bytes -- fully packed

// Slot 2 (32 bytes):
//   address organizer   = 20 bytes
//   EscrowState state   =  1 byte (uint8)
//   TimeoutPolicy timeout = 1 byte (uint8)
//   Total: 22 bytes -- 10 bytes free for future use

// Slot 3 (32 bytes):
//   uint128 depositAmount = 16 bytes
//   uint128 maxDiscount   = 16 bytes
//   Total: 32 bytes -- fully packed

// Slot 4 (32 bytes):
//   uint128 earnedDiscount = 16 bytes
//   uint128 eventId        = 16 bytes
//   Total: 32 bytes -- fully packed
```

This gives us 4 storage slots per escrow. At approximately 20,000 gas for a new storage slot (SSTORE to zero) and 5,000 gas for an update (SSTORE to non-zero), the initial escrow creation costs roughly 80,000 gas for storage alone.

### Events for Off-Chain Indexing vs. On-Chain Storage

The contract emits events for all state transitions. Off-chain indexers (The Graph, Ponder, or custom) should rely on events rather than on-chain view functions for building dashboards and analytics.

Data that is only needed off-chain (e.g., ticket metadata, quest descriptions) should not be stored on-chain. Instead, emit it in events or store a content hash.

Data that the contract needs for logic must remain on-chain:
- Escrow state, amounts, addresses, deadline -- on-chain
- Incentive completion details, quest names, event metadata -- events only

### Batch Operations

The `batchApplyDiscount` and `batchSettle` functions amortize the fixed transaction overhead across multiple operations:

```solidity
function batchApplyDiscount(
    uint256[] calldata escrowIds,
    bytes32[] calldata incentiveIds,
    uint128[] calldata discountAmounts
) external onlyRole(VERIFIER_ROLE) whenNotPaused {
    uint256 length = escrowIds.length;
    require(
        length == incentiveIds.length && length == discountAmounts.length,
        "Array length mismatch"
    );

    for (uint256 i = 0; i < length;) {
        _applyDiscount(escrowIds[i], incentiveIds[i], discountAmounts[i]);
        unchecked { ++i; }
    }
}
```

Using `unchecked { ++i; }` saves approximately 60 gas per iteration by skipping the overflow check on the loop counter (which cannot realistically overflow).

---

## 6. Upgrade Path

### Transparent Proxy vs. UUPS Proxy

| Aspect | Transparent Proxy | UUPS Proxy |
|--------|------------------|------------|
| Upgrade logic location | In the proxy contract | In the implementation contract |
| Gas cost per call | Slightly higher (admin check) | Slightly lower |
| Deployment cost | Higher (proxy is larger) | Lower |
| Risk of bricking | Lower (proxy always has upgrade fn) | Higher (if upgrade fn is removed) |
| OpenZeppelin support | TransparentUpgradeableProxy | UUPSUpgradeable |

**Recommendation:** Use UUPS proxy for gas efficiency. The implementation contract inherits `UUPSUpgradeable` and implements `_authorizeUpgrade` with an ADMIN_ROLE check. The gas savings per call matter because every `applyDiscount` and `settle` goes through the proxy.

```solidity
function _authorizeUpgrade(
    address newImplementation
) internal override onlyRole(ADMIN_ROLE) {}
```

### When to Use Upgradeable vs. Immutable Contracts

**Use upgradeable contracts when:**
- The protocol is in early stages and design may evolve.
- Bug fixes need to be deployed without migrating funds.
- New features (e.g., new discount types, new settlement logic) are planned.

**Move to immutable contracts when:**
- The protocol is mature and battle-tested.
- Minimizing trust assumptions is prioritized.
- The contract holds significant TVL and any upgrade mechanism is a liability.

**Recommendation for Quest Payments:** Deploy V1 as upgradeable (UUPS proxy). Plan to freeze (renounce upgrade capability) once the contract has been stable for 6+ months and has undergone a comprehensive audit.

### Migration Strategy for Escrowed Funds

If a contract upgrade requires storage layout changes that are incompatible with the proxy pattern:

1. **Pause the old contract** -- prevents new escrow creation.
2. **Settle or expire all active escrows** -- return funds to their rightful owners.
3. **Deploy new implementation** -- with the new storage layout.
4. **Point the proxy to the new implementation** (if compatible) or deploy a new proxy.
5. **Resume operations** on the new contract.

For non-breaking storage changes (adding new fields at the end of the struct, adding new mappings), UUPS proxy upgrades work seamlessly without any fund migration.

Storage layout best practice:
```solidity
// Reserve storage gaps for future fields
uint256[50] private __gap;
```

---

## 7. Integration with x402

### x402 Payment Protocol Overview

x402 is an HTTP-native payment protocol that uses the HTTP 402 (Payment Required) status code. When a client requests a resource that requires payment, the server responds with 402 and payment details. The client constructs a payment (typically an EVM transaction), includes it in a header, and retries the request.

### How x402 Triggers Escrow Creation

In the Quest Payments flow, x402 serves as the entry point for ticket purchases:

```
1. Buyer requests ticket purchase endpoint
        |
        v
2. Server responds with HTTP 402
   Headers include:
     X-Payment-Address: <escrow contract address>
     X-Payment-Amount: <ticket price in USDC>
     X-Payment-Token: <USDC contract address on Base>
     X-Payment-Network: 8453 (Base chain ID)
     X-Quest-Event-Id: <event identifier>
     X-Quest-Max-Discount: <maximum earnable discount>
        |
        v
3. Buyer's client (wallet/app) constructs the escrow creation transaction:
     - Approves USDC spend to escrow contract
     - Calls createEscrow(eventId, organizer, amount, maxDiscount, deadline)
        |
        v
4. Buyer retries the request with payment proof:
   Headers include:
     X-Payment-TxHash: <transaction hash>
     X-Payment-EscrowId: <returned escrow ID>
        |
        v
5. Server verifies the escrow on-chain and issues the ticket
```

### Facilitator as the Bridge

The x402 facilitator acts as the middleware between the HTTP payment flow and the on-chain escrow:

```
+---------+       +-------------+       +----------+       +----------+
|  Buyer  | <---> | Facilitator | <---> |  Escrow  | <---> |  Base    |
|  (App)  |       |  (Server)   |       | Contract |       |  L2      |
+---------+       +-------------+       +----------+       +----------+
                         |
                    +----------+
                    |  Event   |
                    | Organizer|
                    |  Backend |
                    +----------+
```

The facilitator's responsibilities:

- **Escrow parameter negotiation:** Determines the correct `maxDiscount`, `deadline`, and organizer address for the event.
- **Transaction verification:** Confirms that the buyer's transaction was included on Base and the escrow was created with correct parameters.
- **Settlement orchestration:** After the incentive period, the facilitator (or a keeper) calls `settle` or `expire`.

### Settlement Confirmation via x402 Response Headers

After settlement, the facilitator can provide settlement proof back through x402-style headers:

```
HTTP/1.1 200 OK
X-Payment-Status: settled
X-Payment-EscrowId: 12345
X-Payment-OrganizerAmount: 85000000  (85 USDC)
X-Payment-BuyerRefund: 15000000     (15 USDC)
X-Payment-SettleTxHash: 0xabc...
```

This allows the buyer's application to display the final settlement result and the discount they earned.

### Architecture Consideration: Permit-Based Flow

For a smoother UX, the facilitator can use EIP-2612 `permit` to eliminate the separate approval transaction:

```
1. Facilitator returns 402 with payment details
2. Buyer signs an EIP-2612 permit (off-chain signature, no gas)
3. Buyer sends the permit signature to the facilitator
4. Facilitator calls createEscrowWithPermit() which:
   a. Calls USDC.permit(buyer, escrowContract, amount, deadline, v, r, s)
   b. Calls USDC.transferFrom(buyer, escrowContract, amount)
   c. Creates the escrow record
5. Single transaction, paid by the facilitator (or relayer)
```

This approach also enables gasless onboarding -- the buyer does not need ETH for gas on Base.

---

## 8. Testing Strategy

### Unit Tests with Foundry

Foundry is the recommended testing framework for its speed and Solidity-native test writing.

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/QuestEscrow.sol";
import "../src/mocks/MockUSDC.sol";

contract QuestEscrowTest is Test {
    QuestEscrow escrow;
    MockUSDC usdc;

    address buyer     = makeAddr("buyer");
    address organizer = makeAddr("organizer");
    address verifier  = makeAddr("verifier");
    address admin     = makeAddr("admin");

    uint128 constant TICKET_PRICE  = 100_000_000; // 100 USDC
    uint128 constant MAX_DISCOUNT  =  20_000_000; //  20 USDC
    uint48  constant DEADLINE      = uint48(block.timestamp + 7 days);

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new QuestEscrow(address(usdc), admin);

        // Grant roles
        vm.prank(admin);
        escrow.grantRole(escrow.VERIFIER_ROLE(), verifier);

        // Fund buyer
        usdc.mint(buyer, TICKET_PRICE);

        // Buyer approves escrow contract
        vm.prank(buyer);
        usdc.approve(address(escrow), TICKET_PRICE);
    }

    function test_createEscrow_success() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(
            1,           // eventId
            organizer,
            TICKET_PRICE,
            MAX_DISCOUNT,
            DEADLINE
        );

        assertEq(uint8(escrow.getEscrowState(escrowId)), uint8(EscrowState.Active));
        assertEq(usdc.balanceOf(address(escrow)), TICKET_PRICE);
        assertEq(usdc.balanceOf(buyer), 0);
    }

    function test_applyDiscount_success() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(
            1, organizer, TICKET_PRICE, MAX_DISCOUNT, DEADLINE
        );

        vm.prank(verifier);
        escrow.applyDiscount(escrowId, keccak256("quest-1"), 5_000_000); // 5 USDC

        EscrowData memory data = escrow.getEscrow(escrowId);
        assertEq(data.earnedDiscount, 5_000_000);
    }

    function test_settle_withPartialDiscount() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(
            1, organizer, TICKET_PRICE, MAX_DISCOUNT, DEADLINE
        );

        vm.prank(verifier);
        escrow.applyDiscount(escrowId, keccak256("quest-1"), 15_000_000); // 15 USDC

        vm.prank(organizer);
        escrow.settle(escrowId);

        assertEq(usdc.balanceOf(organizer), 85_000_000);  // 100 - 15 = 85 USDC
        assertEq(usdc.balanceOf(buyer), 15_000_000);       // 15 USDC refund
        assertEq(uint8(escrow.getEscrowState(escrowId)), uint8(EscrowState.Released));
    }

    function test_settle_noDiscount() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(
            1, organizer, TICKET_PRICE, MAX_DISCOUNT, DEADLINE
        );

        vm.prank(organizer);
        escrow.settle(escrowId);

        assertEq(usdc.balanceOf(organizer), TICKET_PRICE);
        assertEq(usdc.balanceOf(buyer), 0);
    }

    function test_refund_success() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(
            1, organizer, TICKET_PRICE, MAX_DISCOUNT, DEADLINE
        );

        vm.prank(admin);
        escrow.refund(escrowId);

        assertEq(usdc.balanceOf(buyer), TICKET_PRICE);
        assertEq(uint8(escrow.getEscrowState(escrowId)), uint8(EscrowState.Refunded));
    }

    function test_applyDiscount_clampedToMax() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(
            1, organizer, TICKET_PRICE, MAX_DISCOUNT, DEADLINE
        );

        // Apply more than maxDiscount
        vm.prank(verifier);
        escrow.applyDiscount(escrowId, keccak256("quest-1"), 25_000_000); // 25 > 20 max

        EscrowData memory data = escrow.getEscrow(escrowId);
        assertEq(data.earnedDiscount, MAX_DISCOUNT); // Clamped to 20 USDC
    }

    function test_expire_afterDeadline() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(
            1, organizer, TICKET_PRICE, MAX_DISCOUNT, DEADLINE
        );

        // Warp past deadline
        vm.warp(DEADLINE + 1);

        escrow.expire(escrowId);

        assertEq(uint8(escrow.getEscrowState(escrowId)), uint8(EscrowState.Expired));
    }

    function test_applyDiscount_revert_duplicateIncentive() public {
        vm.prank(buyer);
        uint256 escrowId = escrow.createEscrow(
            1, organizer, TICKET_PRICE, MAX_DISCOUNT, DEADLINE
        );

        bytes32 incentiveId = keccak256("quest-1");

        vm.prank(verifier);
        escrow.applyDiscount(escrowId, incentiveId, 5_000_000);

        vm.prank(verifier);
        vm.expectRevert(
            abi.encodeWithSelector(
                IQuestEscrow.IncentiveAlreadyApplied.selector,
                escrowId,
                incentiveId
            )
        );
        escrow.applyDiscount(escrowId, incentiveId, 5_000_000);
    }
}
```

### Fork Testing Against Base Mainnet

Fork testing verifies the contract works with the real USDC deployment on Base:

```bash
# Run tests forked from Base mainnet
forge test --fork-url https://mainnet.base.org --match-contract QuestEscrowForkTest
```

```solidity
contract QuestEscrowForkTest is Test {
    // Real USDC on Base
    IERC20 constant USDC = IERC20(0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913);

    function setUp() public {
        // Deploy escrow against real USDC
        escrow = new QuestEscrow(address(USDC), admin);

        // Use deal() to give buyer USDC (modifies storage directly)
        deal(address(USDC), buyer, 100_000_000);
    }

    function test_fork_createAndSettle() public {
        // Tests against real USDC contract behavior
        // Validates decimals, transfer, approve all work correctly
    }
}
```

### Invariant Testing

Invariant tests verify properties that must always hold, regardless of the sequence of actions:

```solidity
contract QuestEscrowInvariantTest is Test {
    QuestEscrow escrow;
    MockUSDC usdc;
    EscrowHandler handler;

    function setUp() public {
        usdc = new MockUSDC();
        escrow = new QuestEscrow(address(usdc), address(this));
        handler = new EscrowHandler(escrow, usdc);

        targetContract(address(handler));
    }

    /// @dev Total USDC in contract == sum of all active escrow deposits
    function invariant_balanceMatchesDeposits() public view {
        assertEq(
            usdc.balanceOf(address(escrow)),
            handler.ghost_totalActiveDeposits()
        );
    }

    /// @dev No escrow's earnedDiscount exceeds its maxDiscount
    function invariant_discountNeverExceedsMax() public view {
        uint256[] memory activeIds = handler.getActiveEscrowIds();
        for (uint256 i = 0; i < activeIds.length; i++) {
            EscrowData memory data = escrow.getEscrow(activeIds[i]);
            assertLe(data.earnedDiscount, data.maxDiscount);
        }
    }

    /// @dev Conservation of value: deposits = releases + refunds + current balance
    function invariant_conservationOfValue() public view {
        assertEq(
            handler.ghost_totalDeposited(),
            handler.ghost_totalReleasedToOrganizers()
                + handler.ghost_totalRefundedToBuyers()
                + usdc.balanceOf(address(escrow))
        );
    }
}
```

The `EscrowHandler` contract is a test harness that tracks ghost variables (off-chain counters that mirror on-chain state) and exposes functions that the fuzzer calls in random order.

### Scenario Test Matrix

| Scenario | Steps | Expected Outcome |
|----------|-------|-----------------|
| **Happy path, full discount** | Create -> Apply 4 quests totaling maxDiscount -> Settle | Buyer gets maxDiscount back, organizer gets deposit - maxDiscount |
| **Happy path, partial discount** | Create -> Apply 2 quests -> Settle | Buyer gets partial refund, organizer gets rest |
| **No discount** | Create -> Settle immediately | Organizer gets full deposit |
| **Timeout, default policy** | Create -> Deadline passes -> Expire | Organizer gets full deposit |
| **Timeout, earned policy** | Create -> Apply some quests -> Deadline -> Expire | Organizer gets net, buyer gets earned |
| **Event cancellation** | Create -> Admin calls refund | Buyer gets full deposit back |
| **Duplicate incentive** | Create -> Apply quest-1 -> Apply quest-1 again | Second call reverts |
| **Discount exceeds max** | Create -> Apply discount > maxDiscount | Clamped to maxDiscount |
| **Unauthorized verifier** | Non-verifier calls applyDiscount | Reverts with AccessControl error |
| **Paused contract** | Admin pauses -> Any state-changing call | Reverts with Pausable error |
| **Batch operations** | Create 10 escrows -> Batch apply discounts -> Batch settle | All 10 settled correctly |

### Test Commands

```bash
# Run all unit tests
forge test -vvv

# Run fork tests against Base
forge test --fork-url https://mainnet.base.org -vvv --match-contract Fork

# Run invariant tests (longer, more iterations)
forge test --match-contract Invariant -vvv --fuzz-runs 10000

# Generate gas report
forge test --gas-report

# Generate coverage report
forge coverage --report lcov
```

---

## Appendix A: USDC Contract Addresses

| Chain | USDC Address | Type |
|-------|-------------|------|
| Base | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Native USDC |
| Ethereum | `0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48` | Native USDC |
| Base Sepolia (testnet) | Check Circle docs for latest | Test USDC |

## Appendix B: Storage Layout Reference

For proxy upgrades, the storage layout must be carefully managed. Use `forge inspect QuestEscrow storage-layout` to generate the current layout and diff it before any upgrade.

```
| Name              | Type                                      | Slot | Offset | Bytes |
|-------------------|-------------------------------------------|------|--------|-------|
| _escrows          | mapping(uint256 => EscrowData)            | 0    | 0      | 32    |
| _incentiveApplied | mapping(uint256 => mapping(bytes32=>bool))| 1    | 0      | 32    |
| _escrowCounter    | uint256                                   | 2    | 0      | 32    |
| _timeoutPolicy    | TimeoutPolicy                             | 3    | 0      | 1     |
| __gap             | uint256[50]                               | 4    | 0      | 1600  |
```

## Appendix C: Deployment Checklist

- [ ] Deploy implementation contract to Base
- [ ] Deploy UUPS proxy pointing to implementation
- [ ] Grant ADMIN_ROLE to multisig
- [ ] Grant VERIFIER_ROLE to oracle/verifier contract
- [ ] Set default TimeoutPolicy
- [ ] Verify contracts on BaseScan
- [ ] Run fork tests against deployed contracts
- [ ] Set up monitoring (escrow creation rate, settlement rate, total TVL)
- [ ] Configure keeper for automated expiry of timed-out escrows
