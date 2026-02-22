/**
 * Incentive type catalog with metadata for UI rendering.
 * Used to populate dropdowns and show descriptions.
 */

export const INCENTIVE_TYPES = {
  social_share: {
    id: 'social_share',
    label: 'Social Share',
    description: 'Share event link on social media',
    icon: 'share',
    defaultDiscount: 500, // 5%
    platforms: ['Twitter', 'LinkedIn', 'Facebook', 'Instagram'],
    help: 'Encourage attendees to spread the word on their social networks.',
  },
  referral: {
    id: 'referral',
    label: 'Referral',
    description: 'Refer a friend who also purchases',
    icon: 'people',
    defaultDiscount: 1000, // 10%
    help: 'Reward attendees who bring new customers.',
  },
  check_in: {
    id: 'check_in',
    label: 'Check-In',
    description: 'Attend event and check in on time',
    icon: 'location',
    defaultDiscount: 500, // 5%
    help: 'Incentivize attendance and on-time arrival.',
  },
  sponsor_session: {
    id: 'sponsor_session',
    label: 'Sponsor Session',
    description: 'Attend a sponsor/partner session',
    icon: 'briefcase',
    defaultDiscount: 300, // 3%
    help: 'Drive attendance to sponsored content.',
  },
  feedback: {
    id: 'feedback',
    label: 'Post-Event Feedback',
    description: 'Complete post-event survey',
    icon: 'comment',
    defaultDiscount: 200, // 2%
    help: 'Gather valuable feedback after the event.',
  },
  manual: {
    id: 'manual',
    label: 'Manual Review',
    description: 'Custom action requiring manual verification',
    icon: 'check-circle',
    defaultDiscount: 500, // 5%
    help: 'Create custom incentives verified by your team.',
  },
};

/**
 * Get the label for an incentive type.
 * @param {string} typeId
 * @returns {string}
 */
export function getIncentiveLabel(typeId) {
  return INCENTIVE_TYPES[typeId]?.label || typeId;
}

/**
 * Get the default discount for an incentive type.
 * @param {string} typeId
 * @returns {number} Basis points
 */
export function getDefaultDiscount(typeId) {
  return INCENTIVE_TYPES[typeId]?.defaultDiscount || 500;
}

/**
 * Convert basis points to percentage string.
 * @param {number} bps Basis points
 * @returns {string} e.g. "5.00%"
 */
export function bpsToPercent(bps) {
  return (bps / 100).toFixed(2) + '%';
}

/**
 * Convert percentage to basis points.
 * @param {number} percent e.g. 5 for 5%
 * @returns {number} Basis points
 */
export function percentToBps(percent) {
  return Math.round(percent * 100);
}

/**
 * Get all incentive types as array for iteration.
 * @returns {Array}
 */
export function getAllIncentiveTypes() {
  return Object.values(INCENTIVE_TYPES);
}
