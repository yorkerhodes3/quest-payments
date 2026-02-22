import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['docs/builder/__tests__/**/*.test.js'],
    exclude: ['node_modules', 'dist'],
  },
});
