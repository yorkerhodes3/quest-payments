# Smart Contract Escrow Design

> Research for Quest Payments — Issue #3

## Overview

The stablecoin escrow strategy requires a smart contract that holds USDC on behalf of the buyer until incentive actions are resolved, then releases the net amount to the organizer and returns earned discounts to the buyer. This document designs that contract for deployment on Base L2.

---

## Requirements

1. Accept USDC deposits tied to a specific purchase
2. Allow an authorized verifier to accumulate discount basis points
3. Settle by releasing net amount to organizer + refunding earned discounts to buyer
4. Handle timeout/event cancellation with full refund path
5. Minimal trust: organizer cannot arbitrarily withdraw; buyer cannot arbitrarily reclaim before window ends
6. Gas-efficient on Base L2

---

## Interface Design

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IQuestEscrow {
    // ── Events ───────────────────────────────────────────────────────────────
    event Deposited(bytes32 indexed purchaseId, address indexed buyer, uint256 amount);
    event DiscountApplied(bytes32 indexed purchaseId, uint16 additionalBps, uint16 totalBps);
    event Settled(bytes32 indexed purchaseId, uint256 organiserAmount, uint256 buyerRefund);
    event Refunded(bytes32 indexed purchaseId, uint256 amount);

    // ── State queries ─────────────────────────────────────────────────────────
    function getEscrow(bytes32 purchaseId) external view returns (
        address buyer,
        address organiser,
        uint256 amount,
        uint16  discountBps,
        uint64  expiresAt,
        bool    settled
    );

    // ── Lifecycle ─────────────────────────────────────────────────────────────
    /// @notice Buyer deposits USDC. Must have ERC-20 approval for `amount` first.
    function deposit(
        bytes32 purchaseId,
        address organiser,
        uint256 amount,
        uint64  expiresAt   // unix timestamp after which settlement is allowed
    ) external;

    /// @notice Authorized verifier applies a discount increment (in basis points).
    /// @dev    Total discountBps is capped at 10_000 (100%).
    function applyDiscount(bytes32 purchaseId, uint16 discountBps) external;

    /// @notice Settle after expiresAt: sends net to organiser, remainder to buyer.
    function settle(bytes32 purchaseId) external;

    /// @notice Full refund to buyer (event cancellation or timeout > REFUND_WINDOW).
    function refundAll(bytes32 purchaseId) external;
}
```

---

## Storage Layout

```solidity
struct Escrow {
    address buyer;        // 20 bytes
    address organiser;    // 20 bytes
    uint128 amount;       // USDC (6 decimals), max ~$340T — sufficient
    uint16  discountBps;  // accumulated discount, 0–10000
    uint64  expiresAt;    // incentive window close
    bool    settled;      // prevent double-settle
}

mapping(bytes32 => Escrow) private escrows;
```

Packing `buyer` and `organiser` into separate slots is unavoidable (addresses are 20 bytes), but `amount + discountBps + expiresAt + settled` can be tightly packed into a single 32-byte slot:
- `uint128 amount` = 16 bytes
- `uint16 discountBps` = 2 bytes
- `uint64 expiresAt` = 8 bytes
- `bool settled` = 1 byte
- 5 bytes padding

Total: 3 storage slots per escrow (96 bytes).

---

## Access Control

| Role | Held by | Capabilities |
|---|---|---|
| `VERIFIER_ROLE` | Quest Payments backend EOA/multisig | `applyDiscount` |
| `ORGANISER` | Per-escrow address | `settle` (after expiry) |
| `BUYER` | Per-escrow address | `refundAll` (after REFUND_WINDOW) |
| `ADMIN` | Multisig (2-of-3) | Upgrade, pause, update verifier |

`applyDiscount` is restricted to `VERIFIER_ROLE` using OpenZeppelin `AccessControl`. The verifier address is set at deploy time and can be rotated by `ADMIN`.

---

## Discount Application Mechanics

```solidity
function applyDiscount(bytes32 purchaseId, uint16 additionalBps) external onlyRole(VERIFIER_ROLE) {
    Escrow storage e = escrows[purchaseId];
    require(!e.settled, "already settled");
    require(block.timestamp < e.expiresAt, "window closed");

    uint16 newTotal = e.discountBps + additionalBps;
    if (newTotal > 10_000) newTotal = 10_000;  // cap at 100%
    e.discountBps = newTotal;

    emit DiscountApplied(purchaseId, additionalBps, newTotal);
}
```

Discounts are capped at 10,000 bps (100%) to prevent underflow on settlement calculation.

---

## Settlement Calculation

```solidity
function settle(bytes32 purchaseId) external {
    Escrow storage e = escrows[purchaseId];
    require(!e.settled, "already settled");
    require(
        block.timestamp >= e.expiresAt || msg.sender == e.organiser,
        "window not closed"
    );

    e.settled = true;

    uint256 discount  = (uint256(e.amount) * e.discountBps) / 10_000;
    uint256 organiserAmt = e.amount - discount;

    IERC20(USDC).safeTransfer(e.organiser, organiserAmt);
    if (discount > 0) IERC20(USDC).safeTransfer(e.buyer, discount);

    emit Settled(purchaseId, organiserAmt, discount);
}
```

---

## Timeout and Expiration Handling

Two timeout scenarios:

1. **Incentive window closed, organizer delays settlement** — `settle` becomes callable by anyone after `expiresAt`. This prevents organizer from blocking funds indefinitely.

2. **Event cancellation / long abandonment** — after `expiresAt + REFUND_WINDOW` (e.g., 90 days), the buyer can call `refundAll` to recover the full amount regardless of organizer action.

```solidity
uint64 public constant REFUND_WINDOW = 90 days;

function refundAll(bytes32 purchaseId) external {
    Escrow storage e = escrows[purchaseId];
    require(!e.settled, "already settled");
    require(
        msg.sender == e.buyer &&
        block.timestamp >= e.expiresAt + REFUND_WINDOW,
        "refund not available"
    );
    e.settled = true;
    IERC20(USDC).safeTransfer(e.buyer, e.amount);
    emit Refunded(purchaseId, e.amount);
}
```

---

## Security Considerations

### Reentrancy
All state changes (`e.settled = true`) occur **before** token transfers. This follows the checks-effects-interactions pattern and eliminates reentrancy risk.

### Integer Overflow
Using Solidity 0.8.x with built-in overflow checking. USDC uses 6 decimals; `uint128` can hold up to ~3.4 × 10²³ USDC — no practical overflow risk.

### Front-running
`settle` can be called by anyone after `expiresAt`, but it always transfers to the fixed `organiser` address stored at deposit time. Front-running `settle` only helps the organiser get paid sooner, which is acceptable.

### Oracle-free Design
The contract does not rely on any external price oracle or off-chain data. All discount logic is pushed on-chain by the trusted `VERIFIER_ROLE`. This removes oracle manipulation risk entirely.

### Token Allowlist
The `USDC` address is set at deploy time (immutable). The contract does not accept arbitrary ERC-20 tokens, preventing fee-on-transfer or rebasing token attacks.

---

## Gas Optimization on Base L2

Base L2 uses EIP-1559 with very low base fees (~0.001–0.01 gwei). Key optimizations:

| Technique | Savings |
|---|---|
| Tight struct packing (3 slots vs 5) | ~40,000 gas on deploy |
| `uint128` amount (vs `uint256`) | ~5,000 gas per read/write |
| `bytes32` purchaseId (vs string) | ~3,000 gas per call |
| `safeTransfer` vs manual checks | Minor overhead but required for safety |

Estimated gas per operation at 0.001 gwei base fee on Base:

| Operation | Gas | Cost (USD) |
|---|---|---|
| `deposit` | ~70,000 | ~$0.001 |
| `applyDiscount` | ~28,000 | <$0.001 |
| `settle` | ~60,000 | ~$0.001 |
| Total per purchase (5 incentives) | ~270,000 | ~$0.003 |

---

## Upgrade Path

The contract is deployed behind an OpenZeppelin `TransparentUpgradeableProxy`. The proxy admin is a Gnosis Safe (2-of-3 multisig) controlled by the Quest Payments team.

Upgrade policy:
- Storage layout is append-only (no slot reordering)
- Events are additive (old indexers continue to work)
- A 48-hour timelock is enforced on the proxy admin before any upgrade executes

---

## Integration with x402

For the hybrid settlement strategy, the contract does not need to be used for every payment. x402 is used for USDC cashback delivery (direct transfer from organizer's wallet to buyer), not for escrow. The escrow contract is only relevant for the pure stablecoin escrow strategy.

```
Hybrid flow:
  Buyer → Stripe → Organizer (card, full amount)
  Organizer → x402 USDC transfer → Buyer (earned discount)

Escrow flow:
  Buyer → USDC deposit → QuestEscrow contract
  Verifier → applyDiscount (per incentive)
  Organizer → settle (after window)
  Contract → Organizer (net) + Buyer (discount)
```
