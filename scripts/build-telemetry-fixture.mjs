import { spawnSync } from 'node:child_process';

const output = 'artifacts/telemetry-fixture';
const env = {
  ...process.env,
  VITE_GAMEPLAY_CHANNEL: 'beta',
  VITE_GAMEPLAY_BUILD: 'beta-test',
  VITE_POSTHOG_HOST: 'https://eu.i.posthog.com',
  VITE_POSTHOG_TOKEN: 'phc_testproject000000000000000000',
  VITE_POSTHOG_EPOCH: 'family-beta-1',
  VITE_POSTHOG_IP_DISCARD_CONFIRMED: 'true',
  VITE_GAMEANALYTICS_RELAY: 'https://private.example.test/telemetry',
  VITE_GAMEANALYTICS_EPOCH: 'family-1',
  VITE_SENTRY_DSN: '',
  VITE_SENTRY_ENVIRONMENT: '',
  VITE_SENTRY_RELEASE: '',
  VITE_SENTRY_DIST: '',
};

for (const [command, args] of [
  ['node_modules/.bin/vite', ['build', '--outDir', output]],
  ['node', ['scripts/archive-error-maps.mjs', output]],
  ['node', ['scripts/build-offline.mjs', output]],
]) {
  const result = spawnSync(command, args, { env, stdio: 'inherit' });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
