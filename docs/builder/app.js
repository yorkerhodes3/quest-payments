/**
 * Main entry point for the quest builder application.
 * Wire up components and initialize the app.
 */

import { QuestBuilder } from './components/quest-builder.js';
import { ConfigViewer } from './components/config-viewer.js';
import { ExportDialog } from './components/export-dialog.js';

/**
 * Initialize the builder app.
 */
function init() {
  const app = document.getElementById('app');
  if (!app) {
    console.error('Cannot find #app element');
    return;
  }

  // The <quest-builder> component will auto-initialize when connected to the DOM
  const builder = document.querySelector('quest-builder');

  if (builder) {
    // Log state changes for debugging (remove in production)
    builder.addEventListener('state-changed', e => {
      console.log('State updated:', e.detail);
    });
  }

  console.log('Quest builder initialized');
}

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

export { QuestBuilder, ConfigViewer, ExportDialog };

