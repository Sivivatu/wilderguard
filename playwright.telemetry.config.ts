import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/telemetry-e2e',
  outputDir: 'artifacts/telemetry-test-results',
  workers: 1,
  timeout: 60000,
  use: {
    baseURL: 'http://127.0.0.1:4175',
    viewport: { width: 1440, height: 1080 },
    headless: true,
  },
  webServer: {
    command: 'npx vite preview --outDir artifacts/telemetry-fixture --port 4175 --host 127.0.0.1',
    url: 'http://127.0.0.1:4175',
    reuseExistingServer: false,
    timeout: 10000,
  },
});
