import { afterEach, expect, it, vi } from 'vitest';
import { request as httpRequest, type Server } from 'node:http';
import { createPrivateRelayServer } from '../server/gameanalytics-http';

const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await new Promise<void>(resolve => server.close(() => resolve())); });
async function fixture() {
  const handler = vi.fn(async (_request: Request) => new Response('{"accepted":true}'));
  const server = createPrivateRelayServer(handler, ['owner@example.test']);
  servers.push(server);
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address() as { port: number };
  return { handler, url: `http://127.0.0.1:${address.port}/telemetry` };
}
it('rejects unauthenticated and unapproved tailnet users before reading or forwarding reports', async () => {
  const { handler, url } = await fixture();
  expect((await fetch(url, { method: 'OPTIONS' })).status).toBe(403);
  expect((await fetch(url, { method: 'POST', headers: { 'Tailscale-User-Login': 'other@example.test' }, body: '{}' })).status).toBe(403);
  const stalled = await new Promise<number | undefined>((resolve, reject) => {
    const request = httpRequest(url, { method: 'POST', headers: { 'Content-Length': '8000' } }, response => { resolve(response.statusCode); response.resume(); request.destroy(); });
    request.on('error', reject);
    request.setTimeout(1500, () => { request.destroy(); reject(new Error('Unauthenticated body was buffered')); });
    request.write('{');
  });
  expect(stalled).toBe(403);
  expect(handler).not.toHaveBeenCalled();
});
it('passes only event transport headers and body, excluding ingress identity and IP headers', async () => {
  const { handler, url } = await fixture();
  const response = await fetch(url, { method: 'POST', headers: { 'Tailscale-User-Login': 'owner@example.test', Origin: 'https://localhost', 'X-Forwarded-For': '192.0.2.1', 'Content-Type': 'application/json', 'X-Telemetry-Epoch': 'beta-1' }, body: '{}' });
  expect(response.status).toBe(200);
  const request = handler.mock.calls[0][0];
  expect([...request.headers.keys()].sort()).toEqual(['content-type', 'origin', 'x-telemetry-epoch']);
  expect(await request.text()).toBe('{}');
});
it('enforces the HTTP body limit and keeps upstream errors generic', async () => {
  const { handler, url } = await fixture();
  const headers = { 'Tailscale-User-Login': 'owner@example.test' };
  expect((await fetch(url, { method: 'POST', headers, body: 'x'.repeat(8193) })).status).toBe(413);
  expect(handler).not.toHaveBeenCalled();
  handler.mockRejectedValueOnce(new Error('private secret details'));
  const failed = await fetch(url, { method: 'POST', headers, body: '{}' });
  expect(failed.status).toBe(503);
  expect(await failed.text()).not.toContain('secret');
});
it('requires an explicit bounded tester allowlist', () => {
  expect(() => createPrivateRelayServer(async () => new Response(), [])).toThrow();
  expect(() => createPrivateRelayServer(async () => new Response(), ['*'])).toThrow();
});
