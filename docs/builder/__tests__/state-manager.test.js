/**
 * Unit tests for StateManager
 * Tests state updates, subscribers, and undo/redo functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { StateManager } from '../utils/state-manager.js';

describe('StateManager', () => {
  let stateManager;
  const initialState = {
    questId: '123',
    questName: 'Test Quest',
    description: 'Test description',
    expiresAt: '2025-12-31T23:59:59Z',
    incentives: [],
    metadata: {
      organizerName: 'Test Org',
      eventUrl: 'https://example.com',
    },
  };

  beforeEach(() => {
    stateManager = new StateManager(initialState);
  });

  describe('State Management', () => {
    it('initializes with provided state', () => {
      const state = stateManager.getState();
      expect(state.questName).toBe('Test Quest');
      expect(state.questId).toBe('123');
    });

    it('updates state with setState', () => {
      stateManager.setState({ questName: 'Updated Quest' });
      const state = stateManager.getState();
      expect(state.questName).toBe('Updated Quest');
    });

    it('performs shallow merge on setState', () => {
      stateManager.setState({ questName: 'Updated' });
      const state = stateManager.getState();
      expect(state.description).toBe('Test description');
    });

    it('does not modify state object directly', () => {
      const state1 = stateManager.getState();
      stateManager.setState({ questName: 'Changed' });
      const state2 = stateManager.getState();
      expect(state1.questName).toBe('Test Quest');
      expect(state2.questName).toBe('Changed');
    });
  });

  describe('Subscribers', () => {
    it('calls subscriber on state change', () => {
      let called = false;
      let receivedState = null;
      stateManager.subscribe(state => {
        called = true;
        receivedState = state;
      });

      stateManager.setState({ questName: 'Updated' });
      expect(called).toBe(true);
      expect(receivedState.questName).toBe('Updated');
    });

    it('supports multiple subscribers', () => {
      let calls = 0;
      stateManager.subscribe(() => calls++);
      stateManager.subscribe(() => calls++);

      stateManager.setState({ questName: 'Test' });
      expect(calls).toBe(2);
    });

    it('returns unsubscribe function', () => {
      let calls = 0;
      const unsubscribe = stateManager.subscribe(() => calls++);

      stateManager.setState({ questName: 'Test 1' });
      expect(calls).toBe(1);

      unsubscribe();
      stateManager.setState({ questName: 'Test 2' });
      expect(calls).toBe(1);
    });

    it('handles subscriber errors gracefully', () => {
      stateManager.subscribe(() => {
        throw new Error('Subscriber error');
      });
      stateManager.subscribe(() => {
        // This should still be called
      });

      expect(() => {
        stateManager.setState({ questName: 'Test' });
      }).not.toThrow();
    });
  });

  describe('Undo/Redo', () => {
    it('undoes state changes', () => {
      stateManager.setState({ questName: 'First' });
      stateManager.setState({ questName: 'Second' });

      const undone = stateManager.undo();
      expect(undone).toBe(true);
      expect(stateManager.getState().questName).toBe('First');
    });

    it('redoes after undo', () => {
      stateManager.setState({ questName: 'First' });
      stateManager.setState({ questName: 'Second' });

      stateManager.undo();
      const redone = stateManager.redo();
      expect(redone).toBe(true);
      expect(stateManager.getState().questName).toBe('Second');
    });

    it('returns false when nothing to undo', () => {
      const result = stateManager.undo();
      expect(result).toBe(false);
    });

    it('returns false when nothing to redo', () => {
      const result = stateManager.redo();
      expect(result).toBe(false);
    });

    it('maintains history limit of 20 snapshots', () => {
      for (let i = 0; i < 25; i++) {
        stateManager.setState({ questName: `Quest ${i}` });
      }

      // Should only be able to undo 20 times max
      let undoCount = 0;
      while (stateManager.undo()) {
        undoCount++;
      }
      expect(undoCount).toBeLessThanOrEqual(20);
    });

    it('clears redo history on new state change after undo', () => {
      stateManager.setState({ questName: 'First' });
      stateManager.setState({ questName: 'Second' });
      stateManager.undo();

      stateManager.setState({ questName: 'Third' });
      const redone = stateManager.redo();
      expect(redone).toBe(false);
      expect(stateManager.getState().questName).toBe('Third');
    });
  });

  describe('setStateComplete', () => {
    it('replaces entire state', () => {
      const newState = {
        questId: '456',
        questName: 'New Quest',
        description: 'New description',
        expiresAt: '2025-11-30T23:59:59Z',
        incentives: [{ id: '1', type: 'social_share', discountBps: 500 }],
        metadata: { organizerName: 'New Org', eventUrl: 'https://new.com' },
      };

      stateManager.setStateComplete(newState);
      const current = stateManager.getState();
      expect(current.questId).toBe('456');
      expect(current.questName).toBe('New Quest');
      expect(current.incentives.length).toBe(1);
    });

    it('triggers subscribers on complete state replacement', () => {
      let called = false;
      stateManager.subscribe(() => {
        called = true;
      });

      const newState = { ...initialState, questId: '999' };
      stateManager.setStateComplete(newState);
      expect(called).toBe(true);
    });
  });

  describe('clear', () => {
    it('clears history', () => {
      stateManager.setState({ questName: 'Test1' });
      stateManager.setState({ questName: 'Test2' });

      stateManager.clear();
      const result = stateManager.undo();
      expect(result).toBe(false);
    });
  });
});
