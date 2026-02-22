/**
 * localStorage utilities for draft persistence.
 * Simple key-value wrapper for MVP (swappable for API later).
 */

const STORAGE_KEY = 'quest-builder-draft';
const HISTORY_KEY = 'quest-builder-history';

export class DraftStorage {
  /**
   * Save quest state to localStorage.
   * @param {Record<string, any>} state Quest state object
   * @returns {boolean} True if save succeeded
   */
  static save(state) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      return true;
    } catch (err) {
      console.error('Failed to save draft:', err);
      return false;
    }
  }

  /**
   * Load quest state from localStorage.
   * @returns {Record<string, any> | null} Saved state or null if none
   */
  static load() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch (err) {
      console.error('Failed to load draft:', err);
      return null;
    }
  }

  /**
   * Clear the draft from localStorage.
   */
  static clear() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error('Failed to clear draft:', err);
    }
  }

  /**
   * Check if a draft exists.
   * @returns {boolean}
   */
  static hasDraft() {
    try {
      return localStorage.getItem(STORAGE_KEY) !== null;
    } catch {
      return false;
    }
  }

  /**
   * Save an entry to history (for recovery/debugging).
   * Keeps last 10 snapshots.
   * @param {Record<string, any>} state Quest state object
   */
  static addToHistory(state) {
    try {
      const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
      history.push({
        timestamp: new Date().toISOString(),
        state: state,
      });

      // Keep only last 10
      if (history.length > 10) {
        history.shift();
      }

      localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
    } catch (err) {
      console.warn('Failed to add to history:', err);
    }
  }

  /**
   * Get recovery history.
   * @returns {Array}
   */
  static getHistory() {
    try {
      return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    } catch {
      return [];
    }
  }

  /**
   * Clear all storage (draft + history).
   */
  static clearAll() {
    this.clear();
    try {
      localStorage.removeItem(HISTORY_KEY);
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
  }
}
