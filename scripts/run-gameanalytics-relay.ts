// Source-only local relay runner. Deployment, public ingress and accounts are separate work.
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { createGameAnalyticsRelay } from '../server/gameanalytics-relay.ts';
const MAX_BODY_BYTES = 8192;
function main(): void {
  const port = Number(process.env.GA_RELAY_PORT ?? '8787');
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid relay port');
  const handler = createGameAnalyticsRelay({
    gameKey: process.env.GA_GAME_KEY ?? '', secret: process.env.GA_GAME_SECRET ?? '', epoch: process.env.GA_PROJECT_EPOCH ?? '',
    origins: (process.env.GA_ALLOWED_ORIGINS ?? '').split(',').filter(Boolean),
    privacyReviewed: process.env.GA_PRIVACY_REVIEWED === 'true', privateDeployment: process.env.GA_PRIVATE_RELAY_CONFIRMED === 'true',
    environment: process.env.GA_ENVIRONMENT === 'production' ? 'production' : 'sandbox',
  });
  async function handleRequest(incoming: IncomingMessage, outgoing: ServerResponse): Promise<void> {
    let body = Buffer.alloc(0);
    for await (const chunk of incoming) {
      const next = Buffer.from(chunk);
      if (body.length + next.length > MAX_BODY_BYTES) { outgoing.writeHead(413); outgoing.end(); return; }
      body = Buffer.concat([body, next]);
    }
    const method = incoming.method ?? 'GET';
    const request = new Request(`http://127.0.0.1:${port}${incoming.url ?? '/'}`, { method,
      headers: { Origin: incoming.headers.origin ?? '', 'Content-Type': String(incoming.headers['content-type'] ?? ''), 'X-Telemetry-Epoch': String(incoming.headers['x-telemetry-epoch'] ?? '') },
      ...(['POST', 'PUT', 'PATCH'].includes(method) ? { body } : {}),
    });
    const response = await handler(request);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers.entries())); outgoing.end(await response.text());
  }
  const server = createServer((incoming, outgoing) => { void handleRequest(incoming, outgoing).catch(() => { outgoing.writeHead(503); outgoing.end(); }); });
  server.requestTimeout = 10000; server.headersTimeout = 10000; server.maxConnections = 8;
  server.on('error', () => { process.stderr.write('Relay listener unavailable.\n'); process.exitCode = 1; });
  server.listen(port, '127.0.0.1', () => process.stdout.write('Private telemetry relay listening on loopback.\n'));
}
try { main(); } catch { process.stderr.write('Relay configuration is incomplete or invalid.\n'); process.exitCode = 1; }
