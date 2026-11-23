import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/e2e', fullyParallel: true, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4173', viewport: { width: 1440, height: 1080 }, headless: true, trace: 'retain-on-failure' },
  webServer: {
    command: 'npx vite build --outDir artifacts/gameplay-fixture && node scripts/archive-error-maps.mjs artifacts/gameplay-fixture && node scripts/build-offline.mjs artifacts/gameplay-fixture && npx vite preview --outDir artifacts/gameplay-fixture --port 4173 --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    env: {
      VITE_SENTRY_DSN: '',
      VITE_GAMEPLAY_CHANNEL: '',
      VITE_GAMEPLAY_BUILD: '',
      VITE_POSTHOG_TOKEN: '',
      VITE_POSTHOG_HOST: '',
      VITE_POSTHOG_EPOCH: '',
      VITE_POSTHOG_IP_DISCARD_CONFIRMED: '',
      VITE_GAMEANALYTICS_EPOCH: '',
      VITE_GAMEANALYTICS_RELAY: '',
    },
  },
});
