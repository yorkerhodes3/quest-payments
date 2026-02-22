/**
 * <quest-builder> Web Component
 *
 * Main orchestrator for the quest configuration builder.
 * - Holds global state (current quest being edited)
 * - Listens for form changes from child components
 * - Dispatches state-changed events to viewers/exporters
 * - Manages localStorage persistence
 */

import { StateManager } from '../utils/state-manager.js';
import { DraftStorage } from '../utils/storage.js';
import { cloneQuest } from '../data/demo-quests.js';

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}

function getDefaultQuestState() {
  return {
    questId: generateId(),
    questName: '',
    description: '',
    expiresAt: new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0] + 'T23:59:59Z',
    incentives: [],
    metadata: {
      organizerName: '',
      eventUrl: '',
    },
  };
}

export class QuestBuilder extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });

    // Initialize state manager
    const savedDraft = DraftStorage.load();
    const initialState = savedDraft || getDefaultQuestState();
    this.stateManager = new StateManager(initialState);

    // Subscribe to state changes to save drafts
    this.stateManager.subscribe(state => {
      DraftStorage.save(state);
    });
  }

  connectedCallback() {
    this.render();
    this.bindDOMEvents();
    this.emitStateChange();
  }

  /**
   * Update a top-level state property.
   */
  updateState(key, value) {
    this.stateManager.setState({ [key]: value });
    this.emitStateChange();
  }

  /**
   * Add a new incentive with default values.
   */
  addIncentive() {
    const currentState = this.stateManager.getState();
    const newIncentive = {
      id: generateId(),
      type: 'social_share',
      discountBps: 500,
      description: '',
      expiresAt: currentState.expiresAt,
    };
    currentState.incentives.push(newIncentive);
    this.stateManager.setState({ incentives: [...currentState.incentives] });
    this.emitStateChange();
  }

  /**
   * Remove an incentive by ID.
   */
  removeIncentive(id) {
    const currentState = this.stateManager.getState();
    currentState.incentives = currentState.incentives.filter(i => i.id !== id);
    this.stateManager.setState({ incentives: [...currentState.incentives] });
    this.emitStateChange();
  }

  /**
   * Update an incentive by ID.
   */
  updateIncentive(id, updates) {
    const currentState = this.stateManager.getState();
    const idx = currentState.incentives.findIndex(i => i.id === id);
    if (idx >= 0) {
      currentState.incentives[idx] = { ...currentState.incentives[idx], ...updates };
      this.stateManager.setState({ incentives: [...currentState.incentives] });
      this.emitStateChange();
    }
  }

  /**
   * Load a demo quest and fork it (new ID).
   */
  forkQuest(demoQuest) {
    const forked = cloneQuest(demoQuest);
    forked.questId = generateId(); // New ID for this fork
    this.stateManager.setStateComplete(forked);
    this.render();
    this.emitStateChange();
  }

  /**
   * Undo last change.
   */
  undo() {
    if (this.stateManager.undo()) {
      this.render();
      this.emitStateChange();
      return true;
    }
    return false;
  }

  /**
   * Redo last undone change.
   */
  redo() {
    if (this.stateManager.redo()) {
      this.render();
      this.emitStateChange();
      return true;
    }
    return false;
  }

  /**
   * Clear state and start fresh.
   */
  clearDraft() {
    if (confirm('Clear draft and start over? This cannot be undone.')) {
      DraftStorage.clear();
      this.stateManager.setStateComplete(getDefaultQuestState());
      this.render();
      this.emitStateChange();
    }
  }

  /**
   * Get current state.
   */
  getState() {
    return this.stateManager.getState();
  }

  /**
   * Emit state-changed custom event.
   * @private
   */
  emitStateChange() {
    const state = this.stateManager.getState();
    this.dispatchEvent(
      new CustomEvent('state-changed', {
        detail: state,
        bubbles: true,
        composed: true,
      })
    );
  }

  /**
   * Render the shadow DOM.
   * @private
   */
  render() {
    const state = this.stateManager.getState();

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          --bg: #fff;
          --text: #333;
          --border: #ddd;
          --focus: #0066cc;
        }

        .builder-shell {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .panel {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .panel-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text);
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        label {
          font-size: 13px;
          font-weight: 500;
          color: var(--text);
        }

        input, textarea {
          padding: 8px 12px;
          border: 1px solid var(--border);
          border-radius: 4px;
          font-family: inherit;
          font-size: 13px;
          line-height: 1.5;
        }

        input:focus, textarea:focus {
          outline: none;
          border-color: var(--focus);
          box-shadow: 0 0 0 2px rgba(0, 102, 204, 0.1);
        }

        textarea {
          resize: vertical;
          min-height: 60px;
        }

        .button-group {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        button {
          padding: 8px 16px;
          border: 1px solid var(--border);
          border-radius: 4px;
          background: var(--bg);
          color: var(--text);
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        button:hover {
          background: #f5f5f5;
          border-color: #999;
        }

        button:focus {
          outline: none;
          box-shadow: 0 0 0 2px var(--focus);
        }

        button.primary {
          background: var(--focus);
          color: white;
          border-color: var(--focus);
        }

        button.primary:hover {
          background: #0052a3;
          border-color: #0052a3;
        }

        .incentives-section {
          border-top: 1px solid var(--border);
          padding-top: 12px;
        }

        .incentive-item {
          padding: 12px;
          background: #f9f9f9;
          border: 1px solid var(--border);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .incentive-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .incentive-type {
          font-weight: 500;
          font-size: 12px;
          color: var(--focus);
        }

        .remove-btn {
          padding: 4px 8px;
          font-size: 12px;
          color: #d32f2f;
          border-color: #d32f2f;
        }

        .remove-btn:hover {
          background: #ffebee;
        }

        .status-bar {
          padding: 12px;
          background: #f0f0f0;
          border-radius: 4px;
          font-size: 12px;
          color: #666;
        }

        @media (max-width: 1024px) {
          .builder-shell {
            gap: 8px;
          }
        }
      </style>

      <div class="builder-shell">
        <div class="panel">
          <div class="panel-title">Quest Details</div>

          <div class="form-group">
            <label for="quest-name">Quest Name</label>
            <input
              id="quest-name"
              type="text"
              placeholder="e.g., TechConf 2025"
              value="${state.questName}"
            />
          </div>

          <div class="form-group">
            <label for="quest-desc">Description</label>
            <textarea
              id="quest-desc"
              placeholder="What is this quest about?"
            >${state.description}</textarea>
          </div>

          <div class="form-group">
            <label for="quest-expires">Quest Ends On</label>
            <input
              id="quest-expires"
              type="datetime-local"
              value="${state.expiresAt.replace('Z', '').split('.')[0]}"
            />
          </div>

          <div class="form-group">
            <label for="organizer-name">Organizer Name</label>
            <input
              id="organizer-name"
              type="text"
              placeholder="Your organization name"
              value="${state.metadata.organizerName || ''}"
            />
          </div>

          <div class="form-group">
            <label for="event-url">Event URL</label>
            <input
              id="event-url"
              type="url"
              placeholder="https://example.com"
              value="${state.metadata.eventUrl || ''}"
            />
          </div>

          <div class="incentives-section">
            <div class="panel-title">Incentives (${state.incentives.length})</div>

            ${
              state.incentives.length === 0
                ? '<p style="font-size: 13px; color: #999;">No incentives yet. Add one to get started.</p>'
                : state.incentives
                    .map(
                      inc => `
              <div class="incentive-item">
                <div class="incentive-header">
                  <div class="incentive-type">${inc.type}</div>
                  <button class="remove-btn" data-incentive-id="${inc.id}">Remove</button>
                </div>
                <input
                  type="text"
                  placeholder="Description"
                  value="${inc.description}"
                  data-incentive-id="${inc.id}"
                  data-field="description"
                  style="font-size: 12px;"
                />
                <div style="display: flex; gap: 8px; font-size: 12px;">
                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value="${inc.discountBps}"
                    data-incentive-id="${inc.id}"
                    data-field="discountBps"
                    placeholder="Discount (bps)"
                    style="flex: 1; font-size: 12px;"
                  />
                  <span style="align-self: center; color: #666;">
                    = ${(inc.discountBps / 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            `
                    )
                    .join('')
            }

            <button class="primary" id="add-incentive-btn" style="width: 100%;">
              + Add Incentive
            </button>
          </div>

          <div class="button-group">
            <button id="undo-btn">↶ Undo</button>
            <button id="redo-btn">↷ Redo</button>
            <button id="clear-btn" style="flex: 1;">Clear Draft</button>
          </div>

          <div class="status-bar" id="status">
            Unsaved changes (autosave enabled)
          </div>
        </div>
      </div>
    `;

    this.bindDOMEvents();
  }

  /**
   * Bind DOM event listeners.
   * @private
   */
  bindDOMEvents() {
    // Form inputs
    const questNameInput = this.shadowRoot.querySelector('#quest-name');
    if (questNameInput) {
      questNameInput.addEventListener('change', e => {
        this.updateState('questName', e.target.value);
      });
    }

    const questDescInput = this.shadowRoot.querySelector('#quest-desc');
    if (questDescInput) {
      questDescInput.addEventListener('change', e => {
        this.updateState('description', e.target.value);
      });
    }

    const questExpiresInput = this.shadowRoot.querySelector('#quest-expires');
    if (questExpiresInput) {
      questExpiresInput.addEventListener('change', e => {
        const dateStr = e.target.value;
        if (dateStr) {
          const isoString = new Date(dateStr + ':00Z').toISOString();
          this.updateState('expiresAt', isoString.replace(/\.000Z$/, 'Z'));
        }
      });
    }

    const organizerInput = this.shadowRoot.querySelector('#organizer-name');
    if (organizerInput) {
      organizerInput.addEventListener('change', e => {
        const state = this.stateManager.getState();
        state.metadata.organizerName = e.target.value;
        this.updateState('metadata', state.metadata);
      });
    }

    const eventUrlInput = this.shadowRoot.querySelector('#event-url');
    if (eventUrlInput) {
      eventUrlInput.addEventListener('change', e => {
        const state = this.stateManager.getState();
        state.metadata.eventUrl = e.target.value;
        this.updateState('metadata', state.metadata);
      });
    }

    // Incentive fields
    this.shadowRoot.querySelectorAll('input[data-field]').forEach(input => {
      input.addEventListener('change', e => {
        const incentiveId = e.target.dataset.incentiveId;
        const field = e.target.dataset.field;
        let value = e.target.value;

        if (field === 'discountBps') {
          value = parseInt(value) || 0;
        }

        this.updateIncentive(incentiveId, { [field]: value });
      });
    });

    // Add incentive button
    const addBtn = this.shadowRoot.querySelector('#add-incentive-btn');
    if (addBtn) {
      addBtn.addEventListener('click', () => this.addIncentive());
    }

    // Remove incentive buttons
    this.shadowRoot.querySelectorAll('.remove-btn').forEach(btn => {
      btn.addEventListener('click', e => {
        const incentiveId = e.target.dataset.incentiveId;
        this.removeIncentive(incentiveId);
      });
    });

    // Undo/Redo buttons
    const undoBtn = this.shadowRoot.querySelector('#undo-btn');
    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.undo());
    }

    const redoBtn = this.shadowRoot.querySelector('#redo-btn');
    if (redoBtn) {
      redoBtn.addEventListener('click', () => this.redo());
    }

    // Clear button
    const clearBtn = this.shadowRoot.querySelector('#clear-btn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => this.clearDraft());
    }
  }
}

customElements.define('quest-builder', QuestBuilder);
