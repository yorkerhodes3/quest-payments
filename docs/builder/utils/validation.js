/**
 * Validation utilities for quest configuration.
 * Validates form inputs and complete quest configs.
 */

export const VALID_INCENTIVE_TYPES = [
  'social_share',
  'referral',
  'check_in',
  'sponsor_session',
  'feedback',
  'manual',
];

/**
 * Validate a quest name.
 * @param {string} name
 * @returns {{ valid: boolean; error?: string }}
 */
export function validateQuestName(name) {
  if (typeof name !== 'string') {
    return { valid: false, error: 'Quest name must be a string' };
  }
  const trimmed = name.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: 'Quest name cannot be empty' };
  }
  if (trimmed.length > 100) {
    return { valid: false, error: 'Quest name must be 100 characters or less' };
  }
  return { valid: true };
}

/**
 * Validate a quest description.
 * @param {string} description
 * @returns {{ valid: boolean; error?: string }}
 */
export function validateQuestDescription(description) {
  if (typeof description !== 'string') {
    return { valid: false, error: 'Description must be a string' };
  }
  if (description.length > 500) {
    return { valid: false, error: 'Description must be 500 characters or less' };
  }
  return { valid: true };
}

/**
 * Validate an expiration date.
 * @param {string} expiresAt ISO 8601 date string
 * @returns {{ valid: boolean; error?: string }}
 */
export function validateExpiresAt(expiresAt) {
  if (typeof expiresAt !== 'string') {
    return { valid: false, error: 'Expiration date must be a string' };
  }
  const date = new Date(expiresAt);
  if (isNaN(date.getTime())) {
    return { valid: false, error: 'Invalid date format' };
  }
  if (date < new Date()) {
    return { valid: false, error: 'Expiration date must be in the future' };
  }
  return { valid: true };
}

/**
 * Validate discount basis points.
 * @param {number} discountBps Basis points (1-10000)
 * @returns {{ valid: boolean; error?: string }}
 */
export function validateDiscountBps(discountBps) {
  if (typeof discountBps !== 'number') {
    return { valid: false, error: 'Discount must be a number' };
  }
  if (discountBps < 1 || discountBps > 10000) {
    return { valid: false, error: 'Discount must be between 1 and 10000 basis points' };
  }
  return { valid: true };
}

/**
 * Validate an incentive type.
 * @param {string} type
 * @returns {{ valid: boolean; error?: string }}
 */
export function validateIncentiveType(type) {
  if (!VALID_INCENTIVE_TYPES.includes(type)) {
    return { valid: false, error: `Invalid incentive type: ${type}` };
  }
  return { valid: true };
}

/**
 * Validate a complete incentive object.
 * @param {Record<string, any>} incentive
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateIncentive(incentive) {
  const errors = [];

  const typeValidation = validateIncentiveType(incentive.type);
  if (!typeValidation.valid) errors.push(typeValidation.error);

  const discountValidation = validateDiscountBps(incentive.discountBps);
  if (!discountValidation.valid) errors.push(discountValidation.error);

  if (typeof incentive.description !== 'string' || incentive.description.trim().length === 0) {
    errors.push('Incentive description is required');
  }

  if (incentive.expiresAt) {
    const expiresValidation = validateExpiresAt(incentive.expiresAt);
    if (!expiresValidation.valid) errors.push(expiresValidation.error);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * Validate a complete quest configuration.
 * @param {Record<string, any>} quest
 * @returns {{ valid: boolean; errors: string[] }}
 */
export function validateQuestConfig(quest) {
  const errors = [];

  // Validate quest name
  const nameValidation = validateQuestName(quest.name);
  if (!nameValidation.valid) errors.push(`Name: ${nameValidation.error}`);

  // Validate description
  const descValidation = validateQuestDescription(quest.description);
  if (!descValidation.valid) errors.push(`Description: ${descValidation.error}`);

  // Validate expiration
  const expiresValidation = validateExpiresAt(quest.expiresAt);
  if (!expiresValidation.valid) errors.push(`Expiration: ${expiresValidation.error}`);

  // Validate incentives array
  if (!Array.isArray(quest.incentives) || quest.incentives.length === 0) {
    errors.push('Quest must have at least one incentive');
  } else {
    quest.incentives.forEach((inc, idx) => {
      const incValidation = validateIncentive(inc);
      if (!incValidation.valid) {
        errors.push(`Incentive ${idx + 1}: ${incValidation.errors.join(', ')}`);
      }
    });
  }

  return { valid: errors.length === 0, errors };
}
