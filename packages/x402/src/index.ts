/**
 * x402 integration module for Quest Payments.
 *
 * Provides a framework-agnostic core for settling event ticket
 * payments in USDC via the x402 protocol on EVM L2 networks.
 */

export { QuestSettlement, SettlementRequest, SettlementResult } from "./settlement.js";
export { X402PaywallConfig, createPaywallResponse } from "./paywall.js";
export { SUPPORTED_NETWORKS, NetworkConfig } from "./networks.js";
