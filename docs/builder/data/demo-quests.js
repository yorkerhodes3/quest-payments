/**
 * Hardcoded example quest configurations.
 * Users can fork these to customize for their own events.
 */

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function futureDate(daysFromNow = 30) {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split('T')[0] + 'T23:59:59Z';
}

export const DEMO_QUESTS = [
  {
    id: generateId(),
    name: 'TechConf 2025',
    description: 'Complete quests to earn discounts on your TechConf 2025 ticket',
    expiresAt: futureDate(60),
    metadata: {
      organizerName: 'TechConf Organizers',
      eventUrl: 'https://techconf.example.com',
    },
    incentives: [
      {
        id: generateId(),
        type: 'social_share',
        discountBps: 500,
        description: 'Share TechConf 2025 on Twitter or LinkedIn',
        expiresAt: futureDate(60),
      },
      {
        id: generateId(),
        type: 'referral',
        discountBps: 1000,
        description: 'Refer 2+ friends who purchase tickets',
        expiresAt: futureDate(60),
      },
      {
        id: generateId(),
        type: 'check_in',
        discountBps: 500,
        description: 'Check in at the event on opening day',
        expiresAt: futureDate(65),
      },
      {
        id: generateId(),
        type: 'sponsor_session',
        discountBps: 300,
        description: 'Attend a featured partner workshop session',
        expiresAt: futureDate(65),
      },
      {
        id: generateId(),
        type: 'feedback',
        discountBps: 200,
        description: 'Complete the post-conference feedback survey',
        expiresAt: futureDate(75),
      },
    ],
  },
  {
    id: generateId(),
    name: 'Product Launch Q2',
    description: 'Celebrate our Q2 product launch with special pricing',
    expiresAt: futureDate(45),
    metadata: {
      organizerName: 'Product Team',
      eventUrl: 'https://productlaunch.example.com',
    },
    incentives: [
      {
        id: generateId(),
        type: 'referral',
        discountBps: 1500,
        description: 'Refer a colleague who attends',
        expiresAt: futureDate(45),
      },
      {
        id: generateId(),
        type: 'social_share',
        discountBps: 700,
        description: 'Post about the launch on social media',
        expiresAt: futureDate(45),
      },
      {
        id: generateId(),
        type: 'feedback',
        discountBps: 300,
        description: 'Share your feedback on the new features',
        expiresAt: futureDate(50),
      },
    ],
  },
  {
    id: generateId(),
    name: 'Networking Event NYC',
    description: 'Connect with industry leaders at our NYC networking mixer',
    expiresAt: futureDate(30),
    metadata: {
      organizerName: 'Community Team',
      eventUrl: 'https://nyc-network.example.com',
    },
    incentives: [
      {
        id: generateId(),
        type: 'check_in',
        discountBps: 800,
        description: 'Check in when you arrive at the event',
        expiresAt: futureDate(30),
      },
      {
        id: generateId(),
        type: 'social_share',
        discountBps: 600,
        description: 'Share event photos on Instagram or Twitter',
        expiresAt: futureDate(35),
      },
      {
        id: generateId(),
        type: 'referral',
        discountBps: 1200,
        description: 'Bring a friend (each referral = discount)',
        expiresAt: futureDate(30),
      },
    ],
  },
  {
    id: generateId(),
    name: 'Student Hackathon 2025',
    description: 'Register for the largest student coding competition',
    expiresAt: futureDate(90),
    metadata: {
      organizerName: 'University CS Dept',
      eventUrl: 'https://hackathon.edu',
    },
    incentives: [
      {
        id: generateId(),
        type: 'social_share',
        discountBps: 500,
        description: 'Share event poster on social media',
        expiresAt: futureDate(90),
      },
      {
        id: generateId(),
        type: 'referral',
        discountBps: 800,
        description: 'Get friends to sign up',
        expiresAt: futureDate(90),
      },
      {
        id: generateId(),
        type: 'manual',
        discountBps: 400,
        description: 'Win Best Newcomer category',
        expiresAt: futureDate(95),
      },
    ],
  },
  {
    id: generateId(),
    name: 'Webinar Series: AI in Business',
    description: 'Join us for a 6-week deep dive into AI applications',
    expiresAt: futureDate(7),
    metadata: {
      organizerName: 'Learning Platform',
      eventUrl: 'https://webinar.example.com',
    },
    incentives: [
      {
        id: generateId(),
        type: 'check_in',
        discountBps: 300,
        description: 'Attend the first session live',
        expiresAt: futureDate(7),
      },
      {
        id: generateId(),
        type: 'feedback',
        discountBps: 200,
        description: 'Complete weekly quizzes (3+ quizzes)',
        expiresAt: futureDate(42),
      },
      {
        id: generateId(),
        type: 'referral',
        discountBps: 500,
        description: 'Refer a colleague to the series',
        expiresAt: futureDate(42),
      },
    ],
  },
];

/**
 * Get a demo quest by index or ID.
 * @param {number | string} idOrIndex
 * @returns {Record<string, any> | null}
 */
export function getDemoQuest(idOrIndex) {
  if (typeof idOrIndex === 'number') {
    return DEMO_QUESTS[idOrIndex] || null;
  }
  return DEMO_QUESTS.find(q => q.id === idOrIndex) || null;
}

/**
 * Deep clone a demo quest so it can be modified.
 * @param {Record<string, any>} quest
 * @returns {Record<string, any>}
 */
export function cloneQuest(quest) {
  return JSON.parse(JSON.stringify(quest));
}

/**
 * Get total max discount for a quest (sum of all incentive discounts).
 * @param {Record<string, any>} quest
 * @returns {number} Basis points
 */
export function getMaxDiscount(quest) {
  return quest.incentives.reduce((sum, inc) => sum + inc.discountBps, 0);
}
