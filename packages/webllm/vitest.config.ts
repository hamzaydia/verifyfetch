import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    retry: 2,
    testTimeout: 60000,
    hookTimeout: 60000,
  },
  resolve: {
    alias: {
      // Resolve verifyfetch from workspace source for tests
      'verifyfetch': path.resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
