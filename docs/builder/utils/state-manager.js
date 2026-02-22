/**
 * Lightweight event-based state container for the quest builder.
 * No dependencies, pure JavaScript.
 *
 * Usage:
 *   const manager = new StateManager(initialState);
 *   manager.subscribe(state => console.log('State changed:', state));
 *   manager.setState({ questName: 'New Name' });
 */

export class StateManager {
  constructor(initialState) {
    // Deep copy initial state to avoid external mutations
    this.state = JSON.parse(JSON.stringify(initialState));

    // Set of subscriber functions
    this.subscribers = new Set();

    // Undo/redo history (optional, for MVP)
    this.history = [];
    this.historyIndex = -1;
    this.maxHistorySize = 20;
  }

  /**
   * Subscribe to state changes.
   * @param {Function} fn Callback that receives updated state
   * @returns {Function} Unsubscribe function
   */
  subscribe(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError('Subscriber must be a function');
    }
    this.subscribers.add(fn);
    return () => this.subscribers.delete(fn);
  }

  /**
   * Update state with partial updates.
   * Triggers all subscribers with new state.
   * @param {Record<string, any>} updates Shallow update object
   */
  setState(updates) {
    if (typeof updates !== 'object' || updates === null) {
      throw new TypeError('Updates must be an object');
    }

    // Push current state to history before updating
    this.pushHistory();

    // Merge updates into state
    this.state = { ...this.state, ...updates };

    // Notify all subscribers
    this.notifySubscribers();
  }

  /**
   * Replace entire state.
   * @param {Record<string, any>} newState New state object
   */
  setStateComplete(newState) {
    if (typeof newState !== 'object' || newState === null) {
      throw new TypeError('State must be an object');
    }

    this.pushHistory();
    this.state = JSON.parse(JSON.stringify(newState));
    this.notifySubscribers();
  }

  /**
   * Get current state (returns a deep copy).
   * @returns {Record<string, any>}
   */
  getState() {
    return JSON.parse(JSON.stringify(this.state));
  }

  /**
   * Notify all subscribers of state change.
   * @private
   */
  notifySubscribers() {
    const stateCopy = this.getState();
    this.subscribers.forEach(fn => {
      try {
        fn(stateCopy);
      } catch (err) {
        console.error('Subscriber error:', err);
      }
    });
  }

  /**
   * Push current state to undo history.
   * @private
   */
  pushHistory() {
    // Remove any forward history if we've navigated back and then make a new change
    if (this.historyIndex < this.history.length - 1) {
      this.history = this.history.slice(0, this.historyIndex + 1);
    }

    this.history.push(JSON.parse(JSON.stringify(this.state)));
    this.historyIndex = this.history.length - 1;

    // Keep history size reasonable
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
      this.historyIndex--;
    }
  }

  /**
   * Undo to previous state.
   * @returns {boolean} True if undo succeeded
   */
  undo() {
    if (this.historyIndex > 0) {
      this.historyIndex--;
      this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      this.notifySubscribers();
      return true;
    }
    return false;
  }

  /**
   * Redo to next state.
   * @returns {boolean} True if redo succeeded
   */
  redo() {
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++;
      this.state = JSON.parse(JSON.stringify(this.history[this.historyIndex]));
      this.notifySubscribers();
      return true;
    }
    return false;
  }

  /**
   * Clear all state and history.
   */
  clear() {
    this.setState({});
    this.history = [];
    this.historyIndex = -1;
  }
}
