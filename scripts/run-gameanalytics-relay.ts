import { createHash } from 'node:crypto';
import { createGameAnalyticsRelay } from '../server/gameanalytics-relay.ts';
import { createPrivateRelayServer } from '../server/gameanalytics-http.ts';
import { openRelayState } from '../server/gameanalytics-state.ts';
import { createTailscaleNodeLookup } from '../server/tailscale-node-lookup.ts';

function main(): void {
  const port = Number(process.env.GA_RELAY_PORT ?? '8787');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid relay port');
  const config = {
    gameKey: process.env.GA_GAME_KEY ?? '', secret: process.env.GA_GAME_SECRET ?? '', epoch: process.env.GA_PROJECT_EPOCH ?? '',
    origins: (process.env.GA_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    privacyReviewed: process.env.GA_PRIVACY_REVIEWED === 'true', privateDeployment: process.env.GA_PRIVATE_RELAY_CONFIRMED === 'true',
    environment: process.env.GA_ENVIRONMENT === 'production' ? 'production' as const : 'sandbox' as const,
  };
  const scope = createHash('sha256').update(JSON.stringify([config.gameKey, config.secret, config.epoch, config.environment])).digest('hex');
  if (!process.env.GA_STATE_PATH) throw new Error('Persistent state path required');
  const state = openRelayState(process.env.GA_STATE_PATH, scope);
  try {
    const handler = createGameAnalyticsRelay(config, { state });
    if (!handler.maintain()) throw new Error('Relay state unavailable');
    const server = createPrivateRelayServer(handler, (process.env.GA_ALLOWED_TAILSCALE_USERS ?? '').split(',').filter(Boolean), {
      allowedNodeIds: (process.env.GA_ALLOWED_TAILSCALE_NODE_IDS ?? '').split(',').filter(Boolean),
      lookupNode: createTailscaleNodeLookup(),
    });
    const maintenance = setInterval(() => { if (!handler.maintain()) { server.close(); process.exitCode = 1; } }, 60000);
    maintenance.unref();
    server.on('close', () => { clearInterval(maintenance); state.close(); });
    server.on('error', () => { process.stderr.write('Relay listener unavailable.\n'); state.close(); process.exitCode = 1; });
    const stop = () => { server.close(); };
    process.once('SIGTERM', stop); process.once('SIGINT', stop);
    server.listen(port, '127.0.0.1', () => process.stdout.write('Private telemetry relay listening on loopback.\n'));
  } catch (error) { state.close(); throw error; }
}
try { main(); } catch { process.stderr.write('Relay configuration or persistent state is unavailable.\n'); process.exitCode = 1; }
