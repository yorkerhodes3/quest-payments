/**
 * <examples-gallery> Web Component
 *
 * Displays hardcoded demo quest examples in a carousel/grid.
 * - Shows preview cards for each demo quest
 * - "Fork This Quest" button to load demo into builder
 * - Emits fork-quest event that quest-builder listens to
 */

import { DEMO_QUESTS, getMaxDiscount } from '../data/demo-quests.js';

export class ExamplesGallery extends HTMLElement {
  #currentIndex = 0;

  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
    this.bindEvents();
  }

  /**
   * Fork a demo quest and emit event.
   * @private
   */
  forkQuest(questIndex) {
    const demo = DEMO_QUESTS[questIndex];
    if (demo) {
      this.dispatchEvent(
        new CustomEvent('fork-quest', {
          detail: demo,
          bubbles: true,
          composed: true,
        })
      );
    }
  }

  /**
   * Navigate carousel to previous item.
   * @private
   */
  previousQuest() {
    this.#currentIndex = (this.#currentIndex - 1 + DEMO_QUESTS.length) % DEMO_QUESTS.length;
    this.render();
    this.bindEvents();
  }

  /**
   * Navigate carousel to next item.
   * @private
   */
  nextQuest() {
    this.#currentIndex = (this.#currentIndex + 1) % DEMO_QUESTS.length;
    this.render();
    this.bindEvents();
  }

  /**
   * Render the gallery.
   * @private
   */
  render() {
    const quest = DEMO_QUESTS[this.#currentIndex];
    const maxDiscount = getMaxDiscount(quest);
    const discountPct = (maxDiscount / 100).toFixed(1);

    this.shadowRoot.innerHTML = `
      <style>${this.getStyles()}</style>
      <div class="gallery-container">
        <div class="gallery-header">
          <h2>Demo Quests</h2>
          <p class="subtitle">Fork any example to customize for your event</p>
        </div>

        <div class="carousel">
          <div class="carousel-inner">
            <button class="carousel-btn carousel-btn-prev" id="prev-btn" aria-label="Previous quest">
              <span class="arrow">‹</span>
            </button>

            <div class="quest-card">
              <div class="card-header">
                <h3 class="quest-name">${quest.name}</h3>
                <div class="quest-meta">
                  <span class="incentive-count">${quest.incentives.length} incentive${quest.incentives.length !== 1 ? 's' : ''}</span>
                  <span class="max-discount">Max: ${discountPct}%</span>
                </div>
              </div>

              <div class="card-body">
                <p class="quest-description">${quest.description}</p>

                <div class="incentives-preview">
                  <div class="preview-label">Includes:</div>
                  <ul class="incentive-list">
                    ${quest.incentives
                      .slice(0, 4)
                      .map(
                        inc => `
                      <li class="incentive-item">
                        <span class="inc-type">${inc.type.replace(/_/g, ' ')}</span>
                        <span class="inc-discount">${(inc.discountBps / 100).toFixed(1)}%</span>
                      </li>
                    `
                      )
                      .join('')}
                    ${quest.incentives.length > 4 ? `<li class="more-indicator">+ ${quest.incentives.length - 4} more</li>` : ''}
                  </ul>
                </div>
              </div>

              <div class="card-footer">
                <button class="fork-btn" id="fork-btn">
                  <span class="btn-icon">→</span> Fork This Quest
                </button>
              </div>
            </div>

            <button class="carousel-btn carousel-btn-next" id="next-btn" aria-label="Next quest">
              <span class="arrow">›</span>
            </button>
          </div>

          <div class="carousel-indicators">
            ${DEMO_QUESTS.map(
              (_, idx) => `
              <button
                class="indicator ${idx === this.#currentIndex ? 'active' : ''}"
                data-index="${idx}"
                aria-label="Go to quest ${idx + 1}"
              ></button>
            `
            ).join('')}
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Bind event listeners.
   * @private
   */
  bindEvents() {
    const prevBtn = this.shadowRoot.querySelector('#prev-btn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.previousQuest());
    }

    const nextBtn = this.shadowRoot.querySelector('#next-btn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextQuest());
    }

    const forkBtn = this.shadowRoot.querySelector('#fork-btn');
    if (forkBtn) {
      forkBtn.addEventListener('click', () => this.forkQuest(this.#currentIndex));
    }

    const indicators = this.shadowRoot.querySelectorAll('.indicator');
    indicators.forEach(btn => {
      btn.addEventListener('click', e => {
        this.#currentIndex = parseInt(e.target.dataset.index);
        this.render();
        this.bindEvents();
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
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        --bg: #fff;
        --bg-alt: #f9f9f9;
        --text: #333;
        --text-secondary: #666;
        --border: #ddd;
        --focus: #0066cc;
      }

      .gallery-container {
        display: flex;
        flex-direction: column;
        gap: 20px;
        padding: 20px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 8px;
      }

      .gallery-header {
        text-align: center;
        margin-bottom: 10px;
      }

      .gallery-header h2 {
        font-size: 24px;
        font-weight: 700;
        color: var(--text);
        margin: 0;
      }

      .subtitle {
        font-size: 14px;
        color: var(--text-secondary);
        margin: 6px 0 0 0;
      }

      .carousel {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .carousel-inner {
        display: flex;
        align-items: center;
        gap: 12px;
        min-height: 400px;
      }

      .carousel-btn {
        flex-shrink: 0;
        width: 40px;
        height: 40px;
        border: 1px solid var(--border);
        border-radius: 4px;
        background: var(--bg);
        color: var(--text);
        font-size: 20px;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .carousel-btn:hover {
        background: var(--bg-alt);
        border-color: var(--focus);
        color: var(--focus);
      }

      .carousel-btn:active {
        background: #f0f0f0;
      }

      .carousel-btn-prev, .carousel-btn-next {
        position: relative;
      }

      .arrow {
        font-weight: 300;
        line-height: 1;
      }

      .quest-card {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 20px;
        background: var(--bg);
        border: 1px solid var(--border);
        border-radius: 6px;
        min-height: 360px;
      }

      .card-header {
        display: flex;
        flex-direction: column;
        gap: 8px;
        border-bottom: 1px solid var(--border);
        padding-bottom: 12px;
      }

      .quest-name {
        font-size: 20px;
        font-weight: 600;
        color: var(--text);
        margin: 0;
      }

      .quest-meta {
        display: flex;
        gap: 16px;
        font-size: 12px;
      }

      .incentive-count, .max-discount {
        color: var(--text-secondary);
      }

      .max-discount {
        font-weight: 500;
        color: var(--focus);
      }

      .card-body {
        flex: 1;
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .quest-description {
        font-size: 14px;
        line-height: 1.6;
        color: var(--text);
        margin: 0;
      }

      .incentives-preview {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .preview-label {
        font-size: 12px;
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .incentive-list {
        list-style: none;
        margin: 0;
        padding: 0;
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .incentive-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 6px 8px;
        background: var(--bg-alt);
        border-radius: 4px;
        font-size: 12px;
      }

      .inc-type {
        color: var(--text);
        text-transform: capitalize;
      }

      .inc-discount {
        font-weight: 600;
        color: var(--focus);
        min-width: 35px;
        text-align: right;
      }

      .more-indicator {
        color: var(--text-secondary);
        font-style: italic;
        justify-content: center;
      }

      .card-footer {
        border-top: 1px solid var(--border);
        padding-top: 12px;
      }

      .fork-btn {
        width: 100%;
        padding: 12px 16px;
        border: 1px solid var(--focus);
        border-radius: 4px;
        background: var(--focus);
        color: white;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
      }

      .fork-btn:hover {
        background: #0052a3;
        border-color: #0052a3;
        box-shadow: 0 2px 8px rgba(0, 102, 204, 0.2);
      }

      .fork-btn:active {
        background: #004080;
        border-color: #004080;
      }

      .btn-icon {
        font-size: 16px;
      }

      .carousel-indicators {
        display: flex;
        justify-content: center;
        gap: 8px;
      }

      .indicator {
        width: 8px;
        height: 8px;
        border: 1px solid var(--border);
        border-radius: 50%;
        background: transparent;
        cursor: pointer;
        transition: all 0.2s;
        padding: 0;
      }

      .indicator:hover {
        border-color: var(--focus);
      }

      .indicator.active {
        background: var(--focus);
        border-color: var(--focus);
      }

      @media (max-width: 768px) {
        .gallery-container {
          padding: 16px;
          gap: 16px;
        }

        .gallery-header h2 {
          font-size: 20px;
        }

        .carousel-inner {
          gap: 8px;
          min-height: auto;
        }

        .quest-card {
          padding: 16px;
          min-height: auto;
          gap: 12px;
        }

        .carousel-btn {
          width: 36px;
          height: 36px;
          font-size: 18px;
        }

        .quest-name {
          font-size: 18px;
        }

        .quest-description {
          font-size: 13px;
        }
      }

      @media (max-width: 480px) {
        .carousel-inner {
          flex-direction: column;
        }

        .carousel-btn {
          position: absolute;
          width: 32px;
          height: 32px;
          font-size: 16px;
          opacity: 0.7;
        }

        .carousel-btn-prev {
          bottom: 50%;
          left: 4px;
        }

        .carousel-btn-next {
          bottom: 50%;
          right: 4px;
        }

        .quest-card {
          width: 100%;
        }
      }
    `;
  }
}

customElements.define('examples-gallery', ExamplesGallery);
