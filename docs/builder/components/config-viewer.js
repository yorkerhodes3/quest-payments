/**
 * <config-viewer> Web Component
 *
 * Displays live JSON and TypeScript previews of the quest configuration.
 * - Listens for state-changed events from quest-builder
 * - Renders syntax-highlighted JSON and TS code
 * - Tab UI to switch between formats
 */

import {
  generateJsonExport,
  generateTypescriptExport,
  highlightJson,
  highlightTypescript,
} from '../utils/export-codegen.js';

export class ConfigViewer extends HTMLElement {
  #state = null;
  #activeTab = 'json';

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Set the quest state to display.
   */
  set state(value) {
    this.#state = value;
    this.render();
  }

  connectedCallback() {
    this.render();
    // Listen for state changes from quest-builder
    document.addEventListener('state-changed', e => {
      this.state = e.detail;
    });
  }

  /**
   * Handle tab switching.
   * @private
   */
  switchTab(tab) {
    this.#activeTab = tab;
    this.render();
  }

  /**
   * Render the preview panel.
   * @private
   */
  render() {
    if (!this.#state) {
      this.shadowRoot.innerHTML = `
        <style>${this.getStyles()}</style>
        <div class="viewer-placeholder">
          Waiting for quest configuration...
        </div>
      `;
      return;
    }

    const jsonCode = generateJsonExport(this.#state);
    const tsCode = generateTypescriptExport(this.#state);

    let activeContent;
    if (this.#activeTab === 'json') {
      activeContent = `<pre class="code-block"><code>${highlightJson(jsonCode)}</code></pre>`;
    } else {
      activeContent = `<pre class="code-block"><code>${highlightTypescript(tsCode)}</code></pre>`;
    }

    this.shadowRoot.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="viewer-container">
        <div class="tabs">
          <button class="tab-button ${this.#activeTab === 'json' ? 'active' : ''}" data-tab="json">
            JSON
          </button>
          <button class="tab-button ${this.#activeTab === 'ts' ? 'active' : ''}" data-tab="ts">
            TypeScript
          </button>
        </div>
        <div class="content-panel">
          ${activeContent}
        </div>
      </div>
    `;

    this.bindTabEvents();
  }

  /**
   * Bind tab button events.
   * @private
   */
  bindTabEvents() {
    this.shadowRoot.querySelectorAll('.tab-button').forEach(btn => {
      btn.addEventListener('click', e => {
        this.switchTab(e.target.dataset.tab);
      });
    });
  }

  /**
   * Get component styles.
   * @private
   */
  getStyles() {
    return `
      :host {
        display: block;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Menlo, monospace;
        --bg: #fff;
        --text: #333;
        --border: #ddd;
        --code-bg: #f5f5f5;
        --focus: #0066cc;
      }

      .viewer-container {
        display: flex;
        flex-direction: column;
        height: 100%;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 4px;
        overflow: hidden;
      }

      .viewer-placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 300px;
        color: #999;
        font-size: 13px;
      }

      .tabs {
        display: flex;
        gap: 0;
        padding: 0;
        margin: 0;
        border-bottom: 1px solid var(--border);
        background: var(--code-bg);
      }

      .tab-button {
        flex: 1;
        padding: 10px 16px;
        border: none;
        background: transparent;
        color: var(--text);
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
        border-bottom: 2px solid transparent;
        transition: all 0.2s;
      }

      .tab-button:hover {
        background: rgba(0, 0, 0, 0.05);
      }

      .tab-button.active {
        border-bottom-color: var(--focus);
        color: var(--focus);
        background: var(--bg);
      }

      .content-panel {
        flex: 1;
        overflow: auto;
        padding: 0;
      }

      .code-block {
        margin: 0;
        padding: 16px;
        background: var(--bg);
        font-family: 'Monaco', 'Menlo', 'Sublime Text', monospace;
        font-size: 12px;
        line-height: 1.5;
        color: var(--text);
        white-space: pre-wrap;
        word-wrap: break-word;
        word-break: break-word;
      }

      .code-block code {
        display: block;
      }

      /* Syntax highlighting */
      .syntax-key {
        color: #0066cc;
        font-weight: 500;
      }

      .syntax-string {
        color: #067d17;
      }

      .syntax-number {
        color: #005cc5;
      }

      .syntax-boolean {
        color: #d73a49;
      }

      .syntax-null {
        color: #6f42c1;
      }

      .syntax-keyword {
        color: #d73a49;
        font-weight: 500;
      }

      .syntax-function {
        color: #6f42c1;
      }

      .syntax-comment {
        color: #999;
        font-style: italic;
      }

      @media (max-width: 1024px) {
        .viewer-container {
          min-height: 400px;
        }
      }
    `;
  }
}

customElements.define('config-viewer', ConfigViewer);
