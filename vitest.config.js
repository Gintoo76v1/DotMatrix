import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['js/**/*.js'],
      exclude: [
        'js/main.js',
        'js/render-worker.js',
        'js/render-client.js',
        'js/ui/**',
        'js/lang.js',
        'js/settings-store.js',
        'js/render-client.js'
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 65,
        statements: 70
      }
    }
  }
});
