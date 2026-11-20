import { chmodSync, closeSync, constants, lstatSync, openSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { z } from 'zod';

const counter = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER);
const label = z.string().min(1).max(128);
const snapshotSchema = z.object({
  seen: z.array(z.tuple([label, z.object({ digest: label, at: counter, status: z.union([z.literal(200), z.literal(422), z.literal(503)]) }).strict()])).max(512),
  runs: z.array(z.tuple([label, z.object({ count: counter.max(480), at: counter, started: z.boolean() }).strict()])).max(128),
  minute: z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER), requests: counter.max(121), day: z.number().int().min(-1).max(Number.MAX_SAFE_INTEGER), dailyEvents: counter.max(2000),
}).strict();
export type RelaySnapshot = z.infer<typeof snapshotSchema>;
export interface RelayStateStore { load(): RelaySnapshot | null; save(snapshot: RelaySnapshot): void; close(): void }

/** One bounded, strict snapshot: quota counters and ephemeral dedup IDs, never event payloads. */
export function openRelayState(path: string, scope: string): RelayStateStore {
  if (!scope || scope.length > 1024) throw new Error('Invalid relay state scope');
  const parent = lstatSync(dirname(path));
  if (!parent.isDirectory() || (parent.mode & 0o077) !== 0) throw new Error('Relay state directory must be private');
  const fd = openSync(path, constants.O_CREAT | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  closeSync(fd);
  const file = lstatSync(path);
  if (!file.isFile() || file.nlink !== 1) throw new Error('Invalid relay state file');
  chmodSync(path, 0o600);
  const db = new DatabaseSync(path);
  try {
    const version = db.prepare('PRAGMA user_version').get()?.user_version;
    if (version !== 0 && version !== 1) throw new Error('Incompatible relay state version');
    db.exec('PRAGMA synchronous = FULL; PRAGMA secure_delete = ON; CREATE TABLE IF NOT EXISTS relay_state (id INTEGER PRIMARY KEY CHECK(id = 1), scope TEXT NOT NULL, snapshot TEXT NOT NULL); PRAGMA user_version = 1;');
    const row = db.prepare('SELECT scope, snapshot FROM relay_state WHERE id = 1').get();
    if (row && row.scope !== scope) throw new Error('Relay project changed; explicit state rotation required');
    if (row) snapshotSchema.parse(JSON.parse(String(row.snapshot)));
    return {
      load() {
        const current = db.prepare('SELECT snapshot FROM relay_state WHERE id = 1').get();
        return current ? snapshotSchema.parse(JSON.parse(String(current.snapshot))) : null;
      },
      save(snapshot) {
        const bytes = JSON.stringify(snapshotSchema.parse(snapshot));
        db.prepare('INSERT INTO relay_state (id, scope, snapshot) VALUES (1, ?, ?) ON CONFLICT(id) DO UPDATE SET snapshot = excluded.snapshot').run(scope, bytes);
      },
      close: () => db.close(),
    };
  } catch (error) { db.close(); throw error; }
}
