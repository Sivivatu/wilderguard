import { afterEach, expect, it, vi } from 'vitest';
import { request as httpRequest, type Server } from 'node:http';
import { approvedRelayCaller, createPrivateRelayServer } from '../server/gameanalytics-http';

const servers: Server[] = [];
afterEach(async () => { for (const server of servers.splice(0)) await new Promise<void>(resolve => server.close(() => resolve())); });
async function fixture(access = {}) {
  const handler = vi.fn(async (_request: Request) => new Response('{"accepted":true}'));
  const server = createPrivateRelayServer(handler, ['owner@example.test'], access);
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

it('authenticates an explicitly approved tagged node for preflight and uploads', async () => {
  const lookupNode = vi.fn(async () => 'nApprovedNode');
  const { handler, url } = await fixture({ allowedNodeIds: ['nApprovedNode'], lookupNode });
  const headers = { 'X-Forwarded-For': '100.64.0.10', 'X-Forwarded-Proto': 'https', Origin: 'https://localhost' };
  expect((await fetch(url, { method: 'OPTIONS', headers })).status).toBe(200);
  expect((await fetch(url, { method: 'POST', headers, body: '{}' })).status).toBe(200);
  expect(lookupNode).toHaveBeenCalledWith('100.64.0.10');
  expect([...handler.mock.calls[1][0].headers.keys()].sort()).toEqual(['content-type', 'origin', 'x-telemetry-epoch']);
});

it('never falls back from a rejected human identity and rejects ambiguous forwarded identities', async () => {
  const lookupNode = vi.fn(async () => 'nApprovedNode');
  const { handler, url } = await fixture({ allowedNodeIds: ['nApprovedNode'], lookupNode });
  const headers = { 'X-Forwarded-For': '100.64.0.10', 'X-Forwarded-Proto': 'https' };
  for (const invalid of [
    { ...headers, 'Tailscale-User-Login': 'other@example.test' },
    { ...headers, 'Tailscale-User-Login': '' },
    { ...headers, 'X-Forwarded-For': '192.0.2.123, 100.64.0.10' },
    { ...headers, 'X-Forwarded-For': 'host.example.test' },
    { ...headers, 'X-Forwarded-For': '100.64.0.10:443' },
    { ...headers, 'X-Forwarded-For': 'fe80::1%eth0' },
    { ...headers, 'X-Forwarded-Proto': 'http' },
    { ...headers, 'X-Forwarded-Proto': 'https, http' },
  ]) expect((await fetch(url, { method: 'OPTIONS', headers: invalid })).status).toBe(403);
  expect(lookupNode).not.toHaveBeenCalled();
  expect(handler).not.toHaveBeenCalled();
});

it('fails closed on unknown nodes and local identity lookup failure', async () => {
  for (const result of ['nUnapprovedNode', null]) {
    const { handler, url } = await fixture({ allowedNodeIds: ['nApprovedNode'], lookupNode: async () => result });
    expect((await fetch(url, { method: 'OPTIONS', headers: { 'X-Forwarded-For': '100.64.0.10', 'X-Forwarded-Proto': 'https' } })).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  }
  const { url } = await fixture({ allowedNodeIds: ['nApprovedNode'], lookupNode: async () => { throw Error('LocalAPI unavailable'); } });
  expect((await fetch(url, { method: 'OPTIONS', headers: { 'X-Forwarded-For': '100.64.0.10', 'X-Forwarded-Proto': 'https' } })).status).toBe(403);
});

it('does not trust identity headers from a non-loopback connection', async () => {
  expect(await approvedRelayCaller({ 'tailscale-user-login': 'owner@example.test' }, '192.0.2.123', ['owner@example.test'], {})).toBe(false);
  expect(await approvedRelayCaller({ 'x-forwarded-for': '100.64.0.10', 'x-forwarded-proto': 'https' }, undefined, ['owner@example.test'], { allowedNodeIds: ['nApprovedNode'], lookupNode: async () => 'nApprovedNode' })).toBe(false);
});
