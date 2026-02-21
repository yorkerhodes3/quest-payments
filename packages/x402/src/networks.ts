/** Network configurations for x402 USDC settlement. */

export interface NetworkConfig {
  readonly chainId: number;
  readonly name: string;
  readonly usdcAddress: string;
  readonly facilitatorUrl: string;
  readonly blockExplorer: string;
}

export const BASE_MAINNET: NetworkConfig = {
  chainId: 8453,
  name: 'Base',
  usdcAddress: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
  facilitatorUrl: 'https://x402.org/facilitator',
  blockExplorer: 'https://basescan.org',
};

export const BASE_SEPOLIA: NetworkConfig = {
  chainId: 84532,
  name: 'Base Sepolia',
  usdcAddress: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  facilitatorUrl: 'https://x402.org/facilitator/testnet',
  blockExplorer: 'https://sepolia.basescan.org',
};

export const ARBITRUM_ONE: NetworkConfig = {
  chainId: 42161,
  name: 'Arbitrum One',
  usdcAddress: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
  facilitatorUrl: 'https://x402.org/facilitator',
  blockExplorer: 'https://arbiscan.io',
};

export const NETWORKS: Record<string, NetworkConfig> = {
  'base': BASE_MAINNET,
  'base-sepolia': BASE_SEPOLIA,
  'arbitrum': ARBITRUM_ONE,
};
