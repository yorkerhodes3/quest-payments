/**
 * Main entry point for the quest builder application.
 * Wire up components and initialize the app.
 */

import { QuestBuilder } from './components/quest-builder.js';
import { ConfigViewer } from './components/config-viewer.js';
import { ExportDialog } from './components/export-dialog.js';
import { ExamplesGallery } from './components/examples-gallery.js';

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

  // Listen for fork-quest event from gallery
  const gallery = document.querySelector('examples-gallery');
  if (gallery && builder) {
    gallery.addEventListener('fork-quest', e => {
      builder.forkQuest(e.detail);
      console.log('Forked quest:', e.detail.name);
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

export { QuestBuilder, ConfigViewer, ExportDialog, ExamplesGallery };

