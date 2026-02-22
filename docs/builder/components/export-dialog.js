/**
 * <export-dialog> Web Component
 *
 * Provides export controls for quest configuration.
 * - Listens for state-changed events from quest-builder
 * - Offers Copy and Download buttons for JSON and TypeScript formats
 * - Shows notifications on successful copy/download
 */

import {
  generateJsonExport,
  generateTypescriptExport,
  copyToClipboard,
  downloadFile,
  generateFilename,
} from '../utils/export-codegen.js';

export class ExportDialog extends HTMLElement {
  #state = null;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  /**
   * Set the quest state to export.
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
   * Show a temporary notification.
   * @private
   */
  showNotification(message, type = 'success') {
    const notif = this.shadowRoot.querySelector('.notification');
    if (notif) {
      notif.textContent = message;
      notif.className = `notification notification-${type}`;
      notif.style.opacity = '1';
      notif.style.display = 'block';

      setTimeout(() => {
        notif.style.opacity = '0';
        setTimeout(() => {
          notif.style.display = 'none';
        }, 300);
      }, 2000);
    }
  }

  /**
   * Copy JSON to clipboard.
   * @private
   */
  async copyJson() {
    if (!this.#state) return;
    const jsonCode = generateJsonExport(this.#state);
    const success = await copyToClipboard(jsonCode);
    if (success) {
      this.showNotification('JSON copied to clipboard!', 'success');
    } else {
      this.showNotification('Failed to copy JSON', 'error');
    }
  }

  /**
   * Download JSON file.
   * @private
   */
  downloadJson() {
    if (!this.#state) return;
    const jsonCode = generateJsonExport(this.#state);
    const filename = generateFilename(this.#state.questName || 'quest', 'json');
    downloadFile(filename, jsonCode, 'application/json');
    this.showNotification(`Downloaded ${filename}`, 'success');
  }

  /**
   * Copy TypeScript to clipboard.
   * @private
   */
  async copyTypescript() {
    if (!this.#state) return;
    const tsCode = generateTypescriptExport(this.#state);
    const success = await copyToClipboard(tsCode);
    if (success) {
      this.showNotification('TypeScript copied to clipboard!', 'success');
    } else {
      this.showNotification('Failed to copy TypeScript', 'error');
    }
  }

  /**
   * Download TypeScript file.
   * @private
   */
  downloadTypescript() {
    if (!this.#state) return;
    const tsCode = generateTypescriptExport(this.#state);
    const filename = generateFilename(this.#state.questName || 'quest', 'ts');
    downloadFile(filename, tsCode, 'text/typescript');
    this.showNotification(`Downloaded ${filename}`, 'success');
  }

  /**
   * Render the export controls panel.
   * @private
   */
  render() {
    this.shadowRoot.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="export-panel">
        <div class="panel-title">Export & Download</div>

        ${
          !this.#state
            ? `<div class="placeholder">Configure a quest to export</div>`
            : `
              <div class="export-section">
                <div class="format-label">JSON Format</div>
                <div class="button-pair">
                  <button id="copy-json-btn" class="export-btn">
                    <span class="btn-icon">📋</span> Copy JSON
                  </button>
                  <button id="download-json-btn" class="export-btn">
                    <span class="btn-icon">⬇️</span> Download JSON
                  </button>
                </div>
              </div>

              <div class="export-section">
                <div class="format-label">TypeScript Format</div>
                <div class="button-pair">
                  <button id="copy-ts-btn" class="export-btn">
                    <span class="btn-icon">📋</span> Copy TypeScript
                  </button>
                  <button id="download-ts-btn" class="export-btn">
                    <span class="btn-icon">⬇️</span> Download TypeScript
                  </button>
                </div>
              </div>

              <div class="export-info">
                <p><strong>JSON Format:</strong> Universal format compatible with any language or platform.</p>
                <p><strong>TypeScript Format:</strong> Ready-to-import code for your Node.js/TypeScript backend.</p>
              </div>
            `
        }

        <div class="notification notification-success" style="display: none; opacity: 0;"></div>
      </div>
    `;

    if (this.#state) {
      this.bindEvents();
    }
  }

  /**
   * Bind button event listeners.
   * @private
   */
  bindEvents() {
    const copyJsonBtn = this.shadowRoot.querySelector('#copy-json-btn');
    if (copyJsonBtn) {
      copyJsonBtn.addEventListener('click', () => this.copyJson());
    }

    const downloadJsonBtn = this.shadowRoot.querySelector('#download-json-btn');
    if (downloadJsonBtn) {
      downloadJsonBtn.addEventListener('click', () => this.downloadJson());
    }

    const copyTsBtn = this.shadowRoot.querySelector('#copy-ts-btn');
    if (copyTsBtn) {
      copyTsBtn.addEventListener('click', () => this.copyTypescript());
    }

    const downloadTsBtn = this.shadowRoot.querySelector('#download-ts-btn');
    if (downloadTsBtn) {
      downloadTsBtn.addEventListener('click', () => this.downloadTypescript());
    }
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
        --focus: #0066cc;
        --success: #2ecc71;
      }

      .export-panel {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 4px;
        height: 100%;
        overflow-y: auto;
      }

      .panel-title {
        font-size: 14px;
        font-weight: 600;
        color: var(--text);
        text-transform: uppercase;
        letter-spacing: 0.05em;
        margin: 0;
      }

      .placeholder {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: #999;
        font-size: 13px;
        text-align: center;
      }

      .export-section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .format-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .button-pair {
        display: flex;
        gap: 8px;
        flex-direction: column;
      }

      .export-btn {
        flex: 1;
        padding: 10px 12px;
        border: 1px solid var(--border);
        border-radius: 4px;
        background: var(--bg);
        color: var(--text);
        font-size: 13px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 6px;
        white-space: nowrap;
      }

      .export-btn:hover {
        background: #f5f5f5;
        border-color: #999;
      }

      .export-btn:active {
        background: #efefef;
      }

      .btn-icon {
        font-size: 14px;
      }

      .export-info {
        padding: 12px;
        background: #f9f9f9;
        border: 1px solid var(--border);
        border-radius: 4px;
        font-size: 12px;
        color: #666;
        line-height: 1.6;
      }

      .export-info p {
        margin: 6px 0;
      }

      .export-info p:first-child {
        margin-top: 0;
      }

      .export-info p:last-child {
        margin-bottom: 0;
      }

      .notification {
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 12px 16px;
        border-radius: 4px;
        font-size: 13px;
        font-weight: 500;
        z-index: 1000;
        transition: opacity 0.3s;
        max-width: 300px;
      }

      .notification-success {
        background: var(--success);
        color: white;
        box-shadow: 0 4px 12px rgba(46, 204, 113, 0.2);
      }

      .notification-error {
        background: #e74c3c;
        color: white;
        box-shadow: 0 4px 12px rgba(231, 76, 60, 0.2);
      }

      @media (max-width: 1024px) {
        .button-pair {
          flex-direction: row;
        }

        .export-btn {
          flex: 1;
          padding: 8px 10px;
          font-size: 12px;
        }
      }
    `;
  }
}

customElements.define('export-dialog', ExportDialog);
