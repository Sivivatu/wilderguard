import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { afterEach, expect, it, vi } from 'vitest';
import { openRelayState, type RelaySnapshot } from '../server/gameanalytics-state';
import { createGameAnalyticsRelay } from '../server/gameanalytics-relay';
import { startEvent } from './telemetry-fixture';

const directories: string[] = [];
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }); });

function fixture() {
  const directory = mkdtempSync(join(tmpdir(), 'wilderguard-ga-state-'));
  directories.push(directory);
  return { directory, path: join(directory, 'relay.sqlite') };
}

function snapshot(): RelaySnapshot {
  return {
    seen: [['event-id-hash', { digest: 'event-digest', at: 1_795_200_000_000, status: 503 }]],
    runs: [['ephemeral-run-hash', { count: 18, at: 1_795_200_000_000, started: true }]],
    minute: 29_920_000,
    requests: 12,
    day: 20_777,
    dailyEvents: 30,
  };
}

it('persists only bounded relay reservations and quotas across process restarts', () => {
  const { path } = fixture();
  const first = openRelayState(path, 'wilderguard-beta-v1');
  expect(first.load()).toBeNull();
  first.save(snapshot());
  first.close();

  const reopened = openRelayState(path, 'wilderguard-beta-v1');
  expect(reopened.load()).toEqual(snapshot());
  reopened.close();

  const stored = readFileSync(path, 'utf8');
  expect(stored).not.toMatch(/game_secret|player name|wave replay|full event payload/i);
  expect(stored).not.toContain('wave_start');
  expect(statSync(path).mode & 0o077).toBe(0);
});

it('keeps relay state isolated by project epoch', () => {
  const { path } = fixture();
  const original = openRelayState(path, 'beta-project-one');
  original.save(snapshot());
  original.close();

  expect(() => openRelayState(path, 'beta-project-two')).toThrow();
});

it('rejects unbounded collections, unsafe counters and malformed reservation entries', () => {
  const { path } = fixture();
  const state = openRelayState(path, 'beta-project-one');
  expect(() => state.save({ ...snapshot(), seen: Array.from({ length: 513 }, (_, i) => [`id-${i}`, { digest: 'hash', at: 1, status: 503 }]) as RelaySnapshot['seen'] })).toThrow();
  expect(() => state.save({ ...snapshot(), runs: Array.from({ length: 129 }, (_, i) => [`run-${i}`, { count: 1, at: 1, started: false }]) as RelaySnapshot['runs'] })).toThrow();
  expect(() => state.save({ ...snapshot(), requests: -1 })).toThrow();
  expect(() => state.save({ ...snapshot(), dailyEvents: Number.MAX_SAFE_INTEGER + 1 })).toThrow();
  expect(() => state.save({ ...snapshot(), seen: [['', { digest: 'hash', at: 1, status: 503 }]] })).toThrow();
  expect(() => state.save({ ...snapshot(), runs: [['run', { count: -1, at: 1, started: true }]] })).toThrow();
  state.close();
});

it('fails closed when the on-disk database is corrupt or has an incompatible schema', () => {
  const { path } = fixture();
  writeFileSync(path, 'not a sqlite database');
  expect(() => openRelayState(path, 'beta-project-one')).toThrow();
  const other = fixture();
  const db = new DatabaseSync(other.path);
  db.exec('PRAGMA user_version = 99');
  db.close();
  expect(() => openRelayState(other.path, 'beta-project-one')).toThrow();
});

const config = { gameKey: '0'.repeat(32), secret: '1'.repeat(40), epoch: 'family-1', origins: ['https://localhost'], privacyReviewed: true, privateDeployment: true, environment: 'sandbox' as const };
const request = () => new Request('https://private.example.test/telemetry', { method: 'POST', headers: { Origin: 'https://localhost', 'Content-Type': 'application/json', 'X-Telemetry-Epoch': 'family-1' }, body: JSON.stringify(startEvent) });

it('does not resend an acknowledged event after closing and reopening the real relay state', async () => {
  const { path } = fixture();
  const fetcher = vi.fn<typeof fetch>(async url => new Response(String(url).endsWith('/init') ? '{"server_ts":1795200000,"enabled":true}' : '{}'));
  const firstState = openRelayState(path, 'same-project');
  const relay = createGameAnalyticsRelay(config, { state: firstState, fetcher, now: () => startEvent.at });
  expect((await relay(request())).status).toBe(200);
  firstState.close();
  const secondState = openRelayState(path, 'same-project');
  const restarted = createGameAnalyticsRelay(config, { state: secondState, fetcher, now: () => startEvent.at });
  expect((await restarted(request())).status).toBe(200);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(secondState.load()?.dailyEvents).toBe(2);
  secondState.close();
});

it('preserves exhausted daily quota over restart and retries after UTC rollover', async () => {
  const { path } = fixture();
  let time = startEvent.at;
  const state = openRelayState(path, 'same-project');
  state.save({ seen: [], runs: [], minute: Math.floor(time / 60000), requests: 0, day: Math.floor(time / 86400000), dailyEvents: 2000 });
  state.close();
  const reopened = openRelayState(path, 'same-project');
  const fetcher = vi.fn<typeof fetch>(async url => new Response(String(url).endsWith('/init') ? '{"server_ts":1795200000,"enabled":true}' : '{}'));
  const relay = createGameAnalyticsRelay(config, { state: reopened, fetcher, now: () => time });
  expect((await relay(request())).status).toBe(429);
  expect(fetcher).not.toHaveBeenCalled();
  time += 86400000;
  expect((await relay(request())).status).toBe(200);
  reopened.close();
});

it('fails closed before forwarding when reservations cannot be saved', async () => {
  const fetcher = vi.fn<typeof fetch>();
  const state = { load: () => null, save: () => { throw new Error('disk failure'); }, close: () => {} };
  const relay = createGameAnalyticsRelay(config, { state, fetcher, now: () => startEvent.at });
  expect((await relay(request())).status).toBe(503);
  expect(fetcher).not.toHaveBeenCalled();
  expect((await relay(request())).status).toBe(503);
});

it('removes expired correlation IDs on startup and during idle maintenance', () => {
  const { path } = fixture();
  let time = startEvent.at;
  const state = openRelayState(path, 'same-project');
  const old = time - 49 * 60 * 60 * 1000;
  state.save({ ...snapshot(), seen: [['old-id', { digest: 'digest', at: old, status: 200 }]], runs: [['old-run', { count: 1, at: old, started: true }]] });
  const relay = createGameAnalyticsRelay(config, { state, now: () => time });
  expect(state.load()?.seen).toEqual([]);
  expect(state.load()?.runs).toEqual([]);
  state.close();
  const activeState = openRelayState(path, 'same-project');
  activeState.save({ ...snapshot(), seen: [['recent-id', { digest: 'digest', at: time, status: 200 }]], runs: [['recent-run', { count: 1, at: time, started: true }]], minute: -1, day: -1 });
  const idle = createGameAnalyticsRelay(config, { state: activeState, now: () => time });
  expect(activeState.load()?.seen).toHaveLength(1);
  time += 49 * 60 * 60 * 1000;
  expect(idle.maintain()).toBe(true);
  expect(activeState.load()?.seen).toEqual([]);
  expect(activeState.load()?.runs).toEqual([]);
  activeState.close();
});
