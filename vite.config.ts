import { defineConfig } from 'vitest/config';

export default defineConfig({
  server: { host: '0.0.0.0' },
  build: { target: 'chrome80' },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: { include: ['src/game.ts', 'src/save.ts', 'src/orc-art.ts'], reporter: ['text', 'html'], thresholds: { lines: 80, functions: 80, branches: 80, statements: 80 } },
  },
});
