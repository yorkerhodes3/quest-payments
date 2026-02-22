# Quest Builder

Interactive web-based wizard for configuring quest/incentive campaigns for event ticketing. No build step required—runs natively in the browser via ES modules.

## Features

- **Fork Demo Quests**: Browse 5 hardcoded example configurations and fork them as starting points
- **Configure Incentives**: Add/remove/edit incentive types, discount percentages, descriptions
- **Live Preview**: Syntax-highlighted JSON and TypeScript preview that updates in real-time
- **Export Options**: Copy to clipboard or download as JSON or TypeScript code
- **Auto-save**: Drafts automatically persist to browser localStorage
- **Undo/Redo**: Full undo/redo history with up to 20 snapshots
- **Responsive Design**: Works on desktop, tablet, and mobile
- **Accessibility**: Keyboard navigation, ARIA labels, semantic HTML

## Architecture

### Component Hierarchy

```
<quest-builder> (main form)
├── Quiz name, description, expiration, metadata
├── Incentive list (repeatable items)
├── Undo/Redo/Clear buttons
└── emits → state-changed CustomEvent

<examples-gallery> (demo carousel)
├── Browse 5 hardcoded demo quests
├── Preview card per quest
└── emits → fork-quest CustomEvent

<config-viewer> (live preview)
├── JSON view
├── TypeScript view
└── listens → state-changed CustomEvent

<export-dialog> (export controls)
├── Copy/Download JSON buttons
├── Copy/Download TypeScript buttons
└── listens → state-changed CustomEvent
```

### State Management

**StateManager** (`utils/state-manager.js`):
- Lightweight event-based state container
- Subscriber pattern: `subscribe(callback)` → called on every state change
- History-based undo/redo (up to 20 snapshots)
- Deep copy state to prevent external mutations

**DraftStorage** (`utils/storage.js`):
- Wraps browser localStorage
- Auto-saves state on every change
- Graceful error handling for quota exceeded
- Keeps last 10 snapshots for recovery

**Communication**: CustomEvents dispatched by components (no manual wiring required)

```javascript
// quest-builder emits on every state change
this.dispatchEvent(new CustomEvent('state-changed', {
  detail: state,
  bubbles: true,
  composed: true,
}));

// examples-gallery emits when fork button clicked
this.dispatchEvent(new CustomEvent('fork-quest', {
  detail: demoQuest,
  bubbles: true,
  composed: true,
}));

// config-viewer, export-dialog, and app.js listen
document.addEventListener('state-changed', e => { /* ... */ });
gallery.addEventListener('fork-quest', e => { /* ... */ });
```

### Data Model

Quest configuration structure:

```javascript
{
  questId: "abc123",                    // Unique ID
  questName: "TechConf 2025",           // User-editable name
  description: "...",                   // Quest description
  expiresAt: "2025-06-30T23:59:59Z",   // ISO 8601 timestamp
  metadata: {
    organizerName: "TechConf Team",     // Event organizer
    eventUrl: "https://example.com",    // Event website
  },
  incentives: [                         // Array of incentive rewards
    {
      id: "inc-1",                      // Unique per incentive
      type: "social_share",             // Enum: social_share|referral|check_in|sponsor_session|feedback|manual
      discountBps: 500,                 // Basis points (1-10000, e.g. 500 = 5%)
      description: "Share on Twitter",  // What user must do
      expiresAt: "2025-06-30T23:59:59Z" // When expires
    },
    // ... more incentives
  ]
}
```

**Incentive Types** (hardcoded in `data/incentive-types.js`):
- `social_share`: Share event on social media (5% default)
- `referral`: Refer a friend (10% default)
- `check_in`: Attend event and check in (5% default)
- `sponsor_session`: Attend sponsor/partner session (3% default)
- `feedback`: Complete post-event survey (2% default)
- `manual`: Custom action with manual verification (5% default)

### Export Formats

**JSON Export** (API-compatible):
```json
{
  "version": "1.0",
  "quest": {
    "id": "...",
    "name": "TechConf 2025",
    "description": "...",
    "expiresAt": "2025-06-30T23:59:59Z",
    "metadata": { ... },
    "incentives": [ ... ]
  }
}
```

**TypeScript Export** (ready-to-import):
```typescript
import { incentiveId, QuestEvent } from '@quest-payments/models';

export const techconf2025Incentives: IncentiveDefinition[] = [
  {
    id: incentiveId('...'),
    type: 'social_share',
    discountBps: 500,
    description: 'Share on Twitter',
    expiresAt: new Date('2025-06-30T23:59:59Z'),
  },
  // ...
];

export const techconf2025Event: QuestEvent = {
  // Full event definition with incentives
};
```

Code generation: `utils/export-codegen.js`:
- `generateJsonExport(state)` → JSON string
- `generateTypescriptExport(state)` → TypeScript code
- `highlightJson()`, `highlightTypescript()` → CSS-based syntax highlighting
- `copyToClipboard()`, `downloadFile()` → Export helper functions

## File Structure

```
docs/builder/
├── index.html                  (Main page shell, styling, layout)
├── app.js                      (Entry point, component initialization)
├── styles.css                  (Shared utilities and responsive typography)
│
├── components/
│   ├── quest-builder.js        (Main form component)
│   ├── examples-gallery.js     (Demo quest carousel)
│   ├── config-viewer.js        (JSON/TS preview panel)
│   └── export-dialog.js        (Export control panel)
│
├── data/
│   ├── demo-quests.js          (5 hardcoded example quests)
│   ├── incentive-types.js      (6 incentive type definitions)
│   └── schemas.js              (Validation schemas)
│
├── utils/
│   ├── state-manager.js        (Event-based state container with undo/redo)
│   ├── export-codegen.js       (JSON/TS code generation)
│   ├── validation.js           (Form field validation)
│   └── storage.js              (localStorage persistence)
│
└── __tests__/                  (Tests, created in Sprint 4)
    ├── state-manager.test.js
    ├── export-codegen.test.js
    ├── validation.test.js
    └── e2e.test.js
```

## Local Development

```bash
# Run local HTTP server (Python)
python -m http.server 8000 --directory docs

# Or Node.js
npx http-server docs

# Visit http://localhost:8000/builder/
```

No build step required. All ES modules load directly in the browser.

## Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

Uses modern browser features:
- ES2022 modules
- Shadow DOM (Web Components)
- Crypto.getRandomValues() optional
- localStorage (fallback to memory if unavailable)
- navigator.clipboard (with fallback to document.execCommand)

## Accessibility (WCAG 2.1 AA)

- **Keyboard Navigation**: Tab through all form inputs and buttons
- **Focus Indicators**: Visible outline on interactive elements
- **Form Labels**: Associated with input IDs using `<label for="id">`
- **ARIA Labels**: Buttons have descriptive aria-labels
- **Semantic HTML**: Proper heading hierarchy, button elements
- **Color Contrast**: 4.5:1 minimum for text
- **Error Messages**: Associated with form fields via aria-describedby
- **Responsive Text**: Larger font on mobile (16px prevents iOS zoom)

## Mobile Responsiveness

**Breakpoints**:
- Desktop: 3-column grid (form | preview | export)
- Tablet (≤1200px): 2-column grid
- Mobile (≤768px): 1-column stack
  - Gallery above builder
  - Form, preview, export stack vertically
  - Buttons resize for touch targets (44px min)
  - Font sizes increase slightly for readability

## Future Enhancements

### Phase 2: Backend Integration
- Swap localStorage → API calls to `/api/quests`
- Add OAuth login (Google, GitHub)
- Fetch demo quests from backend
- Persist user-created quests to database

### Phase 3: Advanced Features
- Multi-tier discount logic
- Conditional incentives (A/B testing)
- Analytics dashboard
- Webhook integrations for real-time verification

## Performance

- **Bundle Size**: ~40KB uncompressed (CSS + JS combined)
- **Load Time**: <1s on typical broadband
- **Interactions**: Instant (no server latency for MVP)
- **Export Generation**: <100ms for typical config

## Testing

Unit tests created in Sprint 4:
```bash
npm run test
```

E2E tests with Playwright:
```bash
npm run test:e2e
```

## Contributing

Add new incentive types in `data/incentive-types.js`:
1. Add type definition
2. Update `INCENTIVE_TYPES` object
3. Update export code generation if needed
4. Add test cases

Add new demo quests in `data/demo-quests.js`:
1. Add to `DEMO_QUESTS` array
2. Use `generateId()` and `futureDate()` helpers
3. Include 3-5 diverse incentive types

## Licensing

MIT. Free to fork, customize, and integrate into other systems.
