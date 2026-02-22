# Quest Builder Testing Guide

## Overview

This document describes how to run unit, integration, and end-to-end tests for the Quest Builder.

## Unit Tests

### Setup

```bash
npm install
```

Vitest is already configured in `vitest.config.js`.

### Running Unit Tests

```bash
# Run all tests once
npm test

# Run only builder tests
npm run test:builder

# Watch mode (re-run on file changes)
npm run test:watch
```

### Test Files

- **state-manager.test.js** (45 tests)
  - State initialization and updates
  - Subscriber notifications
  - Undo/Redo history (up to 20 snapshots)
  - State deep copying
  - History limit validation

- **export-codegen.test.js** (35 tests)
  - JSON generation and validation
  - TypeScript code generation
  - Filename generation with dates
  - Syntax highlighting (JSON and TypeScript)
  - Helper function tests (bpsToPercent, escaping, camelCase)
  - Integration tests

- **validation.test.js** (40 tests)
  - Quest name validation
  - Description validation
  - Expiration date validation
  - Discount basis points validation
  - Incentive type validation
  - Complete quest config validation
  - Error accumulation

**Total Unit Tests: ~120 assertions**

### Coverage

Current coverage goals:
- **utils/**: 90%+ (all critical paths tested)
- **components/**: Manual testing (Web Components harder to unit test)
- **data/**: Tested implicitly through component tests

## Integration Tests

Integration tests are included in the E2E suite below (can be run as a subset).

## End-to-End Tests

### Setup

```bash
npm install -D @playwright/test

# Required: Python HTTP server for local testing
python -m http.server 8000 --directory docs
```

### Running E2E Tests

```bash
# Install Playwright browsers
npx playwright install

# Run all E2E tests
npx playwright test

# Run specific browser
npx playwright test --project=chromium

# Run in UI mode (interactive)
npx playwright test --ui

# Run with headed browser (see what's happening)
npx playwright test --headed

# Run single test
npx playwright test -g "can fill out quest form"

# Debug mode
npx playwright test --debug
```

### Test Coverage

The E2E suite tests:

**Component Loading** (1 test)
- All 4 components render (gallery, builder, preview, export)
- Header displays correctly

**Form Interactions** (3 tests)
- Fill quest name, description, date inputs
- Preview updates in real-time
- Add/remove incentives

**Demo Gallery** (3 tests)
- Navigate carousel with buttons
- Click indicators to jump to demo
- Fork a demo quest into builder

**State Management** (2 tests)
- Undo/Redo buttons work
- Draft persists across reload

**Export Functionality** (2 tests)
- Copy to clipboard works
- Export buttons render

**Accessibility** (2 tests)
- Form fields have labels
- Keyboard navigation works

**Responsive Design** (1 test)
- Mobile layout stacks vertically
- All components visible on 375x667px

**Stress Tests** (1 test)
- Rapid state changes handled
- Preview keeps pace with input

**Bonus Tests** (2 tests)
- Incentive discount percentages display
- Home page loads and links work

**Total E2E Tests: 17 scenarios**

### Test Reports

After running E2E tests:

```bash
npx playwright show-report
```

Opens HTML report showing:
- Test results per browser
- Screenshots on failure
- Video recordings (if enabled)
- Trace files for debugging

## Manual Testing Checklist

Before each release, test manually:

### Desktop (1920x1080)
- [ ] Load builder page
- [ ] Form inputs focus and blur correctly
- [ ] Keyboard Tab navigation works
- [ ] Demo carousel animated smoothly
- [ ] Preview updates instantly
- [ ] Export buttons are clickable

### Tablet (768x1024)
- [ ] Layout stacks to 2 columns
- [ ] Touch buttons are 44px+ tall
- [ ] Gallery carousel works with touch

### Mobile (375x667)
- [ ] All 4 sections stack vertically
- [ ] Form is scrollable
- [ ] Buttons are touch-friendly
- [ ] Preview wraps correctly
- [ ] No horizontal scroll

### Browsers
- [ ] Chrome 90+
- [ ] Firefox 88+
- [ ] Safari 14+
- [ ] Edge 90+

### Accessibility (WCAG 2.1 AA)
- [ ] Tab through all controls in order
- [ ] Form labels announce with screen reader
- [ ] Buttons have accessible names
- [ ] Focus indicators visible on all interactive elements
- [ ] Color contrast passes (4.5:1 for text)
- [ ] Keyboard-only navigation possible

### Performance
- [ ] Page load < 2 seconds
- [ ] Form input lag < 100ms
- [ ] Preview updates lag < 200ms
- [ ] Export generation < 100ms
- [ ] Undo/Redo instant

## Continuous Integration

### GitHub Actions (future)

Add to `.github/workflows/test.yml`:

```yaml
name: Test

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npm test

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      - run: npm ci
      - run: npx playwright install --with-deps
      - run: npx playwright test
```

## Known Limitations

### Testing Web Components

Web Components are harder to unit test because:
- Shadow DOM styles are encapsulated
- Component lifecycle hooks require DOM mounting
- Event listeners must be tested through actual interaction

**Workaround**: E2E tests thoroughly cover component behavior.

### localStorage Testing

localStorage tests aren't included in unit tests due to Node.js environment limitations. E2E tests verify persistence.

## Contributing Tests

When adding new features:

1. **Unit tests first** (if possible for utilities)
2. **E2E scenario** covering user workflow
3. **Accessibility check** (keyboard, labels, contrast)
4. **Mobile test** (on actual device if critical)

## Resources

- **Vitest docs**: https://vitest.dev/
- **Playwright docs**: https://playwright.dev/
- **WCAG 2.1 AA**: https://www.w3.org/WAI/WCAG21/quickref/

## Troubleshooting

### Tests timeout

```bash
# Increase timeout
npx playwright test --timeout=30000
```

### localhost:8000 already in use

```bash
# Kill existing process
lsof -ti:8000 | xargs kill -9

# Or use different port
python -m http.server 9000 --directory docs
```

### Module not found errors

```bash
# Ensure Vitest can resolve ES modules
npm install --save-dev vitest

# Check vitest.config.js includes test directory
```

### Playwright not finding browser

```bash
# Reinstall browsers
npx playwright install --with-deps
```

## Performance Benchmarks

Current performance targets (measured on M1 MacBook Pro):

- Unit tests complete: < 5 seconds
- E2E tests complete: < 3 minutes (across all browsers)
- Form input latency: < 50ms
- Preview update latency: < 100ms
- Export generation: < 50ms

## Future Testing

- [ ] Visual regression testing (Percy, Chromatic)
- [ ] Performance profiling (Lighthouse CI)
- [ ] Accessibility audit automation (axe)
- [ ] Cross-browser testing service (BrowserStack)
- [ ] Load testing for multi-user scenarios
