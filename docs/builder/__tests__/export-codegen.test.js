/**
 * Unit tests for export code generation
 * Tests JSON/TypeScript generation, syntax highlighting, file utilities
 */

import { describe, it, expect } from 'vitest';
import {
  generateJsonExport,
  generateTypescriptExport,
  generateFilename,
  highlightJson,
  highlightTypescript,
  bpsToPercent,
} from '../utils/export-codegen.js';

describe('Export Code Generation', () => {
  const testQuestState = {
    questId: 'quest-123',
    questName: 'TechConf 2025',
    description: 'The ultimate tech conference',
    expiresAt: '2025-12-31T23:59:59Z',
    metadata: {
      organizerName: 'Tech Team',
      eventUrl: 'https://techconf.example.com',
    },
    incentives: [
      {
        id: 'inc-1',
        type: 'social_share',
        discountBps: 500,
        description: 'Share on Twitter',
        expiresAt: '2025-12-31T23:59:59Z',
      },
      {
        id: 'inc-2',
        type: 'referral',
        discountBps: 1000,
        description: 'Refer a friend',
        expiresAt: '2025-12-31T23:59:59Z',
      },
    ],
  };

  describe('bpsToPercent', () => {
    it('converts basis points to percentage', () => {
      expect(bpsToPercent(500)).toBe('5.00%');
      expect(bpsToPercent(1000)).toBe('10.00%');
      expect(bpsToPercent(100)).toBe('1.00%');
      expect(bpsToPercent(10)).toBe('0.10%');
    });

    it('handles zero', () => {
      expect(bpsToPercent(0)).toBe('0.00%');
    });
  });

  describe('generateJsonExport', () => {
    it('generates valid JSON string', () => {
      const json = generateJsonExport(testQuestState);
      expect(typeof json).toBe('string');
      expect(() => JSON.parse(json)).not.toThrow();
    });

    it('includes all quest properties', () => {
      const json = generateJsonExport(testQuestState);
      const parsed = JSON.parse(json);

      expect(parsed.quest.id).toBe('quest-123');
      expect(parsed.quest.name).toBe('TechConf 2025');
      expect(parsed.quest.description).toBe('The ultimate tech conference');
    });

    it('includes all incentives', () => {
      const json = generateJsonExport(testQuestState);
      const parsed = JSON.parse(json);

      expect(parsed.quest.incentives.length).toBe(2);
      expect(parsed.quest.incentives[0].type).toBe('social_share');
      expect(parsed.quest.incentives[0].discountBps).toBe(500);
    });

    it('includes version field', () => {
      const json = generateJsonExport(testQuestState);
      const parsed = JSON.parse(json);

      expect(parsed.version).toBe('1.0');
    });

    it('is pretty-printed', () => {
      const json = generateJsonExport(testQuestState);
      expect(json).toContain('\n');
      expect(json).toContain('  ');
    });

    it('handles empty incentives', () => {
      const state = { ...testQuestState, incentives: [] };
      const json = generateJsonExport(state);
      const parsed = JSON.parse(json);

      expect(parsed.quest.incentives).toEqual([]);
    });
  });

  describe('generateTypescriptExport', () => {
    it('generates valid TypeScript string', () => {
      const ts = generateTypescriptExport(testQuestState);
      expect(typeof ts).toBe('string');
      expect(ts).toContain('import');
      expect(ts).toContain('export const');
    });

    it('includes incentiveId imports', () => {
      const ts = generateTypescriptExport(testQuestState);
      expect(ts).toContain('incentiveId');
      expect(ts).toContain("from '@quest-payments/models'");
    });

    it('exports incentives array with proper type', () => {
      const ts = generateTypescriptExport(testQuestState);
      expect(ts).toContain('export const techconf2025Incentives');
      expect(ts).toContain('IncentiveDefinition');
    });

    it('includes incentive objects with correct properties', () => {
      const ts = generateTypescriptExport(testQuestState);
      expect(ts).toContain("type: 'social_share'");
      expect(ts).toContain('discountBps: 500');
      expect(ts).toContain("description: 'Share on Twitter'");
    });

    it('creates QuestEvent example', () => {
      const ts = generateTypescriptExport(testQuestState);
      expect(ts).toContain('export const techconf2025Event');
      expect(ts).toContain('QuestEvent');
    });

    it('converts quest name to camelCase', () => {
      const state = { ...testQuestState, questName: 'My Tech Quest 2025' };
      const ts = generateTypescriptExport(state);
      expect(ts).toContain('myTechQuest2025Incentives');
    });

    it('handles special characters in descriptions', () => {
      const state = {
        ...testQuestState,
        incentives: [
          {
            id: 'inc-1',
            type: 'social_share',
            discountBps: 500,
            description: "Share with 'quoted' text",
            expiresAt: '2025-12-31T23:59:59Z',
          },
        ],
      };
      const ts = generateTypescriptExport(state);
      expect(ts).toContain('quoted'); // Should be escaped properly
      expect(() => new Function(ts)).not.toThrow();
    });
  });

  describe('generateFilename', () => {
    it('creates valid filename with .json extension', () => {
      const filename = generateFilename('My Quest', 'json');
      expect(filename).toMatch(/\.json$/);
      expect(filename).toContain('my-quest');
    });

    it('creates valid filename with .ts extension', () => {
      const filename = generateFilename('My Quest', 'ts');
      expect(filename).toMatch(/\.ts$/);
      expect(filename).toContain('my-quest');
    });

    it('includes date in YYYY-MM-DD format', () => {
      const filename = generateFilename('Quest', 'json');
      const dateRegex = /\d{4}-\d{2}-\d{2}/;
      expect(filename).toMatch(dateRegex);
    });

    it('converts spaces to hyphens', () => {
      const filename = generateFilename('My Big Quest', 'json');
      expect(filename).toContain('my-big-quest');
      expect(filename).not.toContain(' ');
    });

    it('removes special characters', () => {
      const filename = generateFilename('My@#$%Quest!', 'json');
      expect(filename).not.toContain('@');
      expect(filename).not.toContain('#');
      expect(filename).not.toContain('$');
    });

    it('handles empty quest name', () => {
      const filename = generateFilename('', 'json');
      expect(filename).toContain('quest');
      expect(filename.length > 0).toBe(true);
    });
  });

  describe('highlightJson', () => {
    it('returns HTML string', () => {
      const json = JSON.stringify({ key: 'value' });
      const highlighted = highlightJson(json);
      expect(typeof highlighted).toBe('string');
      expect(highlighted).toContain('<span');
    });

    it('escapes HTML entities', () => {
      const json = '{"html": "<script>"}';
      const highlighted = highlightJson(json);
      expect(highlighted).toContain('&lt;');
      expect(highlighted).toContain('&gt;');
      expect(highlighted).not.toContain('<script>');
    });

    it('highlights JSON strings', () => {
      const json = '{"key": "value"}';
      const highlighted = highlightJson(json);
      expect(highlighted).toContain('syntax-string');
    });

    it('highlights JSON numbers', () => {
      const json = '{"count": 42}';
      const highlighted = highlightJson(json);
      expect(highlighted).toContain('syntax-number');
    });

    it('highlights JSON keys', () => {
      const json = '{"myKey": "value"}';
      const highlighted = highlightJson(json);
      expect(highlighted).toContain('syntax-key');
    });

    it('highlights boolean values', () => {
      const json = '{"active": true, "deleted": false}';
      const highlighted = highlightJson(json);
      expect(highlighted).toContain('syntax-boolean');
    });

    it('highlights null values', () => {
      const json = '{"value": null}';
      const highlighted = highlightJson(json);
      expect(highlighted).toContain('syntax-null');
    });
  });

  describe('highlightTypescript', () => {
    it('returns HTML string', () => {
      const ts = "const x = 'hello';";
      const highlighted = highlightTypescript(ts);
      expect(typeof highlighted).toBe('string');
      expect(highlighted).toContain('<span');
    });

    it('highlights TypeScript strings', () => {
      const ts = "const msg = 'hello world';";
      const highlighted = highlightTypescript(ts);
      expect(highlighted).toContain('syntax-string');
    });

    it('highlights TypeScript keywords', () => {
      const ts = 'const x = 10; export function foo() {}';
      const highlighted = highlightTypescript(ts);
      expect(highlighted).toContain('syntax-keyword');
    });

    it('highlights TypeScript comments', () => {
      const ts = '// This is a comment\nconst x = 1;';
      const highlighted = highlightTypescript(ts);
      expect(highlighted).toContain('syntax-comment');
    });

    it('escapes HTML entities', () => {
      const ts = "console.log('<tag>');";
      const highlighted = highlightTypescript(ts);
      expect(highlighted).toContain('&lt;');
      expect(highlighted).not.toContain('<tag>');
    });
  });

  describe('Integration', () => {
    it('exported JSON can be parsed back to valid quest data', () => {
      const json = generateJsonExport(testQuestState);
      const parsed = JSON.parse(json);

      expect(parsed.quest.id).toBe(testQuestState.questId);
      expect(parsed.quest.incentives.length).toBe(testQuestState.incentives.length);
    });

    it('exported TypeScript contains all incentive data', () => {
      const ts = generateTypescriptExport(testQuestState);
      testQuestState.incentives.forEach(inc => {
        expect(ts).toContain(inc.type);
        expect(ts).toContain(inc.discountBps.toString());
      });
    });
  });
});
