import { createServer, type Server } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { createTailscaleNodeLookup } from '../server/tailscale-node-lookup';

const servers: Server[] = [];
const directories: string[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); }
  for (const directory of directories.splice(0)) rmSync(directory, { force: true, recursive: true });
});
async function fixture(body: string, status = 200) {
  const directory = mkdtempSync(join(tmpdir(), 'wilderguard-whois-')); directories.push(directory);
  const socketPath = join(directory, 'localapi.sock');
  const paths: string[] = [];
  const server = createServer((request, response) => {
    paths.push(request.url!);
    if (request.headers.host !== 'local-tailscaled.sock') { response.writeHead(403); response.end('invalid localapi request'); return; }
    response.writeHead(status); response.end(body);
  }); servers.push(server);
  await new Promise<void>(resolve => server.listen(socketPath, resolve));
  return { lookup: createTailscaleNodeLookup({ socketPath }), paths };
}
it('resolves only a stable node ID from the fixed local whois endpoint', async () => {
  const f = await fixture(JSON.stringify({ Node: { StableID: 'nApprovedNode', ID: 123 }, UserProfile: { LoginName: 'not-for-cloud@example.test' } }));
  expect(await f.lookup('100.64.0.10')).toBe('nApprovedNode');
  expect(f.paths).toEqual(['/localapi/v0/whois?addr=100.64.0.10']);
  expect(await f.lookup('https://untrusted.example')).toBeNull();
  expect(f.paths).toHaveLength(1);
});
it('fails closed on unexpected status, malformed or oversized responses, and missing stable identity', async () => {
  for (const [body, status] of [['{}', 403], ['broken', 200], ['x'.repeat(65537), 200], ['{"Node":{"ID":123}}', 200], ['{"Node":{"StableID":"*"}}', 200]] as const) {
    const f = await fixture(body, status);
    expect(await f.lookup('100.64.0.10')).toBeNull();
  }
  const lookup = createTailscaleNodeLookup({ socketPath: '/tmp/wilderguard-nonexistent-localapi.sock' });
  expect(await lookup('100.64.0.10')).toBeNull();
});

it('times out an unresponsive local identity service without throwing', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'wilderguard-whois-')); directories.push(directory);
  const socketPath = join(directory, 'localapi.sock');
  const server = createServer(() => {}); servers.push(server);
  await new Promise<void>(resolve => server.listen(socketPath, resolve));
  const lookup = createTailscaleNodeLookup({ socketPath, timeoutMs: 25 });
  expect(await lookup('100.64.0.10')).toBeNull();
});
