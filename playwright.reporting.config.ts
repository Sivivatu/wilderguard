import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/reporting-e2e', outputDir: 'artifacts/reporting-test-results', workers: 1, timeout: 30000,
  use: { baseURL: 'http://127.0.0.1:4174', viewport: { width: 1440, height: 1080 }, headless: true },
  webServer: { command: 'npx vite preview --outDir artifacts/reporting-fixture --port 4174 --host 127.0.0.1', url: 'http://127.0.0.1:4174', reuseExistingServer: false },
});
