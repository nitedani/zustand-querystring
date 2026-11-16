import { defineConfig } from 'vitest/config';
import { playwright } from '@vitest/browser-playwright';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    coverage: {
      include: ['src/**'],
      reporter: ['text', 'json-summary'],
    },
    projects: [
      {
        test: {
          name: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.browser.test.tsx'],
          environment: 'node',
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'browser',
          include: ['src/**/*.browser.test.tsx'],
          browser: {
            enabled: true,
            // The installed Google Chrome, so no browser download is needed.
            provider: playwright({ launchOptions: { channel: 'chrome' } }),
            headless: true,
            instances: [{ browser: 'chromium' }],
          },
        },
      },
    ],
  },
});
