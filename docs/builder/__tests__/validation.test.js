/**
 * Unit tests for validation utilities
 * Tests form field and quest config validation
 */

import { describe, it, expect } from 'vitest';
import {
  validateQuestName,
  validateDescription,
  validateExpiration,
  validateDiscountBps,
  validateIncentiveType,
  validateQuestConfig,
  VALID_INCENTIVE_TYPES,
} from '../utils/validation.js';

describe('Validation Utilities', () => {
  describe('VALID_INCENTIVE_TYPES', () => {
    it('includes all 6 incentive types', () => {
      expect(VALID_INCENTIVE_TYPES).toContain('social_share');
      expect(VALID_INCENTIVE_TYPES).toContain('referral');
      expect(VALID_INCENTIVE_TYPES).toContain('check_in');
      expect(VALID_INCENTIVE_TYPES).toContain('sponsor_session');
      expect(VALID_INCENTIVE_TYPES).toContain('feedback');
      expect(VALID_INCENTIVE_TYPES).toContain('manual');
      expect(VALID_INCENTIVE_TYPES.length).toBe(6);
    });
  });

  describe('validateQuestName', () => {
    it('accepts valid quest names', () => {
      expect(validateQuestName('TechConf 2025').valid).toBe(true);
      expect(validateQuestName('A')).valid).toBe(true);
      expect(validateQuestName('My Awesome Event')).valid).toBe(true);
    });

    it('rejects empty names', () => {
      const result = validateQuestName('');
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Quest name is required');
    });

    it('rejects names longer than 100 characters', () => {
      const longName = 'a'.repeat(101);
      const result = validateQuestName(longName);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('100 characters');
    });

    it('rejects null or undefined', () => {
      expect(validateQuestName(null).valid).toBe(false);
      expect(validateQuestName(undefined).valid).toBe(false);
    });
  });

  describe('validateDescription', () => {
    it('accepts valid descriptions', () => {
      expect(validateDescription('A simple description').valid).toBe(true);
      expect(validateDescription('').valid).toBe(true); // Optional
      expect(validateDescription('Multi\nline\ndescription').valid).toBe(true);
    });

    it('rejects descriptions longer than 500 characters', () => {
      const longDesc = 'a'.repeat(501);
      const result = validateDescription(longDesc);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('500 characters');
    });

    it('rejects null or undefined', () => {
      const result = validateDescription(null);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateExpiration', () => {
    it('accepts valid ISO 8601 dates', () => {
      expect(validateExpiration('2025-12-31T23:59:59Z').valid).toBe(true);
      expect(validateExpiration('2025-01-01T00:00:00Z').valid).toBe(true);
      expect(validateExpiration(new Date().toISOString()).valid).toBe(true);
    });

    it('rejects invalid date formats', () => {
      const result = validateExpiration('2025-12-31');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('valid ISO 8601 date');
    });

    it('rejects dates in the past', () => {
      const lastYear = new Date('2020-01-01').toISOString();
      const result = validateExpiration(lastYear);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('future');
    });

    it('rejects null or undefined', () => {
      expect(validateExpiration(null).valid).toBe(false);
      expect(validateExpiration(undefined).valid).toBe(false);
    });
  });

  describe('validateDiscountBps', () => {
    it('accepts valid basis point values', () => {
      expect(validateDiscountBps(1).valid).toBe(true);
      expect(validateDiscountBps(500).valid).toBe(true);
      expect(validateDiscountBps(10000).valid).toBe(true);
    });

    it('rejects values less than 1', () => {
      expect(validateDiscountBps(0).valid).toBe(false);
      expect(validateDiscountBps(-100).valid).toBe(false);
    });

    it('rejects values greater than 10000', () => {
      expect(validateDiscountBps(10001).valid).toBe(false);
      expect(validateDiscountBps(50000).valid).toBe(false);
    });

    it('rejects non-numeric values', () => {
      expect(validateDiscountBps('500').valid).toBe(false);
      expect(validateDiscountBps(null).valid).toBe(false);
      expect(validateDiscountBps(undefined).valid).toBe(false);
    });

    it('rejects float values', () => {
      const result = validateDiscountBps(500.5);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('integer');
    });
  });

  describe('validateIncentiveType', () => {
    it('accepts valid incentive types', () => {
      expect(validateIncentiveType('social_share').valid).toBe(true);
      expect(validateIncentiveType('referral').valid).toBe(true);
      expect(validateIncentiveType('check_in').valid).toBe(true);
      expect(validateIncentiveType('sponsor_session').valid).toBe(true);
      expect(validateIncentiveType('feedback').valid).toBe(true);
      expect(validateIncentiveType('manual').valid).toBe(true);
    });

    it('rejects invalid types', () => {
      const result = validateIncentiveType('invalid_type');
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('valid incentive type');
    });

    it('rejects empty string', () => {
      expect(validateIncentiveType('').valid).toBe(false);
    });

    it('rejects null or undefined', () => {
      expect(validateIncentiveType(null).valid).toBe(false);
      expect(validateIncentiveType(undefined).valid).toBe(false);
    });

    it('is case-sensitive', () => {
      expect(validateIncentiveType('Social_Share').valid).toBe(false);
      expect(validateIncentiveType('REFERRAL').valid).toBe(false);
    });
  });

  describe('validateQuestConfig', () => {
    const validConfig = {
      questId: 'quest-1',
      questName: 'Test Quest',
      description: 'A test quest',
      expiresAt: new Date(Date.now() + 86400000).toISOString(),
      metadata: {
        organizerName: 'Test Org',
        eventUrl: 'https://example.com',
      },
      incentives: [
        {
          id: 'inc-1',
          type: 'social_share',
          discountBps: 500,
          description: 'Share on social',
          expiresAt: new Date(Date.now() + 86400000).toISOString(),
        },
      ],
    };

    it('accepts valid config', () => {
      const result = validateQuestConfig(validConfig);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('rejects missing quest name', () => {
      const config = { ...validConfig, questName: '' };
      const result = validateQuestConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('name'))).toBe(true);
    });

    it('rejects invalid expiration date', () => {
      const config = { ...validConfig, expiresAt: '2020-01-01T00:00:00Z' };
      const result = validateQuestConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.some(e => e.includes('future'))).toBe(true);
    });

    it('rejects config with invalid incentives', () => {
      const config = {
        ...validConfig,
        incentives: [
          {
            ...validConfig.incentives[0],
            discountBps: 10001,
          },
        ],
      };
      const result = validateQuestConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length > 0).toBe(true);
    });

    it('validates multiple incentives', () => {
      const config = {
        ...validConfig,
        incentives: [
          {
            id: 'inc-1',
            type: 'social_share',
            discountBps: 500,
            description: 'Share',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
          {
            id: 'inc-2',
            type: 'referral',
            discountBps: 1000,
            description: 'Refer',
            expiresAt: new Date(Date.now() + 86400000).toISOString(),
          },
        ],
      };
      const result = validateQuestConfig(config);
      expect(result.valid).toBe(true);
    });

    it('allows empty incentives array', () => {
      const config = { ...validConfig, incentives: [] };
      const result = validateQuestConfig(config);
      expect(result.valid).toBe(true);
    });

    it('accumulates all validation errors', () => {
      const config = {
        questId: '',
        questName: '',
        description: 'a'.repeat(501),
        expiresAt: '2020-01-01T00:00:00Z',
        metadata: {},
        incentives: [
          {
            id: 'inc-1',
            type: 'invalid',
            discountBps: 0,
            description: '',
            expiresAt: '2020-01-01T00:00:00Z',
          },
        ],
      };
      const result = validateQuestConfig(config);
      expect(result.valid).toBe(false);
      expect(result.errors.length > 1).toBe(true);
    });
  });

  describe('Error return format', () => {
    it('returns object with valid and errors properties', () => {
      const result = validateQuestName('');
      expect(result).toHaveProperty('valid');
      expect(result).toHaveProperty('errors');
      expect(Array.isArray(result.errors)).toBe(true);
    });

    it('valid config returns empty errors array', () => {
      const result = validateQuestName('Valid Name');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('invalid config returns array with at least one error', () => {
      const result = validateQuestName('');
      expect(Array.isArray(result.errors)).toBe(true);
      expect(result.errors.length > 0).toBe(true);
      expect(typeof result.errors[0]).toBe('string');
    });
  });
});
