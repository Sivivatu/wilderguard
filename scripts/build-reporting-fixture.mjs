import { spawnSync } from 'node:child_process';
const output = 'artifacts/reporting-fixture';
const env = {
  ...process.env,
  VITE_SENTRY_DSN: 'https://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa@o123.ingest.de.sentry.io/456',
  VITE_SENTRY_ENVIRONMENT: 'beta',
  VITE_SENTRY_RELEASE: 'com.wilderguard.game.beta@0.1.0-beta.8+8',
  VITE_SENTRY_DIST: '8',
};
for (const [command, args] of [
  ['node_modules/.bin/vite', ['build', '--outDir', output]],
  ['node', ['scripts/archive-error-maps.mjs', output]],
  ['node', ['scripts/build-offline.mjs', output]],
]) {
  const result = spawnSync(command, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
