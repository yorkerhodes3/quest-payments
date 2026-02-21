# Quest Payments

An incentive-based payment mechanism that drives event attendance through action-rewarded discounts, settled on stablecoins via the x402 protocol.

## Concept

Quest Payments reimagines event ticketing by turning ticket purchases into interactive quests. Rather than a flat ticket price, attendees receive a list of **provable incentive actions** that reduce their final cost. The more you engage, the less you pay.

### How It Works

1. **Purchase** -- A buyer selects an event ticket. A credit card authorization (or direct stablecoin payment) is initiated for the full ticket price.
2. **Quest** -- The buyer is presented with a set of defined incentives, each tied to a specific discount. Examples:
   - Share the event on social media (-5%)
   - Refer a friend who also purchases (-10%)
   - Complete event check-in on time (-5%)
   - Attend a sponsor session (-3%)
   - Submit post-event feedback (-2%)
3. **Verify** -- Each incentive action is provable and verifiable. When a buyer completes an action, the system validates it and applies the corresponding discount.
4. **Settle** -- The final charge is calculated after all eligible incentive actions are resolved. Only the net amount is captured.

### Payment Architecture

Quest Payments uses a two-layer payment stack:

- **Frontend**: Standard credit card payments (Stripe, etc.) for familiar user experience
- **Backend**: Settlement in **USDC stablecoins** via the **x402 protocol** on low-cost L2 networks (Base, Arbitrum) for cost-efficient processing

This design means the merchant benefits from near-zero blockchain settlement costs regardless of how the end user pays.

#### x402 Protocol

The [x402 protocol](https://github.com/coinbase/x402) is an open standard by Coinbase that enables HTTP-native payments using the `402 Payment Required` status code. Key properties:

- Zero protocol-level fees
- Sub-cent transaction costs on L2 networks like Base
- Native USDC support
- TypeScript, Python, and Go SDKs

#### Payment Flow Options

| Strategy | Description | Tradeoffs |
|---|---|---|
| **Auth-then-capture** | Hold full amount, capture net after incentives complete | Clean flow, but auth expires in 2-7 days depending on card network |
| **Charge-then-refund** | Charge full price immediately, issue partial refunds for completed incentives | No expiration risk, but refund processing fees are non-recoverable |
| **Stablecoin escrow** | Full amount held in USDC smart contract, released net of discounts | Most cost-efficient, requires crypto-native users or on-ramp |

## Project Status

Early design and research phase.

## License

TBD
