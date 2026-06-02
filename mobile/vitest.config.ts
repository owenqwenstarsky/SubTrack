import { defineConfig } from 'vitest/config';
import path from 'node:path';

process.env.TZ = 'UTC';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/vitest.setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text'],
      include: ['src/lib/**/*.{ts,tsx}', 'src/forms/subscriptionFormHelpers.ts'],
      exclude: ['src/lib/types.ts'],
    },
  },
});
