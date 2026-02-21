import { describe, it, expect, vi } from 'vitest';
import {
  BASE_MAINNET,
  BASE_SEPOLIA,
  ARBITRUM_ONE,
  NETWORKS,
  buildPaywallResponse,
  toUsdcBaseUnits,
  QuestSettlement,
} from './index.js';

// ─── networks ─────────────────────────────────────────────────────────────────

describe('networks', () => {
  it('BASE_MAINNET has correct chainId and USDC address', () => {
    expect(BASE_MAINNET.chainId).toBe(8453);
    expect(BASE_MAINNET.usdcAddress).toBe('0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913');
    expect(BASE_MAINNET.facilitatorUrl).toBe('https://x402.org/facilitator');
  });

  it('BASE_SEPOLIA has correct chainId and USDC address', () => {
    expect(BASE_SEPOLIA.chainId).toBe(84532);
    expect(BASE_SEPOLIA.usdcAddress).toBe('0x036CbD53842c5426634e7929541eC2318f3dCF7e');
    expect(BASE_SEPOLIA.facilitatorUrl).toBe('https://x402.org/facilitator/testnet');
  });

  it('ARBITRUM_ONE has correct chainId and USDC address', () => {
    expect(ARBITRUM_ONE.chainId).toBe(42161);
    expect(ARBITRUM_ONE.usdcAddress).toBe('0xaf88d065e77c8cC2239327C5EDb3A432268e5831');
    expect(ARBITRUM_ONE.facilitatorUrl).toBe('https://x402.org/facilitator');
  });

  it('NETWORKS map contains all three networks', () => {
    expect(NETWORKS['base']).toBe(BASE_MAINNET);
    expect(NETWORKS['base-sepolia']).toBe(BASE_SEPOLIA);
    expect(NETWORKS['arbitrum']).toBe(ARBITRUM_ONE);
  });
});

// ─── paywall ──────────────────────────────────────────────────────────────────

describe('toUsdcBaseUnits', () => {
  it('converts whole USDC amounts', () => {
    expect(toUsdcBaseUnits(1)).toBe('1000000');
    expect(toUsdcBaseUnits(99)).toBe('99000000');
  });

  it('converts fractional amounts', () => {
    expect(toUsdcBaseUnits(0.5)).toBe('500000');
    expect(toUsdcBaseUnits(1.23)).toBe('1230000');
  });

  it('rounds to nearest base unit', () => {
    // 0.000001 USDC = 1 base unit
    expect(toUsdcBaseUnits(0.000001)).toBe('1');
  });
});

describe('buildPaywallResponse', () => {
  const opts = {
    network: BASE_MAINNET,
    amount: 10,
    payTo: '0xRecipient',
    resource: 'purchase-abc',
  };

  it('returns status 402', () => {
    const res = buildPaywallResponse(opts);
    expect(res.status).toBe(402);
  });

  it('includes one acceptance entry with correct fields', () => {
    const res = buildPaywallResponse(opts);
    expect(res.accepts).toHaveLength(1);
    const acceptance = res.accepts[0]!;
    expect(acceptance.scheme).toBe('exact');
    expect(acceptance.chainId).toBe(BASE_MAINNET.chainId);
    expect(acceptance.asset).toBe(BASE_MAINNET.usdcAddress);
    expect(acceptance.payTo).toBe('0xRecipient');
    expect(acceptance.maxAmountRequired).toBe('10000000');
    expect(acceptance.resource).toBe('purchase-abc');
    expect(acceptance.mimeType).toBe('application/json');
    expect(acceptance.outputSchema).toBeNull();
  });

  it('uses memo as description when provided', () => {
    const res = buildPaywallResponse({ ...opts, memo: 'VIP Ticket' });
    expect(res.accepts[0]!.description).toBe('VIP Ticket');
  });

  it('generates default description when memo is omitted', () => {
    const res = buildPaywallResponse(opts);
    expect(res.accepts[0]!.description).toBe('Payment for purchase-abc');
  });

  it('normalises network name to lowercase-hyphenated', () => {
    const res = buildPaywallResponse({ ...opts, network: BASE_SEPOLIA });
    expect(res.accepts[0]!.network).toBe('base-sepolia');
  });
});

// ─── settlement ───────────────────────────────────────────────────────────────

describe('QuestSettlement.toBaseUnits', () => {
  it('passes USDC base units through unchanged', () => {
    expect(QuestSettlement.toBaseUnits({ amount: 5_000_000, currency: 'USDC' })).toBe('5000000');
  });

  it('converts USD cents to USDC base units', () => {
    // $1.00 = 100 cents → 1_000_000 base units
    expect(QuestSettlement.toBaseUnits({ amount: 100, currency: 'USD' })).toBe('1000000');
    // $0.50 = 50 cents → 500_000 base units
    expect(QuestSettlement.toBaseUnits({ amount: 50, currency: 'USD' })).toBe('500000');
  });
});

describe('QuestSettlement.settle', () => {
  const request = {
    payload: 'signed-payload',
    expectedAmount: '10000000',
    expectedPayTo: '0xOrganizer',
    reference: 'purchase-xyz',
  };

  it('returns success result when facilitator responds ok', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true, txHash: '0xabc' }),
    });

    const settlement = new QuestSettlement({ network: BASE_MAINNET, fetch: mockFetch as typeof fetch });
    const result = await settlement.settle(request);

    expect(result.success).toBe(true);
    expect(result.txHash).toBe('0xabc');
    expect(result.error).toBeUndefined();
  });

  it('posts to the correct facilitator endpoint', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const settlement = new QuestSettlement({ network: BASE_MAINNET, fetch: mockFetch as typeof fetch });
    await settlement.settle(request);

    expect(mockFetch).toHaveBeenCalledWith(
      `${BASE_MAINNET.facilitatorUrl}/settle`,
      expect.objectContaining({ method: 'POST' }),
    );
  });

  it('returns failure when facilitator returns success:false', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      json: async () => ({ success: false, error: 'insufficient funds' }),
    });

    const settlement = new QuestSettlement({ network: BASE_MAINNET, fetch: mockFetch as typeof fetch });
    const result = await settlement.settle(request);

    expect(result.success).toBe(false);
    expect(result.error).toBe('insufficient funds');
  });

  it('returns failure when fetch throws a network error', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const settlement = new QuestSettlement({ network: BASE_MAINNET, fetch: mockFetch as typeof fetch });
    const result = await settlement.settle(request);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Network error/);
  });

  it('returns failure when facilitator responds with non-JSON', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => { throw new SyntaxError('Unexpected token'); },
    });

    const settlement = new QuestSettlement({ network: BASE_MAINNET, fetch: mockFetch as typeof fetch });
    const result = await settlement.settle(request);

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/non-JSON/);
  });
});
