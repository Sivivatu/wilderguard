import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { host: '0.0.0.0' },
  build: { target: 'chrome80', sourcemap: 'hidden', rollupOptions: { output: { sourcemapExcludeSources: true } } },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: { include: ['src/telemetry*.ts', 'src/gameplay-telemetry.ts', 'src/posthog-telemetry.ts', 'src/gameanalytics-telemetry.ts', 'server/*.ts', 'src/startup-errors.ts', 'src/error-policy.ts', 'src/error-reporting.ts', 'src/sentry-client.ts', 'src/reporting-storage.ts', 'src/game.ts', 'src/save.ts', 'src/orc-art.ts', 'src/terrain-art.ts', 'src/soldiers.ts', 'src/region-geometry.ts', 'src/tower-combat.ts', 'src/fullscreen.ts'], reporter: ['text', 'html'], thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 } },
  },
});
