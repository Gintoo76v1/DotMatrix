import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['scripts/**/*.js'],
      exclude: [
        'scripts/main.js',
        'scripts/render-worker.js',
        'scripts/render-client.js',
        'scripts/ui/**',
        'scripts/lang.js',
        'scripts/settings-store.js',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70,
      },
    },
  },
});
